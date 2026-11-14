import { classify, isConsumption } from "@/lib/analytics/classify";
import { addDays, completedMonths, daysBetween, inPeriod } from "@/lib/analytics/periods";
import { detectIncome, detectRegularBills } from "@/lib/analytics/recurrence";
import { recordedBalance } from "@/lib/analytics/spending";
import { mean } from "@/lib/analytics/stats";
import type { Transaction } from "@/lib/data/types";

/**
 * A conservative, educational cash-flow estimate: what could be spent now
 * without the modelled balance dropping below the protected floor at any
 * point in the horizon. It is an estimate, never a guarantee.
 */
export interface ForecastAssumptions {
  horizonDays: number;
  /** Cash the user wants left untouched. */
  protectedCents: number;
  /** Minimum everyday essentials (food, getting around) per day. */
  essentialDailyCents: number;
  /** Set aside for irregular essential costs over the horizon. */
  irregularReserveCents: number;
  /** Bills expected inside the horizon. */
  bills: { label: string; date: string; cents: number }[];
  /** Regular costs that are spread across the month, per day. */
  spreadBillsDailyCents: number;
  /** Other planned outflows, such as a transfer to savings. */
  otherOutflowsCents: number;
  /** Count income expected inside the horizon. Off by default: income is not certain. */
  includeExpectedIncome: boolean;
  expectedIncome: { date: string; cents: number }[];
}

type ForecastStatus = "ok" | "shortfall" | "insufficient_data";

export interface ForecastResult {
  status: ForecastStatus;
  asOf: string;
  horizonStart: string;
  horizonEnd: string;
  balanceCents: number;
  balanceDate: string | null;
  availableCents: number;
  shortfallCents: number;
  /** Per-day modelled headroom above the protected floor. */
  daily: { date: string; headroomCents: number }[];
  breakdown: {
    billsCents: number;
    spreadBillsCents: number;
    essentialsCents: number;
    irregularReserveCents: number;
    otherOutflowsCents: number;
    protectedCents: number;
    incomeCountedCents: number;
  };
  assumptions: ForecastAssumptions;
  /** Which assumptions came from history rather than from the user. */
  suggested: (keyof ForecastAssumptions)[];
}

const MIN_HISTORY_MONTHS = 3;

/** Starting assumptions suggested from the user's own history. All are editable. */
export function suggestAssumptions(
  transactions: readonly Transaction[],
  asOf: string,
  horizonDays = 7,
): ForecastAssumptions {
  const horizonEnd = addDays(asOf, horizonDays);
  const recent = completedMonths(asOf, 3);
  const year = completedMonths(asOf, 12);

  let essentialEveryday = 0;
  let recentDays = 0;
  for (const month of recent) {
    recentDays += daysBetween(month.startInclusive, month.endExclusive);
    for (const tx of transactions) {
      if (!isConsumption(tx) || !inPeriod(tx.date, month)) continue;
      const c = classify(tx);
      if (c.basket === "everyday" && c.necessity === "essential")
        essentialEveryday -= tx.amountCents;
    }
  }

  const irregularMonthly = mean(
    year.map((month) =>
      transactions.reduce((sum, tx) => {
        if (!isConsumption(tx) || !inPeriod(tx.date, month)) return sum;
        const c = classify(tx);
        return c.basket === "irregular" && c.necessity === "essential" ? sum - tx.amountCents : sum;
      }, 0),
    ),
  );

  const bills: ForecastAssumptions["bills"] = [];
  let spreadMonthly = 0;
  for (const bill of detectRegularBills(transactions, asOf)) {
    if (bill.typicalDay === null) {
      spreadMonthly += bill.typicalMonthlyCents;
    } else if (bill.nextExpectedDate && bill.nextExpectedDate <= horizonEnd) {
      bills.push({
        label: bill.category,
        date: bill.nextExpectedDate,
        cents: bill.typicalMonthlyCents,
      });
    }
  }

  const income = detectIncome(transactions, asOf);
  const expectedIncome =
    income.nextExpectedDate && income.nextExpectedDate <= horizonEnd
      ? [{ date: income.nextExpectedDate, cents: income.typicalCents }]
      : [];

  return {
    horizonDays,
    protectedCents: 0,
    essentialDailyCents: recentDays > 0 ? Math.round(essentialEveryday / recentDays) : 0,
    irregularReserveCents: Math.round((irregularMonthly * horizonDays) / 30),
    bills,
    spreadBillsDailyCents: Math.round(spreadMonthly / 30),
    otherOutflowsCents: 0,
    includeExpectedIncome: false,
    expectedIncome,
  };
}

export function estimateSafeToSpend(
  transactions: readonly Transaction[],
  asOf: string,
  assumptions: ForecastAssumptions,
  suggested: (keyof ForecastAssumptions)[] = [],
): ForecastResult {
  const horizonDays = Math.min(31, Math.max(1, Math.round(assumptions.horizonDays)));
  const balance = recordedBalance(transactions, asOf);
  const historyStart = completedMonths(asOf, MIN_HISTORY_MONTHS)[0]?.startInclusive ?? asOf;
  const hasHistory = transactions.some((tx) => tx.date < historyStart);

  const billsCents = assumptions.bills.reduce((sum, bill) => sum + bill.cents, 0);
  const incomeCountedCents = assumptions.includeExpectedIncome
    ? assumptions.expectedIncome.reduce((sum, item) => sum + item.cents, 0)
    : 0;
  const base = {
    asOf,
    horizonStart: addDays(asOf, 1),
    horizonEnd: addDays(asOf, horizonDays),
    balanceCents: balance?.balanceCents ?? 0,
    balanceDate: balance?.date ?? null,
    breakdown: {
      billsCents,
      spreadBillsCents: assumptions.spreadBillsDailyCents * horizonDays,
      essentialsCents: assumptions.essentialDailyCents * horizonDays,
      irregularReserveCents: assumptions.irregularReserveCents,
      otherOutflowsCents: assumptions.otherOutflowsCents,
      protectedCents: assumptions.protectedCents,
      incomeCountedCents,
    },
    assumptions: { ...assumptions, horizonDays },
    suggested,
  };

  if (!balance || !hasHistory) {
    return {
      ...base,
      status: "insufficient_data",
      availableCents: 0,
      shortfallCents: 0,
      daily: [],
    };
  }

  // Reserves and one-off outflows are taken up front; bills and essentials as they fall due.
  // Outflows on a day are counted before any income on that day.
  const daily: ForecastResult["daily"] = [];
  let running =
    balance.balanceCents -
    assumptions.protectedCents -
    assumptions.irregularReserveCents -
    assumptions.otherOutflowsCents;
  let lowest = running;
  for (let day = 1; day <= horizonDays; day += 1) {
    const date = addDays(asOf, day);
    running -= assumptions.essentialDailyCents + assumptions.spreadBillsDailyCents;
    for (const bill of assumptions.bills) if (bill.date === date) running -= bill.cents;
    lowest = Math.min(lowest, running);
    daily.push({ date, headroomCents: running });
    if (assumptions.includeExpectedIncome) {
      for (const item of assumptions.expectedIncome) if (item.date === date) running += item.cents;
    }
  }

  return {
    ...base,
    status: lowest < 0 ? "shortfall" : "ok",
    availableCents: Math.max(0, lowest),
    shortfallCents: Math.max(0, -lowest),
    daily,
  };
}
