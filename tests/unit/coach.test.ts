import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS, settingsSchema } from "@/lib/admin/settings";
import { themeOf } from "@/lib/admin/themes";
import { classify, classifyByRules } from "@/lib/analytics/classify";
import { lastCompletedMonth } from "@/lib/analytics/periods";
import { cashFlow } from "@/lib/analytics/spending";
import {
  detectRegularBills,
  detectRegularBillsUnadjusted,
  detectSubscriptions,
  setBillAdjustments,
} from "@/lib/analytics/recurrence";
import { goalProgress } from "@/lib/coach/goal-progress";
import { generateLinked, mergeAccounts, type LinkedAccount } from "@/lib/data/linked-accounts";
import {
  buildRewards,
  DEFAULT_REWARD_RULES,
  monthlyRoom,
  planGoal,
  safeToSave,
  type Goal,
} from "@/lib/coach/advice";
import { checkGrounding, parseAmountToCents } from "@/lib/coach/grounding";
import {
  actualSplit,
  applySplit,
  isValidSplit,
  nameCarriesAmount,
  TEMPLATES,
  toPercents,
} from "@/lib/coach/plan-math";
import { runQuery, runTool } from "@/lib/coach/registry";
import { detectChart, detectGoal, routeQuestion } from "@/lib/coach/router";
import type { CoachContext } from "@/lib/coach/tools";
import { removedFromDashboard } from "@/lib/coach/trash";
import { CHART_STYLES, type DashboardState } from "@/lib/contracts/chart";
import type { Transaction } from "@/lib/data/types";

/** Hand-authored fixture: eight months of a steady salary, rent, food and eating out. */
function ledger(): Transaction[] {
  const rows: Transaction[] = [];
  let row = 0;
  let balance = 200_000;
  const add = (
    date: string,
    cents: number,
    category: string,
    type = "purchase",
    mcc: string | null = null,
  ): void => {
    row += 1;
    balance += cents;
    rows.push({
      row,
      date,
      time: "12:00:00",
      amountCents: cents,
      balanceCents: balance,
      category,
      type,
      merchantId: null,
      mcc,
    });
  };
  for (const month of ["01", "02", "03", "04", "05", "06", "07", "08"]) {
    add(`2026-${month}-01`, 250_000, "Salary", "salary");
    add(`2026-${month}-03`, -90_000, "Housing", "housing_payment");
    add(`2026-${month}-08`, -30_000, "Groceries", "purchase", "5411");
    add(`2026-${month}-12`, -20_000, "Restaurants", "purchase", "5812");
    add(`2026-${month}-15`, -4_000, "Transportation", "purchase", "4121");
    add(`2026-${month}-20`, -10_000, "Entertainment", "purchase", "7832");
  }
  return rows;
}

const ctx: CoachContext = {
  record: {
    profile: { customerId: "TEST1", accountId: "ACC1", age: 40, postalCode: "00100" },
    transactions: ledger(),
  },
  asOf: "2026-09-15",
  locale: "en",
  benchmarks: [],
};

describe("basic-mode routing", () => {
  it("answers the challenge's example questions with the right calculation", () => {
    expect(routeQuestion(ctx, "How much did I spend on taxis last month?").query).toMatchObject({
      tool: "spending",
      input: { target: "taxi", period: "last_month" },
    });
    expect(routeQuestion(ctx, "What is safe for me to spend this week?").tool).toBe(
      "safe_to_spend",
    );
    expect(
      routeQuestion(ctx, "How much could I save if I reduced dining out by 20%?").query,
    ).toMatchObject({
      tool: "what_if",
      input: { target: "Restaurants", percent: 20 },
    });
    expect(routeQuestion(ctx, "What kind of spender am I?").tool).toBe("profile");
  });

  it("understands Finnish and Swedish", () => {
    expect(
      routeQuestion(ctx, "Paljonko käytin takseihin viime kuussa?").query?.input,
    ).toMatchObject({ target: "taxi" });
    expect(routeQuestion(ctx, "Vad är tryggt att använda den här veckan?").tool).toBe(
      "safe_to_spend",
    );
  });

  it("computes taxi spending to the cent", () => {
    const result = routeQuestion(ctx, "taxis last month");
    expect(result.facts[0]?.valueCents).toBe(4_000);
    expect(result.evidence).toMatchObject({ transactionCount: 1, mccs: ["4121"] });
  });

  it("draws the chart type the user asked for and remembers it on the widget", () => {
    expect(detectChart("show it as a pie chart")).toBe("donut");
    expect(detectChart("viivakaaviona")).toBe("line");
    const result = routeQuestion(ctx, "restaurants by month as a pie chart");
    expect(result.card?.chart.kind).toBe("donut");
    expect(result.query?.chart).toBe("donut");
  });

  it("falls back without inventing an answer", () => {
    const result = routeQuestion(ctx, "tell me a joke");
    expect(result.tool).toBe("none");
    expect(result.facts).toEqual([]);
  });
});

describe("safe-to-spend with optional inputs", () => {
  it("gives the same estimate when optional inputs are present but undefined", () => {
    const plain = runTool(ctx, "safe_to_spend", { horizonDays: 7 });
    const sparse = runTool(ctx, "safe_to_spend", {
      horizonDays: 7,
      protectedCents: undefined,
      otherOutflowsCents: undefined,
      includeExpectedIncome: undefined,
    });
    expect(sparse.facts).toEqual(plain.facts);
    expect(sparse.facts.every((fact) => Number.isSafeInteger(fact.valueCents))).toBe(true);
  });

  it("lowers what is free by a planned purchase", () => {
    const plain = runTool(ctx, "safe_to_spend", { horizonDays: 7 });
    const withPurchase = runTool(ctx, "safe_to_spend", {
      horizonDays: 7,
      otherOutflowsCents: 20_000,
    });
    const free = (result: typeof plain): number => result.facts.at(-1)?.valueCents ?? 0;
    expect(free(plain) - free(withPurchase)).toBe(20_000);
  });
});

describe("custom date ranges", () => {
  it("sums exactly the days chosen, both ends included", () => {
    // Restaurants fall on the 12th of each month: one in range, then two.
    const one = runTool(ctx, "spending", {
      target: "Restaurants",
      period: "2026-08-12..2026-08-12",
    });
    expect(one.facts[0]?.valueCents).toBe(20_000);
    const two = runTool(ctx, "spending", {
      target: "Restaurants",
      period: "2026-07-12..2026-08-12",
    });
    expect(two.facts[0]?.valueCents).toBe(40_000);
    expect(two.evidence).toMatchObject({
      startInclusive: "2026-07-12",
      endExclusive: "2026-08-13",
    });
  });

  it("never reaches past the as-of date and tolerates swapped dates", () => {
    const future = runTool(ctx, "spending", { period: "2026-08-01..2027-01-01" });
    expect(future.evidence?.endExclusive).toBe("2026-09-16");
    const swapped = runTool(ctx, "spending", {
      target: "Restaurants",
      period: "2026-08-12..2026-07-12",
    });
    expect(swapped.facts[0]?.valueCents).toBe(40_000);
  });

  it("applies a view's custom range to its widgets", () => {
    const result = runQuery(
      ctx,
      { tool: "spending", input: { target: "Restaurants" } },
      "2026-06-01..2026-08-31",
    );
    expect(result?.facts[0]?.valueCents).toBe(60_000);
  });

  it("rejects a malformed range", () => {
    expect(runQuery(ctx, { tool: "spending", input: { period: "2026-08-01..oops" } })).toBeNull();
  });
});

describe("saved widgets", () => {
  it("re-runs a stored query and applies the view's period and chart", () => {
    const result = runQuery(
      ctx,
      { tool: "spending", input: { target: "Restaurants" }, chart: "line" },
      "last_3_months",
    );
    expect(result?.card?.chart.kind).toBe("line");
    expect(result?.facts[0]?.valueCents).toBe(60_000);
  });

  it("rejects an unknown tool or invalid input", () => {
    expect(runQuery(ctx, { tool: "drop_tables", input: {} })).toBeNull();
    expect(
      runQuery(ctx, { tool: "what_if", input: { target: "Restaurants", percent: 500 } }),
    ).toBeNull();
  });

  it("validates tool input", () => {
    expect(() => runTool(ctx, "what_if", { target: "Restaurants", percent: 150 })).toThrow();
  });
});

describe("goals from free text", () => {
  it("reads an amount and a time span", () => {
    expect(detectGoal("I want to save 1 200 € for a trip in 8 months")).toEqual({
      targetCents: 120_000,
      months: 8,
    });
    expect(detectGoal("Haluan säästää 500 euroa")).toEqual({
      targetCents: 50_000,
      months: undefined,
    });
    expect(detectGoal("spara 2000 € på 2 år")).toEqual({ targetCents: 200_000, months: 24 });
  });

  it("does not mistake a what-if question for a goal", () => {
    expect(detectGoal("how much could I save if I cut restaurants by 20%")).toBeNull();
    expect(detectGoal("show my goals")).toBe("list");
  });

  it("plans from the usual monthly room, then from trims to free-choice spending", () => {
    const goal: Goal = {
      id: "g",
      name: "Trip",
      targetCents: 120_000,
      months: 12,
      monthlyCents: 10_000,
      createdOn: ctx.asOf,
    };
    const plan = planGoal(ctx, goal);
    // Room: 2,500 in - 1,540 out = 960 a month, more than the 100 needed.
    expect(plan.roomCents).toBe(96_000);
    expect(plan.fit).toBe("fits");
    expect(plan.cuts).toEqual([]);

    const big = planGoal(ctx, { ...goal, targetCents: 1_200_000, monthlyCents: 100_000 });
    expect(big.fit).toBe("stretch");
    expect(big.cuts[0]?.category).toBe("Restaurants");
  });
});

describe("rewards", () => {
  it("uses the rules staff have set", () => {
    const standard = buildRewards(ctx, 1);
    const generous = buildRewards(ctx, 1, {
      ...DEFAULT_REWARD_RULES,
      points: { ...DEFAULT_REWARD_RULES.points, goal: 500 },
    });
    expect(generous.points - standard.points).toBe(500 - DEFAULT_REWARD_RULES.points.goal);
    expect(generous.level).toBe("gold");
  });

  it("only rewards progress the data shows", () => {
    const none = buildRewards(ctx, 0);
    expect(none.achievements.find((item) => item.id === "goal")?.earned).toBe(false);
    expect(none.achievements.find((item) => item.id === "buffer")?.earned).toBe(true);
  });
});

describe("voucher ladder in rewards", () => {
  it("is built for the last completed month from income and consumption", () => {
    const { vouchers } = buildRewards(ctx, 0);
    const flow = cashFlow(ctx.record.transactions, lastCompletedMonth(ctx.asOf));
    expect(vouchers.month).toBe("2026-08");
    expect(vouchers.savedCents).toBe(
      flow.salaryCents + flow.otherIncomeCents - flow.consumptionCents,
    );
    expect(vouchers.incomeCents).toBe(monthlyRoom(ctx).incomeCents);
    expect(Number.isInteger(vouchers.incomeCents)).toBe(true);
    expect(vouchers.available).toBe(true);
    expect(vouchers.source.id).toBe("statfin-15ac");
    expect(vouchers.selected).toBeNull();
    expect("coupons" in buildRewards(ctx, 0)).toBe(false);
  });

  it("honours a pick for the evaluated month and ignores one for another month", () => {
    const free = buildRewards(ctx, 0).vouchers;
    const unlocked = free.tiers.find((tier) => tier.unlocked);
    expect(unlocked).toBeDefined();
    const option = unlocked?.options[0];
    const pick = { month: "2026-08", tierId: unlocked!.id, optionId: option!.id };
    const picked = buildRewards(ctx, 0, DEFAULT_REWARD_RULES, pick).vouchers;
    expect(picked.selected).toEqual(pick);
    expect(picked.selectedValid).toBe(true);
    const stale = buildRewards(ctx, 0, DEFAULT_REWARD_RULES, { ...pick, month: "2026-07" });
    expect(stale.vouchers.selected).toBeNull();
  });
});

describe("settings", () => {
  it("still parses a stored document that has the removed coupon thresholds", () => {
    const legacy = {
      ...DEFAULT_SETTINGS,
      rewards: {
        ...DEFAULT_SETTINGS.rewards,
        couponUnlockAt: { coffee: 100, groceries: 200, voucher: 350 },
      },
    };
    const parsed = settingsSchema.safeParse(legacy);
    expect(parsed.success).toBe(true);
    expect(parsed.success && "couponUnlockAt" in parsed.data.rewards).toBe(false);
  });
});

describe("grounding check", () => {
  const result = routeQuestion(ctx, "taxis last month");

  it("reads amounts in every format the app prints", () => {
    expect(parseAmountToCents("1 011,45")).toBe(101_145);
    expect(parseAmountToCents("1,011.45")).toBe(101_145);
    expect(parseAmountToCents("1011")).toBe(101_100);
    expect(parseAmountToCents("40,00")).toBe(4_000);
  });

  it("accepts wording that repeats calculated amounts, exactly or rounded", () => {
    expect(checkGrounding("You spent €40.00 on taxis.", [result]).grounded).toBe(true);
    expect(checkGrounding("Käytit takseihin 40 euroa.", [result]).grounded).toBe(true);
    expect(checkGrounding("Taxis were a small part of August.", [result]).grounded).toBe(true);
  });

  it("rejects an amount no calculation produced", () => {
    const check = checkGrounding("You spent €73.20 on taxis.", [result]);
    expect(check.grounded).toBe(false);
    expect(check.unsupported).toEqual(["73.20"]);
    expect(checkGrounding("You have about 500 euros free.", []).grounded).toBe(false);
  });
});

describe("recycle bin", () => {
  const widget = (id: string) => ({ id, query: { tool: "spending", input: {} } });
  const before: DashboardState = {
    activeId: "a",
    views: [
      { id: "a", name: "Mine", period: "last_month", widgets: [widget("w1"), widget("w2")] },
      { id: "b", name: "Other", period: "last_month", widgets: [widget("w3")] },
    ],
  };

  it("collects exactly what a save removed", () => {
    const after: DashboardState = {
      activeId: "a",
      views: [{ ...before.views[0]!, widgets: [widget("w1")] }],
    };
    const removed = removedFromDashboard(before, after);
    expect(
      removed.map((item) => [item.kind, item.kind === "widget" ? item.item.id : item.item.id]),
    ).toEqual([
      ["widget", "w2"],
      ["view", "b"],
    ]);
  });

  it("puts nothing in the bin when nothing was removed", () => {
    expect(removedFromDashboard(before, before)).toEqual([]);
  });
});

describe("question themes", () => {
  it("sorts a question into a broad theme without keeping it", () => {
    expect(themeOf("Can I get a mortgage for a flat?")).toBe("loans");
    expect(themeOf("Mihin rahastoon kannattaa sijoittaa?")).toBe("investing");
    expect(themeOf("what's the weather")).toBe("other");
  });
});

describe("plans", () => {
  it("turns amounts into whole percentages that add up to exactly 100", () => {
    expect(toPercents([1, 1, 1])).toEqual([34, 33, 33]);
    expect(toPercents([90_000, 0, 64_000, 96_000, 0])).toEqual([36, 0, 26, 38, 0]);
    expect(toPercents([0, 0])).toEqual([0, 0]);
    for (const amounts of [
      [3, 7, 11, 13, 17],
      [1, 999],
      [333, 333, 334],
    ]) {
      expect(toPercents(amounts).reduce((sum, value) => sum + value, 0)).toBe(100);
    }
  });

  it("splits the last three months of income into the five slices", () => {
    const actual = actualSplit(ctx.record.transactions, ctx.asOf);
    expect(actual.incomeCents).toBe(250_000);
    // Rent 900 of 2,500 is 36 %; what was not spent is saving.
    expect(actual.percent.bills).toBe(36);
    expect(actual.cents.saving).toBe(
      250_000 - actual.cents.bills - actual.cents.essentials - actual.cents.everyday,
    );
    expect(isValidSplit(actual.percent)).toBe(true);
  });

  it("works out a copied plan on the copier's own income", () => {
    expect(applySplit(TEMPLATES.balanced, 300_000)).toEqual({
      bills: 105_000,
      essentials: 30_000,
      everyday: 90_000,
      saving: 60_000,
      investing: 15_000,
    });
  });

  it("refuses splits that do not add up and names that carry an amount", () => {
    expect(isValidSplit({ ...TEMPLATES.balanced, saving: 25 })).toBe(false);
    expect(isValidSplit({ ...TEMPLATES.balanced, saving: 20.5, investing: 4.5 })).toBe(false);
    expect(nameCarriesAmount("Saving 2500 for a car")).toBe(true);
    expect(nameCarriesAmount("My 400 € plan")).toBe(true);
    expect(nameCarriesAmount("50/30/20 for students")).toBe(false);
  });

  it("answers a budget question with the split, in basic mode", () => {
    const result = routeQuestion(ctx, "Make me a budget plan");
    expect(result.tool).toBe("plan");
    expect(result.card?.chart.kind).toBe("donut");
  });
});

describe("chart types", () => {
  it("recognises every chart type by name, in three languages", () => {
    const asked: [string, string][] = [
      ["show my spending as a tree map", "treemap"],
      ["menot vesiputouksena", "waterfall"],
      ["as a radar chart please", "radar"],
      ["visa som ringar", "radial"],
      ["as a funnel", "funnel"],
      ["lollipop chart of my categories", "lollipop"],
      ["in a table", "table"],
      ["as big numbers", "stat"],
      ["as a stacked bar", "stack"],
      ["as an area chart", "area"],
      ["as horizontal bars", "hbar"],
      ["as a filled pie", "pie"],
      ["as a pie chart", "donut"],
      ["viivakaaviona", "line"],
      ["as a bar chart", "bar"],
    ];
    for (const [question, chart] of asked) expect(detectChart(question)).toBe(chart);
    // Words that only look like a chart name are left alone.
    expect(detectChart("how are my savings and earrings")).toBeUndefined();
  });

  it("redraws any calculation in any chart type with the same figures", () => {
    const base = runTool(ctx, "spending", {});
    for (const chart of CHART_STYLES) {
      const drawn = runTool(ctx, "spending", {}, chart);
      expect(drawn.card?.chart.kind).toBe(chart);
      expect(drawn.card?.chart.points).toEqual(base.card?.chart.points);
      expect(drawn.query?.chart).toBe(chart);
    }
  });
});

describe("linked accounts (simulated)", () => {
  const account: LinkedAccount = {
    id: "acct-test-0001",
    bank: "aurora",
    kind: "everyday",
    nickname: "Other bank",
    included: true,
    linkedOn: "2026-09-15",
  };

  it("generates the same history every time, and nothing after the demo date", () => {
    const first = generateLinked(account, "seed", ctx.asOf);
    expect(generateLinked(account, "seed", ctx.asOf)).toEqual(first);
    expect(generateLinked(account, "another-customer", ctx.asOf)).not.toEqual(first);
    expect(first.length).toBeGreaterThan(50);
    expect(first.every((tx) => tx.date <= ctx.asOf && tx.account === account.id)).toBe(true);
  });

  it("merges accounts so the balance is the total across them", () => {
    const linked = generateLinked(account, "seed", ctx.asOf);
    const main = ctx.record.transactions;
    const merged = mergeAccounts(main, [{ account, transactions: linked }], ctx.asOf);
    expect(merged.transactions).toHaveLength(main.length + linked.length);
    expect(merged.transactions.at(-1)?.balanceCents).toBe(
      (main.at(-1)?.balanceCents ?? 0) + (linked.at(-1)?.balanceCents ?? 0),
    );
    expect(merged.accounts.map((item) => item.simulated)).toEqual([false, true]);
    // An account the customer chose not to count is listed but not merged.
    const excluded = mergeAccounts(
      main,
      [{ account: { ...account, included: false }, transactions: linked }],
      ctx.asOf,
    );
    expect(excluded.transactions).toHaveLength(main.length);
    expect(excluded.accounts).toHaveLength(2);
  });

  it("includes linked spending in the answers and says that it is simulated", () => {
    const linked = generateLinked(account, "seed", ctx.asOf);
    const merged = mergeAccounts(
      ctx.record.transactions,
      [{ account, transactions: linked }],
      ctx.asOf,
    );
    const both: CoachContext = {
      ...ctx,
      record: { ...ctx.record, transactions: merged.transactions, accounts: merged.accounts },
    };
    const alone = runTool(ctx, "spending", { period: "last_month" });
    const together = runTool(both, "spending", { period: "last_month" });
    const total = (result: typeof alone): number =>
      (result.card?.chart.points ?? []).reduce((sum, point) => sum + point.valueCents, 0);
    expect(total(together)).toBeGreaterThan(total(alone));
    expect(together.card?.basis).toContain("simulated");
    expect(alone.card?.basis).not.toContain("simulated");
    expect(routeQuestion(both, "show all my accounts").tool).toBe("accounts");
  });

  it("finds the linked account's subscriptions and nothing among ordinary shopping", () => {
    const linked = generateLinked(account, "seed", ctx.asOf);
    const found = detectSubscriptions(linked, ctx.asOf);
    expect(found.map((item) => item.typicalCents).sort((a, b) => a - b)).toEqual([1299, 3990]);
    expect(detectSubscriptions(ctx.record.transactions, ctx.asOf)).toEqual([]);
  });
});

describe("corrections", () => {
  it("lets the customer's choice win, and keeps what the rules said", () => {
    const taxi = ctx.record.transactions.find((tx) => tx.mcc === "4121");
    if (!taxi) throw new Error("fixture has no taxi ride");
    expect(classify(taxi)).toMatchObject({ basket: "everyday", necessity: "discretionary" });
    const corrected = {
      ...taxi,
      override: { basket: "everyday", necessity: "essential" } as const,
    };
    expect(classify(corrected)).toMatchObject({ necessity: "essential" });
    expect(classifyByRules(corrected)).toMatchObject({ necessity: "discretionary" });
  });

  it("applies an adjusted bill everywhere, and the suggestion stays available", () => {
    const txs = [...ctx.record.transactions];
    const before = detectRegularBills(txs, ctx.asOf).find((bill) => bill.category === "Housing");
    expect(before?.typicalMonthlyCents).toBe(90_000);
    setBillAdjustments(txs, { Housing: { cents: 95_000, day: 5 } });
    const after = detectRegularBills(txs, ctx.asOf).find((bill) => bill.category === "Housing");
    expect(after).toMatchObject({ typicalMonthlyCents: 95_000, typicalDay: 5, adjusted: true });
    expect(
      detectRegularBillsUnadjusted(txs, ctx.asOf).find((bill) => bill.category === "Housing")
        ?.typicalMonthlyCents,
    ).toBe(90_000);
    setBillAdjustments(txs, { Housing: { skip: true } });
    expect(detectRegularBills(txs, ctx.asOf).some((bill) => bill.category === "Housing")).toBe(
      false,
    );
  });
});

describe("safe to save and goal progress", () => {
  it("never offers more than leaves the next month covered", () => {
    const now = safeToSave(ctx);
    expect(now.status).toBe("ok");
    expect(now.safeCents).toBe(Math.max(0, now.availableCents - now.keepCents));
    expect(now.safeCents).toBeLessThan(now.balanceCents);
    // Money already set aside is protected, so it reduces what else can be set aside.
    const earmarked: CoachContext = { ...ctx, record: { ...ctx.record, earmarkedCents: 50_000 } };
    expect(safeToSave(earmarked).safeCents).toBe(Math.max(0, now.safeCents - 50_000));
    expect(routeQuestion(ctx, "how much can I save?").tool).toBe("safe_to_save");
  });

  it("measures a goal against what was set aside and against the plan", () => {
    const goal: Goal = {
      id: "g1",
      name: "Trip",
      targetCents: 120_000,
      months: 12,
      monthlyCents: 10_000,
      createdOn: "2026-07-15",
    };
    const plan = planGoal(ctx, goal);
    const aside = (cents: number, id: string) => ({ id, goalId: "g1", cents, date: "2026-09-01" });
    // Two months have passed: the plan expected 200.
    expect(goalProgress(plan, [], ctx.asOf)).toMatchObject({
      savedCents: 0,
      percent: 0,
      pace: "behind",
      monthsLeft: 12,
    });
    expect(goalProgress(plan, [aside(20_000, "a")], ctx.asOf)).toMatchObject({
      percent: 17,
      pace: "on_track",
      monthsLeft: 10,
    });
    expect(goalProgress(plan, [aside(20_000, "a"), aside(15_000, "b")], ctx.asOf).pace).toBe(
      "ahead",
    );
    // Set-asides for another goal do not count.
    expect(
      goalProgress(plan, [{ ...aside(50_000, "c"), goalId: "other" }], ctx.asOf).savedCents,
    ).toBe(0);
  });
});
