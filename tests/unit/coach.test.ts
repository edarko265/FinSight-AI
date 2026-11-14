import { describe, expect, it } from "vitest";

import { themeOf } from "@/lib/admin/themes";
import { buildRewards, DEFAULT_REWARD_RULES, planGoal, type Goal } from "@/lib/coach/advice";
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
