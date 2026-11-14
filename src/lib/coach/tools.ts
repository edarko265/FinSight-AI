import { actualSplit, SLICES } from "@/lib/coach/plan-math";
import {
  ageBand,
  customerMetrics,
  positionAgainst,
  type BenchmarkRow,
} from "@/lib/analytics/benchmarks";
import { classify, isConsumption } from "@/lib/analytics/classify";
import {
  estimateSafeToSpend,
  suggestAssumptions,
  type ForecastAssumptions,
} from "@/lib/analytics/forecast";
import {
  addDays,
  completedMonths,
  isValidDate,
  lastCompletedMonth,
  monthPeriod,
  monthToDate,
  type Period,
} from "@/lib/analytics/periods";
import { detectIncome, detectRegularBills, detectSubscriptions } from "@/lib/analytics/recurrence";
import { simulateReduction } from "@/lib/analytics/scenario";
import {
  balanceByMonth,
  basketBreakdown,
  cashFlow,
  monthlySpending,
  recordedBalance,
  summariseSpending,
} from "@/lib/analytics/spending";
import { CUSTOM_PERIOD, type ChartCard, type WidgetQuery } from "@/lib/contracts/chart";
import type { EvidenceRef, MoneyFact } from "@/lib/contracts/chat";
import type { CustomerRecord } from "@/lib/data/types";
import { formatDay, formatMoney, formatMonth, type Locale } from "@/lib/i18n/config";
import { hasMessage, translate, type MessageKey, type MessageParams } from "@/lib/i18n/translate";
import { nationalAverage } from "@/lib/coach/statfin";

/**
 * The coach's tools. Each one runs a deterministic calculation for the
 * signed-in customer and returns a finished, localised answer: text, a chart
 * spec, the facts behind it and a reference to the evidence. The chat UI, the
 * dashboard, the language model and the voice agent all call these same
 * functions, so they cannot disagree about a number.
 */
export interface CoachContext {
  record: CustomerRecord;
  asOf: string;
  locale: Locale;
  benchmarks: BenchmarkRow[];
}

export interface ToolResult {
  tool: string;
  /** Set by the registry: the validated call that produced this result. */
  query?: WidgetQuery;
  text: string;
  card?: ChartCard;
  facts: MoneyFact[];
  evidence?: EvidenceRef;
  lesson?: string;
  followUps: string[];
}

/** Things a user can ask about by name. Taxis and cafés are picked out by merchant code. */
export const TARGET_KEYS = [
  "Housing",
  "Utilities",
  "Health",
  "Home & Tech",
  "Groceries",
  "Transportation",
  "Restaurants",
  "Entertainment",
  "Lifestyle",
  "Travel",
  "taxi",
  "cafes",
] as const;
export type TargetKey = (typeof TARGET_KEYS)[number];

type Target = { categories?: readonly string[]; mccs?: readonly string[] };

export const TARGETS: Record<TargetKey, Target> = {
  Housing: { categories: ["Housing"] },
  Utilities: { categories: ["Utilities"] },
  Health: { categories: ["Health"] },
  "Home & Tech": { categories: ["Home & Tech"] },
  Groceries: { categories: ["Groceries"] },
  Transportation: { categories: ["Transportation"] },
  Restaurants: { categories: ["Restaurants"] },
  Entertainment: { categories: ["Entertainment"] },
  Lifestyle: { categories: ["Lifestyle"] },
  Travel: { categories: ["Travel"] },
  taxi: { mccs: ["4121"] },
  cafes: { mccs: ["5814"] },
};

export const PERIOD_KEYS = [
  "last_month",
  "this_month",
  "last_3_months",
  "last_6_months",
  "last_12_months",
] as const;
export type PeriodKey =
  (typeof PERIOD_KEYS)[number] | `${number}-${number}` | `${string}..${string}`;

function makeHelpers(ctx: CoachContext) {
  const t = (key: MessageKey, params?: MessageParams): string => translate(ctx.locale, key, params);
  const money = (cents: number): string => formatMoney(cents, ctx.locale);
  const targetLabel = (key: string): string => {
    const messageKey = `cat.${key}`;
    return hasMessage(messageKey) ? t(messageKey) : key;
  };
  const periodLabel = (period: Period): string => {
    const months = Math.round(
      (Date.parse(period.endExclusive) - Date.parse(period.startInclusive)) / (30.4 * 86_400_000),
    );
    const first = period.startInclusive.slice(0, 7);
    if (period.startInclusive.endsWith("-01") && period.endExclusive.endsWith("-01")) {
      if (months <= 1) return formatMonth(first, ctx.locale, "long");
      const lastMonth = new Date(Date.parse(period.endExclusive) - 86_400_000)
        .toISOString()
        .slice(0, 7);
      return t("period.range", {
        from: formatMonth(first, ctx.locale, "long"),
        to: formatMonth(lastMonth, ctx.locale, "long"),
      });
    }
    const monthSoFar = monthToDate(ctx.asOf);
    if (
      period.startInclusive === monthSoFar.startInclusive &&
      period.endExclusive === monthSoFar.endExclusive
    ) {
      return t("period.monthToDate", { month: formatMonth(first, ctx.locale, "long") });
    }
    // A range the customer chose: say the exact days.
    return t("period.range", {
      from: formatDay(period.startInclusive, ctx.locale),
      to: formatDay(addDays(period.endExclusive, -1), ctx.locale),
    });
  };
  const linkedCount = (ctx.record.accounts ?? []).filter(
    (account) => account.simulated && account.included,
  ).length;
  const basis = (period: Period): string =>
    t("coach.basis", { period: periodLabel(period), asOf: formatDay(ctx.asOf, ctx.locale) }) +
    // Say so whenever figures include accounts linked from elsewhere, which are simulated here.
    (linkedCount > 0 ? ` ${t("coach.basis.linked", { count: linkedCount })}` : "");
  const evidence = (period: Period, count: number, target?: TargetKey): EvidenceRef => {
    const filter = target ? TARGETS[target] : undefined;
    return {
      startInclusive: period.startInclusive,
      endExclusive: period.endExclusive,
      periodLabel: periodLabel(period),
      categories: filter?.categories ? [...filter.categories] : undefined,
      mccs: filter?.mccs ? [...filter.mccs] : undefined,
      transactionCount: count,
    };
  };
  return { t, money, targetLabel, periodLabel, basis, evidence };
}

export function resolvePeriod(key: PeriodKey | undefined, asOf: string): Period {
  switch (key) {
    case "this_month":
      return monthToDate(asOf);
    case "last_3_months":
    case "last_6_months":
    case "last_12_months": {
      const count = key === "last_3_months" ? 3 : key === "last_6_months" ? 6 : 12;
      const months = completedMonths(asOf, count);
      return {
        startInclusive: months[0]?.startInclusive ?? asOf,
        endExclusive: months[months.length - 1]?.endExclusive ?? asOf,
      };
    }
    case undefined:
    case "last_month":
      return lastCompletedMonth(asOf);
    default: {
      // A custom range, "from..to" with both days included. Nothing after the as-of date is used.
      const custom = CUSTOM_PERIOD.exec(key);
      if (custom?.[1] && custom[2] && isValidDate(custom[1]) && isValidDate(custom[2])) {
        const from = custom[1] <= custom[2] ? custom[1] : custom[2];
        const to = custom[1] <= custom[2] ? custom[2] : custom[1];
        const end = addDays(to < asOf ? to : asOf, 1);
        return { startInclusive: from < end ? from : addDays(end, -1), endExclusive: end };
      }
      return /^\d{4}-\d{2}$/.test(key) ? monthPeriod(key) : lastCompletedMonth(asOf);
    }
  }
}

function filterOf(target: TargetKey | undefined, period: Period) {
  const filter: Target = target ? TARGETS[target] : {};
  return { period, categories: filter.categories, mccs: filter.mccs };
}

/** How much was spent, in total or on one kind of thing, in a period. */
export function spendingTool(
  ctx: CoachContext,
  input: { target?: TargetKey; period?: PeriodKey },
): ToolResult {
  const h = makeHelpers(ctx);
  const period = resolvePeriod(input.period, ctx.asOf);
  const summary = summariseSpending(ctx.record.transactions, filterOf(input.target, period));
  const label = h.periodLabel(period);

  if (summary.transactionCount === 0) {
    return {
      tool: "spending",
      text: h.t("coach.none", { period: label }),
      facts: [],
      followUps: [],
    };
  }

  if (input.target) {
    const name = h.targetLabel(input.target);
    const months = completedMonths(ctx.asOf, 6);
    const trend = monthlySpending(
      ctx.record.transactions,
      filterOf(input.target, {
        startInclusive: months[0]?.startInclusive ?? ctx.asOf,
        endExclusive: months[months.length - 1]?.endExclusive ?? ctx.asOf,
      }),
    );
    const text = h.t("coach.category.summary", {
      total: h.money(summary.totalCents),
      category: name,
      period: label,
      count: summary.transactionCount,
    });
    return {
      tool: "spending",
      text,
      card: {
        title: h.t("coach.category.title", { category: name }),
        summary: text,
        chart: {
          kind: "bar",
          points: trend.map((m) => ({
            label: formatMonth(m.month, ctx.locale),
            valueCents: m.totalCents,
          })),
        },
        basis: h.basis(period),
      },
      facts: [{ label: `${name}, ${label}`, valueCents: summary.totalCents }],
      evidence: h.evidence(period, summary.transactionCount, input.target),
      followUps: [h.t("chat.suggest.whatif"), h.t("chat.suggest.peers")],
    };
  }

  const top = summary.byCategory.slice(0, 5);
  const rest = summary.byCategory.slice(5).reduce((sum, c) => sum + c.totalCents, 0);
  const points = top.map((c) => ({ label: h.targetLabel(c.category), valueCents: c.totalCents }));
  if (rest > 0) points.push({ label: h.t("cat.other"), valueCents: rest });
  const text = h.t("coach.spending.summary", {
    total: h.money(summary.totalCents),
    count: summary.transactionCount,
    period: label,
    top: `${h.targetLabel(top[0]?.category ?? "")} (${h.money(top[0]?.totalCents ?? 0)})`,
  });
  return {
    tool: "spending",
    text,
    card: {
      title: h.t("coach.spending.title"),
      summary: text,
      chart: { kind: "donut", points },
      basis: h.basis(period),
    },
    facts: [
      { label: label, valueCents: summary.totalCents },
      ...summary.byCategory.map((c) => ({
        label: h.targetLabel(c.category),
        valueCents: c.totalCents,
      })),
    ],
    evidence: h.evidence(period, summary.transactionCount),
    followUps: [h.t("chat.suggest.spender"), h.t("chat.suggest.safe")],
  };
}

/** Spending month by month, in total or for one kind of thing. */
export function trendTool(
  ctx: CoachContext,
  input: { target?: TargetKey; months?: number },
): ToolResult {
  const h = makeHelpers(ctx);
  const count = Math.min(12, Math.max(3, input.months ?? 6));
  const months = completedMonths(ctx.asOf, count);
  const period = {
    startInclusive: months[0]?.startInclusive ?? ctx.asOf,
    endExclusive: months[months.length - 1]?.endExclusive ?? ctx.asOf,
  };
  const trend = monthlySpending(ctx.record.transactions, filterOf(input.target, period));
  const latest = trend[trend.length - 1];
  const total = trend.reduce((sum, m) => sum + m.transactionCount, 0);
  const name = input.target ? h.targetLabel(input.target) : "";
  const text = h.t(input.target ? "coach.categoryTrend.summary" : "coach.trend.summary", {
    category: name,
    months: count,
    latest: h.money(latest?.totalCents ?? 0),
  });
  return {
    tool: "trend",
    text,
    card: {
      title: h.t(input.target ? "coach.categoryTrend.title" : "coach.trend.title", {
        category: name,
      }),
      summary: text,
      chart: {
        kind: input.target ? "line" : "bar",
        points: trend.map((m) => ({
          label: formatMonth(m.month, ctx.locale),
          valueCents: m.totalCents,
        })),
      },
      basis: h.basis(period),
    },
    facts: trend.map((m) => ({
      label: formatMonth(m.month, ctx.locale, "long"),
      valueCents: m.totalCents,
    })),
    evidence: h.evidence(period, total, input.target),
    followUps: [h.t("chat.suggest.where"), h.t("chat.suggest.whatif")],
  };
}

export function balanceTool(ctx: CoachContext): ToolResult {
  const h = makeHelpers(ctx);
  const months = completedMonths(ctx.asOf, 6);
  const period = { startInclusive: months[0]?.startInclusive ?? ctx.asOf, endExclusive: ctx.asOf };
  const series = balanceByMonth(ctx.record.transactions, {
    startInclusive: period.startInclusive,
    endExclusive: "9999-12-31",
  });
  const now = recordedBalance(ctx.record.transactions, ctx.asOf);
  const text = h.t("coach.balance.summary", { balance: h.money(now?.balanceCents ?? 0) });
  return {
    tool: "balance",
    text,
    card: {
      title: h.t("coach.balance.title"),
      summary: text,
      chart: {
        kind: "line",
        points: series.map((m) => ({
          label: formatMonth(m.month, ctx.locale),
          valueCents: m.balanceCents,
        })),
      },
      basis: h.basis(period),
    },
    facts: [{ label: h.t("dashboard.balance"), valueCents: now?.balanceCents ?? 0 }],
    followUps: [h.t("chat.suggest.safe"), h.t("chat.suggest.bills")],
  };
}

/** The three baskets, with the part of everyday spending that was a free choice. */
export function basketsTool(ctx: CoachContext, input: { period?: PeriodKey }): ToolResult {
  const h = makeHelpers(ctx);
  const period = resolvePeriod(input.period, ctx.asOf);
  const breakdown = basketBreakdown(ctx.record.transactions, period);
  const get = (name: string) => breakdown.baskets.find((b) => b.basket === name);
  const everyday = get("everyday");
  const text = h.t("coach.baskets.summary", {
    period: h.periodLabel(period),
    regular: h.money(get("regular")?.totalCents ?? 0),
    irregular: h.money(get("irregular")?.totalCents ?? 0),
    everyday: h.money(everyday?.totalCents ?? 0),
    choice: h.money(everyday?.byNecessity.discretionary ?? 0),
  });
  const count = breakdown.baskets.reduce((sum, b) => sum + b.transactionCount, 0);
  return {
    tool: "baskets",
    text,
    card: {
      title: h.t("coach.baskets.title"),
      summary: text,
      chart: {
        kind: "donut",
        points: breakdown.baskets.map((b) => ({
          label: h.t(`basket.${b.basket}`),
          valueCents: b.totalCents,
        })),
      },
      basis: h.basis(period),
    },
    facts: breakdown.baskets.map((b) => ({
      label: h.t(`basket.${b.basket}`),
      valueCents: b.totalCents,
    })),
    evidence: h.evidence(period, count),
    lesson: h.t("basket.everyday.lesson"),
    followUps: [h.t("chat.suggest.whatif"), h.t("chat.suggest.safe")],
  };
}

export type ForecastOverrides = Partial<
  Pick<
    ForecastAssumptions,
    "horizonDays" | "protectedCents" | "includeExpectedIncome" | "otherOutflowsCents"
  >
>;

export function forecastFor(ctx: CoachContext, overrides: ForecastOverrides = {}) {
  const horizon = Math.min(31, Math.max(1, overrides.horizonDays ?? 7));
  const suggested = suggestAssumptions(ctx.record.transactions, ctx.asOf, horizon);
  // Only values that were actually given replace a suggestion: an override that is present but
  // undefined must not blank out the suggested figure.
  const given = Object.fromEntries(
    Object.entries(overrides).filter(([, value]) => value !== undefined),
  ) as ForecastOverrides;
  return estimateSafeToSpend(
    ctx.record.transactions,
    ctx.asOf,
    {
      ...suggested,
      // Money set aside for goals is not there to spend, unless the customer says otherwise.
      protectedCents: ctx.record.earmarkedCents ?? 0,
      ...given,
      horizonDays: horizon,
    },
    ["essentialDailyCents", "irregularReserveCents", "bills", "spreadBillsDailyCents"],
  );
}

/** What can be spent without the balance dropping below bills, essentials and a reserve. */
export function safeToSpendTool(ctx: CoachContext, input: ForecastOverrides): ToolResult {
  const h = makeHelpers(ctx);
  const result = forecastFor(ctx, input);
  const days = result.assumptions.horizonDays;
  if (result.status === "insufficient_data") {
    return {
      tool: "safe_to_spend",
      text: h.t("coach.safe.insufficient"),
      facts: [],
      followUps: [],
    };
  }
  const b = result.breakdown;
  const purchase = b.otherOutflowsCents;
  const params = {
    available: h.money(result.availableCents),
    shortfall: h.money(result.shortfallCents),
    balance: h.money(result.balanceCents),
    purchase: h.money(purchase),
    days,
  };
  // With a planned purchase the question is "can I afford this?", so the answer says what is left
  // after it, or how far short it falls.
  const text =
    purchase > 0
      ? h.t(result.status === "ok" ? "coach.afford.ok" : "coach.afford.short", params)
      : h.t(result.status === "ok" ? "coach.safe.ok" : "coach.safe.shortfall", params);
  const rows: [MessageKey, number][] = [
    ["coach.safe.row.balance", result.balanceCents],
    ["coach.safe.row.bills", b.billsCents + b.spreadBillsCents],
    ["coach.safe.row.essentials", b.essentialsCents],
    ["coach.safe.row.reserve", b.irregularReserveCents],
    ["coach.safe.row.protected", b.protectedCents],
    ["coach.safe.row.purchase", purchase],
    [purchase > 0 ? "coach.safe.row.left" : "coach.safe.row.available", result.availableCents],
  ];
  const shown = rows.filter(([, cents], index) => cents > 0 || index === rows.length - 1);
  return {
    tool: "safe_to_spend",
    text,
    card: {
      title: h.t(purchase > 0 ? "coach.afford.title" : "coach.safe.title"),
      summary: text,
      chart: {
        kind: "bar",
        points: shown.map(([key, cents]) => ({ label: h.t(key), valueCents: cents })),
      },
      basis: h.t("coach.safe.basis"),
    },
    facts: [
      ...shown.map(([key, cents]) => ({ label: h.t(key), valueCents: cents })),
      ...(result.shortfallCents > 0
        ? [{ label: h.t("coach.safe.row.short"), valueCents: result.shortfallCents }]
        : []),
    ],
    lesson: h.t("basket.irregular.lesson"),
    followUps: [h.t("chat.suggest.bills"), h.t("chat.suggest.whatif")],
  };
}

/** What a percentage cut to one kind of spending would have been worth. Hypothetical. */
export function whatIfTool(
  ctx: CoachContext,
  input: { target: TargetKey; percent: number; period?: PeriodKey },
): ToolResult {
  const h = makeHelpers(ctx);
  const percent = Math.min(100, Math.max(0, Math.round(input.percent)));
  const period = resolvePeriod(input.period, ctx.asOf);
  const scenario = simulateReduction(
    ctx.record.transactions,
    filterOf(input.target, period),
    percent * 100,
  );
  const name = h.targetLabel(input.target);
  if (scenario.transactionCount === 0) {
    return {
      tool: "what_if",
      text: h.t("coach.none", { period: h.periodLabel(period) }),
      facts: [],
      followUps: [],
    };
  }
  const text = h.t("coach.whatif.summary", {
    category: name,
    percent,
    saving: h.money(scenario.savingCents),
    period: h.periodLabel(period),
    annual: h.money(scenario.annualisedSavingCents),
  });
  const rows: [MessageKey, number][] = [
    ["coach.whatif.row.now", scenario.baselineCents],
    ["coach.whatif.row.after", scenario.resultingCents],
    ["coach.whatif.row.saving", scenario.savingCents],
  ];
  return {
    tool: "what_if",
    text,
    card: {
      title: h.t("coach.whatif.title", { category: name, percent }),
      summary: text,
      chart: {
        kind: "bar",
        points: rows.map(([key, cents]) => ({ label: h.t(key), valueCents: cents })),
      },
      basis: h.basis(period),
    },
    facts: rows.map(([key, cents]) => ({ label: h.t(key), valueCents: cents })),
    evidence: h.evidence(period, scenario.transactionCount, input.target),
    followUps: [h.t("chat.suggest.safe"), h.t("chat.suggest.peers")],
  };
}

function benchmarkMetric(
  target?: TargetKey,
): { metric: string; label: (h: ReturnType<typeof makeHelpers>) => string } | null {
  if (!target)
    return { metric: "consumption", label: (h) => h.t("coach.peers.metric.consumption") };
  const category = TARGETS[target].categories?.[0];
  if (!category) return null;
  return { metric: `category:${category}`, label: (h) => h.targetLabel(target) };
}

/** How the customer's typical month compares with others of a similar age in the dataset. */
export function peersTool(ctx: CoachContext, input: { target?: TargetKey }): ToolResult {
  const h = makeHelpers(ctx);
  const spec = benchmarkMetric(input.target) ?? benchmarkMetric();
  const band = ageBand(ctx.record.profile.age);
  const row =
    ctx.benchmarks.find((r) => r.ageBand === band && r.metric === spec?.metric) ??
    ctx.benchmarks.find((r) => r.ageBand === "all" && r.metric === spec?.metric);
  if (!spec || !row)
    return { tool: "peers", text: h.t("coach.fallback"), facts: [], followUps: [] };

  const value = customerMetrics(ctx.record.transactions, ctx.asOf).get(spec.metric) ?? 0;
  const params = {
    metric: spec.label(h),
    value: h.money(value),
    band: row.ageBand,
    low: h.money(row.p25Cents),
    high: h.money(row.p75Cents),
  };
  const text = h.t(`coach.peers.summary.${positionAgainst(value, row)}`, params);
  const rows: [MessageKey, number][] = [
    ["coach.peers.row.you", value],
    ["coach.peers.row.low", row.p25Cents],
    ["coach.peers.row.mid", row.p50Cents],
    ["coach.peers.row.high", row.p75Cents],
  ];
  const result: ToolResult = {
    tool: "peers",
    text,
    card: {
      title: h.t("coach.peers.title"),
      summary: text,
      chart: {
        kind: "bar",
        points: rows.map(([key, cents]) => ({ label: h.t(key), valueCents: cents })),
      },
      basis: h.t("coach.peers.basis", { count: row.groupSize, band: row.ageBand }),
    },
    facts: rows.map(([key, cents]) => ({ label: h.t(key), valueCents: cents })),
    followUps: [h.t("chat.suggest.spender"), h.t("chat.suggest.whatif")],
  };

  const category = spec.metric.startsWith("category:") ? spec.metric.slice(9) : null;
  const national = category ? nationalAverage(category, ctx.record.profile.age) : null;
  if (category && national) {
    const context = h.t("coach.statfin.summary", {
      average: h.money(national.cents),
      category: h.targetLabel(category),
      band: national.ageGroup,
      year: national.year,
      value: h.money(value),
    });
    result.lesson = `${context} ${h.t("coach.statfin.basis", { year: national.year })}`;
    result.facts.push({ label: `Statistics Finland ${national.year}`, valueCents: national.cents });
  }
  return result;
}

/** A description of spending patterns. Describes the spending, never the person. */
export function profileTool(ctx: CoachContext): ToolResult {
  const h = makeHelpers(ctx);
  const period = resolvePeriod("last_3_months", ctx.asOf);
  const breakdown = basketBreakdown(ctx.record.transactions, period);
  const total = Math.max(1, breakdown.consumptionCents);
  const share = (name: string): number =>
    Math.round(((breakdown.baskets.find((b) => b.basket === name)?.totalCents ?? 0) / total) * 100);

  const choices = new Map<string, number>();
  let count = 0;
  for (const tx of ctx.record.transactions) {
    if (!isConsumption(tx) || tx.date < period.startInclusive || tx.date >= period.endExclusive)
      continue;
    count += 1;
    if (classify(tx).necessity !== "discretionary") continue;
    const key = tx.mcc === "4121" ? "taxi" : tx.mcc === "5814" ? "cafes" : tx.category;
    choices.set(key, (choices.get(key) ?? 0) - tx.amountCents);
  }
  const top = [...choices.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const text = h.t("coach.profile.summary", {
    regularShare: share("regular"),
    irregularShare: share("irregular"),
    everydayShare: share("everyday"),
    top: top
      .slice(0, 3)
      .map(([key, cents]) => `${h.targetLabel(key)} (${h.money(Math.round(cents / 3))})`)
      .join(", "),
  });
  return {
    tool: "profile",
    text,
    card: {
      title: h.t("coach.profile.title"),
      summary: text,
      chart: {
        kind: "bar",
        points: top.map(([key, cents]) => ({
          label: h.targetLabel(key),
          valueCents: Math.round(cents / 3),
        })),
      },
      basis: h.basis(period),
    },
    facts: top.map(([key, cents]) => ({
      label: h.targetLabel(key),
      valueCents: Math.round(cents / 3),
    })),
    evidence: h.evidence(period, count),
    lesson: h.t("basket.everyday.lesson"),
    followUps: [h.t("chat.suggest.whatif"), h.t("chat.suggest.peers")],
  };
}

/** Regular bills and income, suggested from history. */
export function recurringTool(ctx: CoachContext): ToolResult {
  const h = makeHelpers(ctx);
  const bills = detectRegularBills(ctx.record.transactions, ctx.asOf);
  const income = detectIncome(ctx.record.transactions, ctx.asOf);
  const total = bills.reduce((sum, bill) => sum + bill.typicalMonthlyCents, 0);
  let text = h.t("coach.recurring.summary", {
    list: bills
      .map((bill) => `${h.targetLabel(bill.category)} ${h.money(bill.typicalMonthlyCents)}`)
      .join(", "),
    total: h.money(total),
  });
  if (income.typicalDays.length > 0) {
    text += ` ${h.t("coach.recurring.income", {
      days: income.typicalDays.map((day) => (day === 31 ? "30–31" : String(day))).join(" / "),
      amount: h.money(income.typicalCents),
    })}`;
  }
  return {
    tool: "recurring",
    text,
    card: {
      title: h.t("coach.recurring.title"),
      summary: text,
      chart: {
        kind: "bar",
        points: bills.map((bill) => ({
          label: h.targetLabel(bill.category),
          valueCents: bill.typicalMonthlyCents,
        })),
      },
      basis: h.t("coach.recurring.basis"),
    },
    facts: bills.map((bill) => ({
      label: h.targetLabel(bill.category),
      valueCents: bill.typicalMonthlyCents,
    })),
    lesson: h.t("basket.regular.lesson"),
    followUps: [h.t("chat.suggest.safe"), h.t("chat.suggest.where")],
  };
}

/** Where income went in a period: bills, essentials, everyday spending, investing, and what was left. */
export function flowTool(ctx: CoachContext, input: { period?: PeriodKey }): ToolResult {
  const h = makeHelpers(ctx);
  const period = resolvePeriod(input.period, ctx.asOf);
  const flow = cashFlow(ctx.record.transactions, period);
  const breakdown = basketBreakdown(ctx.record.transactions, period);
  const income = flow.salaryCents + flow.otherIncomeCents + flow.investmentWithdrawnCents;
  const basket = (name: string): number =>
    breakdown.baskets.find((b) => b.basket === name)?.totalCents ?? 0;
  const out = flow.consumptionCents + flow.investedCents + flow.salarySweepCents;
  const destinations: [MessageKey, number][] = [
    ["basket.regular", basket("regular")],
    ["basket.irregular", basket("irregular")],
    ["basket.everyday", basket("everyday") + basket("unclassified")],
    ["coach.flow.invested", flow.investedCents],
    ["coach.flow.transferred", flow.salarySweepCents],
    ["coach.flow.left", Math.max(0, income - out)],
  ];
  const points = destinations
    .filter(([, cents]) => cents > 0)
    .map(([key, cents]) => ({ label: h.t(key), valueCents: cents }));
  const count = breakdown.baskets.reduce((sum, b) => sum + b.transactionCount, 0);
  if (income === 0 && count === 0) {
    return {
      tool: "flow",
      text: h.t("coach.none", { period: h.periodLabel(period) }),
      facts: [],
      followUps: [],
    };
  }
  const text = h.t(income >= out ? "coach.flow.summary" : "coach.flow.summaryOver", {
    period: h.periodLabel(period),
    income: h.money(income),
    spent: h.money(flow.consumptionCents),
    left: h.money(Math.abs(income - out)),
  });
  return {
    tool: "flow",
    text,
    card: {
      title: h.t("coach.flow.title"),
      summary: text,
      chart: {
        kind: "flow",
        source: { label: h.t("coach.flow.income"), valueCents: income },
        points,
      },
      basis: h.basis(period),
    },
    facts: [{ label: h.t("coach.flow.income"), valueCents: income }, ...points],
    evidence: h.evidence(period, count),
    lesson: h.t("basket.regular.lesson"),
    followUps: [h.t("chat.suggest.safe"), h.t("chat.suggest.whatif")],
  };
}

/**
 * The customer's typical month as a plan: what share of income goes to each
 * of five slices. This is the starting point for a plan they can keep, change
 * and share (as percentages only) on the Plans page.
 */
export function planTool(ctx: CoachContext): ToolResult {
  const h = makeHelpers(ctx);
  const period = resolvePeriod("last_3_months", ctx.asOf);
  const actual = actualSplit(ctx.record.transactions, ctx.asOf);
  const spent = SLICES.reduce((sum, key) => sum + actual.cents[key], 0);
  if (actual.incomeCents === 0 && spent === 0) {
    return {
      tool: "plan",
      text: h.t("coach.none", { period: h.periodLabel(period) }),
      facts: [],
      followUps: [],
    };
  }
  const points = SLICES.filter((key) => actual.cents[key] > 0).map((key) => ({
    label: `${h.t(`plan.slice.${key}` as MessageKey)} ${actual.percent[key]} %`,
    valueCents: actual.cents[key],
  }));
  const text = h.t("coach.plan.summary", {
    bills: actual.percent.bills,
    essentials: actual.percent.essentials,
    everyday: actual.percent.everyday,
    saving: actual.percent.saving,
    investing: actual.percent.investing,
  });
  return {
    tool: "plan",
    text,
    card: {
      title: h.t("coach.plan.title"),
      summary: text,
      chart: { kind: "donut", points },
      basis: h.basis(period),
    },
    facts: [{ label: h.t("coach.flow.income"), valueCents: actual.incomeCents }, ...points],
    lesson: h.t("coach.plan.lesson"),
    followUps: [h.t("chat.suggest.whatif"), h.t("chat.suggest.recommend")],
  };
}

/** Subscription-like payments: the same merchant, about monthly, about the same amount. */
export function subscriptionsTool(ctx: CoachContext): ToolResult {
  const h = makeHelpers(ctx);
  const found = detectSubscriptions(ctx.record.transactions, ctx.asOf);
  const period = resolvePeriod("last_6_months", ctx.asOf);
  if (found.length === 0) {
    return {
      tool: "subscriptions",
      text: h.t("coach.subscriptions.none"),
      facts: [],
      lesson: h.t("coach.subscriptions.lesson"),
      followUps: [h.t("chat.suggest.bills")],
    };
  }
  const name = (item: (typeof found)[number]): string => {
    const kind = h.targetLabel(item.category);
    // The data has no payee names: the last characters of the merchant number tell two apart.
    return `${kind} · ${item.merchantId.slice(-4)}`;
  };
  const points = found
    .slice(0, 8)
    .map((item) => ({ label: name(item), valueCents: item.typicalCents }));
  const monthly = found.reduce((sum, item) => sum + item.typicalCents, 0);
  const text = h.t("coach.subscriptions.summary", {
    count: found.length,
    monthly: h.money(monthly),
    yearly: h.money(monthly * 12),
  });
  return {
    tool: "subscriptions",
    text,
    card: {
      title: h.t("coach.subscriptions.title"),
      summary: text,
      chart: { kind: "hbar", points },
      basis: h.basis(period),
    },
    facts: [
      { label: h.t("coach.subscriptions.monthly"), valueCents: monthly },
      { label: h.t("coach.subscriptions.yearly"), valueCents: monthly * 12 },
      ...points,
    ],
    lesson: h.t("coach.subscriptions.lesson"),
    followUps: [h.t("chat.suggest.bills"), h.t("chat.suggest.recommend")],
  };
}

/** The balance of each account the customer has, the bank's own and any linked from elsewhere. */
export function accountsTool(ctx: CoachContext): ToolResult {
  const h = makeHelpers(ctx);
  const accounts = ctx.record.accounts ?? [
    {
      id: "main",
      kind: "main" as const,
      balanceCents: recordedBalance(ctx.record.transactions, ctx.asOf)?.balanceCents ?? 0,
      included: true,
      simulated: false,
    },
  ];
  const label = (account: (typeof accounts)[number]): string =>
    account.simulated
      ? `${account.nickname || h.t(`accounts.kind.${account.kind}` as MessageKey)} (${h.t("accounts.simulated")})`
      : h.t("accounts.main");
  const points = accounts.map((account) => ({
    label: label(account),
    valueCents: account.balanceCents,
  }));
  const total = accounts
    .filter((account) => account.included)
    .reduce((sum, account) => sum + account.balanceCents, 0);
  const text =
    accounts.length === 1
      ? h.t("coach.accounts.single", { balance: h.money(total) })
      : h.t("coach.accounts.summary", { count: accounts.length, total: h.money(total) });
  return {
    tool: "accounts",
    text,
    card: {
      title: h.t("coach.accounts.title"),
      summary: text,
      chart: { kind: "table", points },
      basis: h.basis(resolvePeriod("this_month", ctx.asOf)),
    },
    facts: [{ label: h.t("coach.accounts.total"), valueCents: total }, ...points],
    lesson: h.t("coach.accounts.lesson"),
    followUps: [h.t("chat.suggest.safe")],
  };
}

export function fallbackResult(ctx: CoachContext): ToolResult {
  const h = makeHelpers(ctx);
  return {
    tool: "none",
    text: h.t("coach.fallback"),
    facts: [],
    followUps: [h.t("chat.suggest.where"), h.t("chat.suggest.safe"), h.t("chat.suggest.whatif")],
  };
}
