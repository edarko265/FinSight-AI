import { describe, expect, it } from "vitest";

import { classify, flowOf } from "@/lib/analytics/classify";
import { estimateSafeToSpend, type ForecastAssumptions } from "@/lib/analytics/forecast";
import { completedMonths, lastCompletedMonth, monthToDate } from "@/lib/analytics/periods";
import { applyBasisPoints, simulateReduction } from "@/lib/analytics/scenario";
import {
  basketBreakdown,
  cashFlow,
  recordedBalance,
  summariseSpending,
} from "@/lib/analytics/spending";
import type { Transaction } from "@/lib/data/types";

/** Hand-authored fixture. Not derived from the bank's data. */
let row = 0;
function tx(
  date: string,
  amountCents: number,
  category: string,
  type = "purchase",
  mcc: string | null = null,
): Transaction {
  row += 1;
  return {
    row,
    date,
    time: "12:00:00",
    amountCents,
    balanceCents: 0,
    category,
    type,
    merchantId: null,
    mcc,
  };
}

const AS_OF = "2026-09-15";
const LEDGER: Transaction[] = [
  tx("2026-05-01", 300_000, "Salary", "salary"),
  tx("2026-08-01", 300_000, "Salary", "salary"),
  tx("2026-08-03", -80_000, "Housing", "housing_payment"),
  tx("2026-08-05", -6_000, "Utilities", "utilities_payment"),
  tx("2026-08-07", -12_050, "Groceries", "purchase", "5411"),
  tx("2026-08-09", -4_000, "Restaurants", "purchase", "5812"),
  tx("2026-08-10", -1_995, "Restaurants", "purchase", "5814"),
  tx("2026-08-11", -2_500, "Transportation", "purchase", "4121"),
  tx("2026-08-12", -9_000, "Health", "purchase", "8021"),
  tx("2026-08-20", -20_000, "Invest Deposit", "investment_deposit"),
  tx("2026-08-25", 5_000, "Invest Withdraw", "investment_withdrawal"),
  tx("2026-08-28", -3_333, "Mystery", "purchase"),
  { ...tx("2026-09-10", -1_000, "Groceries", "purchase", "5411"), balanceCents: 100_000 },
  { ...tx("2026-09-20", -99_999, "Travel", "purchase"), balanceCents: 1 },
];
const AUGUST = lastCompletedMonth(AS_OF);

describe("periods", () => {
  it("resolves last month against the as-of date, not the real clock", () => {
    expect(AUGUST).toEqual({ startInclusive: "2026-08-01", endExclusive: "2026-09-01" });
    expect(monthToDate(AS_OF)).toEqual({
      startInclusive: "2026-09-01",
      endExclusive: "2026-09-16",
    });
  });

  it("lists completed months oldest first across a year boundary", () => {
    expect(completedMonths("2026-02-10", 3).map((m) => m.startInclusive)).toEqual([
      "2025-11-01",
      "2025-12-01",
      "2026-01-01",
    ]);
  });
});

describe("classification", () => {
  it("never treats investing or income as consumption", () => {
    expect(flowOf(LEDGER[9]!)).toBe("investment_out");
    expect(flowOf(LEDGER[10]!)).toBe("investment_in");
    expect(classify(LEDGER[9]!).basket).toBe("unclassified");
  });

  it("separates necessity inside a category by merchant code", () => {
    expect(classify(tx("2026-08-01", -100, "Transportation", "purchase", "4121")).necessity).toBe(
      "discretionary",
    );
    expect(classify(tx("2026-08-01", -100, "Transportation", "purchase", "4111")).necessity).toBe(
      "essential",
    );
  });
});

describe("spending", () => {
  it("sums consumption only, to the cent", () => {
    const summary = summariseSpending(LEDGER, { period: AUGUST });
    expect(summary.totalCents).toBe(
      80_000 + 6_000 + 12_050 + 4_000 + 1_995 + 2_500 + 9_000 + 3_333,
    );
    expect(summary.transactionCount).toBe(8);
  });

  it("filters by category and by merchant code", () => {
    expect(
      summariseSpending(LEDGER, { period: AUGUST, categories: ["Restaurants"] }).totalCents,
    ).toBe(5_995);
    expect(summariseSpending(LEDGER, { period: AUGUST, mccs: ["4121"] }).totalCents).toBe(2_500);
  });

  it("puts every purchase in exactly one basket and reconciles to consumption", () => {
    const breakdown = basketBreakdown(LEDGER, AUGUST);
    const total = breakdown.baskets.reduce((sum, basket) => sum + basket.totalCents, 0);
    expect(total).toBe(breakdown.consumptionCents);
    expect(breakdown.baskets.find((b) => b.basket === "regular")?.totalCents).toBe(86_000);
    expect(breakdown.baskets.find((b) => b.basket === "irregular")?.totalCents).toBe(9_000);
    expect(breakdown.baskets.find((b) => b.basket === "unclassified")?.totalCents).toBe(3_333);
  });

  it("keeps investing apart from spending in cash flow", () => {
    const flow = cashFlow(LEDGER, AUGUST);
    expect(flow.investedCents).toBe(20_000);
    expect(flow.investmentWithdrawnCents).toBe(5_000);
    expect(flow.salaryCents).toBe(300_000);
    expect(flow.netCents).toBe(300_000 - flow.consumptionCents - 20_000 + 5_000);
  });

  it("reads the balance from the last transaction on or before the as-of date", () => {
    expect(recordedBalance(LEDGER, AS_OF)).toEqual({ balanceCents: 100_000, date: "2026-09-10" });
  });
});

describe("what-if scenario", () => {
  it("saves exactly 20% of the baseline, rounded once", () => {
    const scenario = simulateReduction(
      LEDGER,
      { period: AUGUST, categories: ["Restaurants"] },
      2_000,
    );
    expect(scenario.baselineCents).toBe(5_995);
    expect(scenario.savingCents).toBe(1_199);
    expect(scenario.resultingCents).toBe(4_796);
    expect(scenario.annualisedSavingCents).toBe(14_388);
  });

  it("handles 0% and 100% and rejects anything else", () => {
    expect(applyBasisPoints(5_995, 0)).toBe(0);
    expect(applyBasisPoints(5_995, 10_000)).toBe(5_995);
    expect(() => simulateReduction(LEDGER, { period: AUGUST }, -5_000)).toThrow(RangeError);
    expect(() => simulateReduction(LEDGER, { period: AUGUST }, 10_001)).toThrow(RangeError);
  });
});

describe("safe-to-spend estimate", () => {
  const base: ForecastAssumptions = {
    horizonDays: 7,
    protectedCents: 20_000,
    essentialDailyCents: 0,
    irregularReserveCents: 5_000,
    bills: [{ label: "Rent", date: "2026-09-18", cents: 30_000 }],
    spreadBillsDailyCents: 0,
    otherOutflowsCents: 3_000,
    includeExpectedIncome: false,
    expectedIncome: [{ date: "2026-09-20", cents: 300_000 }],
  };
  // Balance 1,000.00; essentials 120.00 over seven days is not evenly divisible, so use a daily rate.
  const withEssentials = { ...base, essentialDailyCents: 1_714 };

  it("matches the worked example: 1000 - 200 - 300 - ~120 - 50 - 30", () => {
    const result = estimateSafeToSpend(LEDGER, AS_OF, withEssentials);
    expect(result.status).toBe("ok");
    expect(result.balanceCents).toBe(100_000);
    expect(result.availableCents).toBe(100_000 - 20_000 - 5_000 - 3_000 - 30_000 - 1_714 * 7);
    expect(result.shortfallCents).toBe(0);
  });

  it("reports a shortfall separately and never a negative allowance", () => {
    const result = estimateSafeToSpend(LEDGER, AS_OF, {
      ...withEssentials,
      protectedCents: 60_000,
    });
    expect(result.status).toBe("shortfall");
    expect(result.availableCents).toBe(0);
    expect(result.shortfallCents).toBeGreaterThan(0);
  });

  it("does not let later income hide an earlier shortage", () => {
    const tight = { ...withEssentials, protectedCents: 60_000, includeExpectedIncome: true };
    expect(estimateSafeToSpend(LEDGER, AS_OF, tight).status).toBe("shortfall");
  });

  it("ignores transactions after the as-of date", () => {
    const withoutFuture = LEDGER.filter((item) => item.date <= AS_OF);
    expect(estimateSafeToSpend(LEDGER, AS_OF, base).availableCents).toBe(
      estimateSafeToSpend(withoutFuture, AS_OF, base).availableCents,
    );
  });

  it("says when there is not enough history", () => {
    const recent = LEDGER.filter((item) => item.date >= "2026-09-01");
    expect(estimateSafeToSpend(recent, AS_OF, base).status).toBe("insufficient_data");
  });
});
