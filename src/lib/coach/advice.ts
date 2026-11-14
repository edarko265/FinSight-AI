import { ageBand, customerMetrics } from "@/lib/analytics/benchmarks";
import { classify, isConsumption } from "@/lib/analytics/classify";
import { completedMonths, inPeriod, lastCompletedMonth } from "@/lib/analytics/periods";
import { detectRegularBills } from "@/lib/analytics/recurrence";
import {
  basketBreakdown,
  cashFlow,
  recordedBalance,
  summariseSpending,
} from "@/lib/analytics/spending";
import { mean } from "@/lib/analytics/stats";
import { forecastFor, type CoachContext, type ToolResult } from "@/lib/coach/tools";
import { formatMoney } from "@/lib/i18n/config";
import { hasMessage, translate, type MessageKey, type MessageParams } from "@/lib/i18n/translate";

/**
 * Advice the coach can stand behind: every suggestion is calculated from the
 * customer's own history and carries an estimate of what it is worth a month.
 * Essentials are never offered up as savings.
 */
const helpers = (ctx: CoachContext) => ({
  t: (key: MessageKey, params?: MessageParams): string => translate(ctx.locale, key, params),
  money: (cents: number): string => formatMoney(cents, ctx.locale),
  label: (category: string): string => {
    const key = `cat.${category}`;
    return hasMessage(key) ? translate(ctx.locale, key) : category;
  },
});

/** Average monthly money in minus spending over the last six completed months. */
export function monthlyRoom(ctx: CoachContext): {
  roomCents: number;
  incomeCents: number;
  spendingCents: number;
} {
  const months = completedMonths(ctx.asOf, 6);
  const flows = months.map((month) => cashFlow(ctx.record.transactions, month));
  const incomeCents = mean(flows.map((flow) => flow.salaryCents + flow.otherIncomeCents));
  const spendingCents = mean(flows.map((flow) => flow.consumptionCents));
  return { roomCents: incomeCents - spendingCents, incomeCents, spendingCents };
}

/** Average monthly free-choice spending by category over the last three completed months. */
export function discretionaryByCategory(
  ctx: CoachContext,
): { category: string; monthlyCents: number }[] {
  const months = completedMonths(ctx.asOf, 3);
  const window = {
    startInclusive: months[0]?.startInclusive ?? ctx.asOf,
    endExclusive: months[months.length - 1]?.endExclusive ?? ctx.asOf,
  };
  const totals = new Map<string, number>();
  for (const tx of ctx.record.transactions) {
    if (!isConsumption(tx) || !inPeriod(tx.date, window)) continue;
    if (classify(tx).necessity !== "discretionary") continue;
    totals.set(tx.category, (totals.get(tx.category) ?? 0) - tx.amountCents);
  }
  return [...totals.entries()]
    .map(([category, cents]) => ({ category, monthlyCents: Math.round(cents / months.length) }))
    .sort((a, b) => b.monthlyCents - a.monthlyCents);
}

export interface Recommendation {
  id: string;
  title: string;
  body: string;
  /** Estimated monthly value in cents; 0 when the benefit is protection rather than saving. */
  monthlyValueCents: number;
}

export function buildRecommendations(ctx: CoachContext): Recommendation[] {
  const { t, money, label } = helpers(ctx);
  const txs = ctx.record.transactions;
  const out: Recommendation[] = [];
  const metrics = customerMetrics(txs, ctx.asOf);
  const band = ageBand(ctx.record.profile.age);

  // 1. Free-choice categories above the typical range for the age group: closing half the gap to the middle.
  for (const { category } of discretionaryByCategory(ctx)) {
    const row = ctx.benchmarks.find(
      (r) => r.ageBand === band && r.metric === `category:${category}`,
    );
    const value = metrics.get(`category:${category}`) ?? 0;
    if (!row || value <= row.p75Cents) continue;
    const saving = Math.round((value - row.p50Cents) / 2);
    out.push({
      id: `peers-${category}`,
      title: t("advice.peers.title", { category: label(category) }),
      body: t("advice.peers.body", {
        category: label(category),
        value: money(value),
        middle: money(row.p50Cents),
        saving: money(saving),
      }),
      monthlyValueCents: saving,
    });
  }

  // 2. The largest free-choice category: a modest 15% trim.
  const top = discretionaryByCategory(ctx)[0];
  if (top && top.monthlyCents > 5000 && !out.some((item) => item.id === `peers-${top.category}`)) {
    const saving = Math.round(top.monthlyCents * 0.15);
    out.push({
      id: `trim-${top.category}`,
      title: t("advice.trim.title", { category: label(top.category) }),
      body: t("advice.trim.body", {
        category: label(top.category),
        value: money(top.monthlyCents),
        saving: money(saving),
      }),
      monthlyValueCents: saving,
    });
  }

  // 3. Small purchases that slip through the fingers.
  const last = lastCompletedMonth(ctx.asOf);
  let smallCents = 0;
  let smallCount = 0;
  for (const tx of txs) {
    if (!isConsumption(tx) || !inPeriod(tx.date, last) || -tx.amountCents >= 1500) continue;
    if (classify(tx).necessity !== "discretionary") continue;
    smallCents -= tx.amountCents;
    smallCount += 1;
  }
  if (smallCount >= 8) {
    const saving = Math.round(smallCents * 0.25);
    out.push({
      id: "small",
      title: t("advice.small.title"),
      body: t("advice.small.body", {
        count: smallCount,
        amount: money(smallCents),
        saving: money(saving),
      }),
      monthlyValueCents: saving,
    });
  }

  // 4. Reserve for irregular essentials.
  const year = completedMonths(ctx.asOf, 12);
  const irregular = basketBreakdown(txs, {
    startInclusive: year[0]?.startInclusive ?? ctx.asOf,
    endExclusive: year[year.length - 1]?.endExclusive ?? ctx.asOf,
  }).baskets.find((basket) => basket.basket === "irregular");
  const reserve = Math.round((irregular?.byNecessity.essential ?? 0) / 12);
  if (reserve > 0) {
    out.push({
      id: "reserve",
      title: t("advice.reserve.title"),
      body: t("advice.reserve.body", { amount: money(reserve) }),
      monthlyValueCents: 0,
    });
  }

  // 5. A buffer of one month of regular bills.
  const bills = detectRegularBills(txs, ctx.asOf).reduce(
    (sum, bill) => sum + bill.typicalMonthlyCents,
    0,
  );
  const balance = recordedBalance(txs, ctx.asOf)?.balanceCents ?? 0;
  if (bills > 0 && balance < bills) {
    out.push({
      id: "buffer",
      title: t("advice.buffer.title"),
      body: t("advice.buffer.body", { bills: money(bills), gap: money(bills - balance) }),
      monthlyValueCents: 0,
    });
  }

  // 6. Money left over each month that is not being put to work.
  const room = monthlyRoom(ctx);
  const invested = metrics.get("invested") ?? 0;
  if (room.roomCents > 10_000 && invested === 0) {
    out.push({
      id: "idle",
      title: t("advice.idle.title"),
      body: t("advice.idle.body", { room: money(room.roomCents) }),
      monthlyValueCents: 0,
    });
  }

  return out.sort((a, b) => b.monthlyValueCents - a.monthlyValueCents).slice(0, 5);
}

export function recommendTool(ctx: CoachContext): ToolResult {
  const { t, money } = helpers(ctx);
  const items = buildRecommendations(ctx);
  const total = items.reduce((sum, item) => sum + item.monthlyValueCents, 0);
  if (items.length === 0) {
    return {
      tool: "recommend",
      text: t("advice.none"),
      facts: [],
      followUps: [t("chat.suggest.where")],
    };
  }
  const text = `${t("advice.summary", { count: items.length, total: money(total) })} ${items
    .slice(0, 3)
    .map((item) => item.body)
    .join(" ")}`;
  const valued = items.filter((item) => item.monthlyValueCents > 0);
  return {
    tool: "recommend",
    text,
    card:
      valued.length > 0
        ? {
            title: t("advice.title"),
            summary: text,
            chart: {
              kind: "bar",
              points: valued.map((item) => ({
                label: item.title,
                valueCents: item.monthlyValueCents,
              })),
            },
            basis: t("advice.basis"),
          }
        : undefined,
    facts: valued.map((item) => ({ label: item.title, valueCents: item.monthlyValueCents })),
    lesson: t("basket.everyday.lesson"),
    followUps: [t("chat.suggest.goal"), t("chat.suggest.whatif")],
  };
}

export interface Goal {
  id: string;
  name: string;
  targetCents: number;
  months: number;
  monthlyCents: number;
  /** The demo date the goal was set on. */
  createdOn: string;
}

export interface GoalPlan {
  goal: Goal;
  roomCents: number;
  fromCutsCents: number;
  fit: "fits" | "stretch" | "hard";
  cuts: { category: string; percent: number; savingCents: number }[];
}

/** How a goal could be funded: from the usual monthly room first, then from trims to free-choice spending. */
export function planGoal(ctx: CoachContext, goal: Goal): GoalPlan {
  const room = Math.max(0, monthlyRoom(ctx).roomCents);
  const gap = Math.max(0, goal.monthlyCents - room);
  const cuts: GoalPlan["cuts"] = [];
  let covered = 0;
  for (const { category, monthlyCents } of discretionaryByCategory(ctx)) {
    if (covered >= gap) break;
    for (const percent of [10, 20, 30]) {
      const saving = Math.round((monthlyCents * percent) / 100);
      if (covered + saving >= gap || percent === 30) {
        cuts.push({ category, percent, savingCents: saving });
        covered += saving;
        break;
      }
    }
  }
  return {
    goal,
    roomCents: room,
    fromCutsCents: gap === 0 ? 0 : covered,
    fit: gap === 0 ? "fits" : covered >= gap ? "stretch" : "hard",
    cuts: gap === 0 ? [] : cuts,
  };
}

export function goalResult(ctx: CoachContext, plan: GoalPlan, created: boolean): ToolResult {
  const { t, money, label } = helpers(ctx);
  const { goal } = plan;
  const params = {
    name: goal.name,
    target: money(goal.targetCents),
    months: goal.months,
    monthly: money(goal.monthlyCents),
    room: money(plan.roomCents),
    cuts: plan.cuts
      .map((cut) => `${label(cut.category)} −${cut.percent} % (${money(cut.savingCents)})`)
      .join(", "),
  };
  const text = `${t(created ? "goal.created" : "goal.exists", params)} ${t(`goal.fit.${plan.fit}`, params)}`;
  const rows: [MessageKey, number][] = [
    ["goal.row.needed", goal.monthlyCents],
    ["goal.row.room", plan.roomCents],
    ["goal.row.cuts", plan.fromCutsCents],
  ];
  return {
    tool: "goal",
    text,
    card: {
      title: goal.name,
      summary: text,
      chart: {
        kind: "bar",
        points: rows
          .filter(([, cents]) => cents > 0)
          .map(([key, cents]) => ({ label: t(key), valueCents: cents })),
      },
      basis: t("goal.basis"),
    },
    facts: rows.map(([key, cents]) => ({ label: t(key), valueCents: cents })),
    followUps: [t("chat.suggest.recommend"), t("chat.suggest.safe")],
  };
}

export interface Achievement {
  id: string;
  title: string;
  body: string;
  points: number;
  earned: boolean;
}

export interface RewardsSummary {
  points: number;
  level: "starter" | "bronze" | "silver" | "gold";
  nextLevelAt: number | null;
  achievements: Achievement[];
  coupons: { id: string; title: string; body: string; unlockAt: number; unlocked: boolean }[];
}

/** Points and coupon thresholds. Staff can change these from the admin area. */
export interface RewardRules {
  points: {
    under_average: number;
    choice_down: number;
    buffer: number;
    surplus_streak: number;
    investing: number;
    goal: number;
  };
  couponUnlockAt: { coffee: number; groceries: number; voucher: number };
}

export const DEFAULT_REWARD_RULES: RewardRules = {
  points: {
    under_average: 75,
    choice_down: 75,
    buffer: 100,
    surplus_streak: 20,
    investing: 50,
    goal: 25,
  },
  couponUnlockAt: { coffee: 100, groceries: 200, voucher: 350 },
};

const LEVELS: [RewardsSummary["level"], number][] = [
  ["starter", 0],
  ["bronze", 100],
  ["silver", 200],
  ["gold", 350],
];

/**
 * Rewards for progress the data can show: spending below one's own average,
 * a buffer, a surplus, a goal. Measured against the customer's own past,
 * never against other people. The coupons are examples of what a bank's
 * bonus programme could attach.
 */
export function buildRewards(
  ctx: CoachContext,
  goalCount: number,
  rules: RewardRules = DEFAULT_REWARD_RULES,
): RewardsSummary {
  const { t, money } = helpers(ctx);
  const txs = ctx.record.transactions;
  const last = lastCompletedMonth(ctx.asOf);
  const previous = completedMonths(last.startInclusive, 3);
  const lastSpend = summariseSpending(txs, { period: last }).totalCents;
  const averageSpend = mean(
    previous.map((month) => summariseSpending(txs, { period: month }).totalCents),
  );

  const choice = (period: { startInclusive: string; endExclusive: string }): number =>
    basketBreakdown(txs, period).baskets.find((b) => b.basket === "everyday")?.byNecessity
      .discretionary ?? 0;
  const lastChoice = choice(last);
  const averageChoice = mean(previous.map(choice));

  const bills = detectRegularBills(txs, ctx.asOf).reduce(
    (sum, bill) => sum + bill.typicalMonthlyCents,
    0,
  );
  const balance = recordedBalance(txs, ctx.asOf)?.balanceCents ?? 0;

  const six = completedMonths(ctx.asOf, 6).map((month) => {
    const flow = cashFlow(txs, month);
    return flow.salaryCents + flow.otherIncomeCents - flow.consumptionCents;
  });
  let streak = 0;
  for (let index = six.length - 1; index >= 0 && (six[index] ?? 0) > 0; index -= 1) streak += 1;
  const invested = cashFlow(txs, last).investedCents;

  const achievements: Achievement[] = [
    {
      id: "under_average",
      title: t("reward.underAverage.title"),
      body: t("reward.underAverage.body", {
        amount: money(lastSpend),
        average: money(averageSpend),
      }),
      points: rules.points.under_average,
      earned: averageSpend > 0 && lastSpend < averageSpend,
    },
    {
      id: "choice_down",
      title: t("reward.choiceDown.title"),
      body: t("reward.choiceDown.body", {
        amount: money(lastChoice),
        average: money(averageChoice),
      }),
      points: rules.points.choice_down,
      earned: averageChoice > 0 && lastChoice <= averageChoice * 0.9,
    },
    {
      id: "buffer",
      title: t("reward.buffer.title"),
      body: t("reward.buffer.body", { bills: money(bills) }),
      points: rules.points.buffer,
      earned: bills > 0 && balance >= bills,
    },
    {
      id: "surplus_streak",
      title: t("reward.streak.title", { months: streak }),
      body: t("reward.streak.body"),
      points: Math.min(6, streak) * rules.points.surplus_streak,
      earned: streak >= 2,
    },
    {
      id: "investing",
      title: t("reward.investing.title"),
      body: t("reward.investing.body", { amount: money(invested) }),
      points: rules.points.investing,
      earned: invested > 0,
    },
    {
      id: "goal",
      title: t("reward.goal.title"),
      body: t("reward.goal.body"),
      points: rules.points.goal,
      earned: goalCount > 0,
    },
  ];
  const points = achievements.reduce((sum, item) => sum + (item.earned ? item.points : 0), 0);
  const level = [...LEVELS].reverse().find(([, at]) => points >= at)?.[0] ?? "starter";
  const next = LEVELS.find(([, at]) => at > points);
  const coupon = (id: string, unlockAt: number) => ({
    id,
    title: t(`reward.coupon.${id}.title` as MessageKey),
    body: t(`reward.coupon.${id}.body` as MessageKey),
    unlockAt,
    unlocked: points >= unlockAt,
  });
  return {
    points,
    level,
    nextLevelAt: next?.[1] ?? null,
    achievements,
    coupons: [
      coupon("coffee", rules.couponUnlockAt.coffee),
      coupon("groceries", rules.couponUnlockAt.groceries),
      coupon("voucher", rules.couponUnlockAt.voucher),
    ],
  };
}

const SAVE_HORIZON_DAYS = 30;

export interface SafeToSave {
  /** What could be set aside now without touching the next 30 days of commitments or usual spending. */
  safeCents: number;
  /** Free after bills, essentials, the reserve and money already set aside. */
  availableCents: number;
  /** The usual month of free-choice spending, left untouched. */
  keepCents: number;
  earmarkedCents: number;
  balanceCents: number;
  commitmentsCents: number;
  status: "ok" | "shortfall" | "insufficient_data";
}

/**
 * How much could be moved to savings now. It uses the same walk as safe to
 * spend, over 30 days, and then also leaves a usual month of free-choice
 * spending in place: saving should not mean an empty wallet next week.
 */
export function safeToSave(ctx: CoachContext, alsoMovingCents = 0): SafeToSave {
  const forecast = forecastFor(ctx, {
    horizonDays: SAVE_HORIZON_DAYS,
    otherOutflowsCents: alsoMovingCents,
  });
  const keepCents = discretionaryByCategory(ctx).reduce((sum, item) => sum + item.monthlyCents, 0);
  const b = forecast.breakdown;
  return {
    safeCents: forecast.status === "ok" ? Math.max(0, forecast.availableCents - keepCents) : 0,
    availableCents: forecast.availableCents,
    keepCents,
    earmarkedCents: ctx.record.earmarkedCents ?? 0,
    balanceCents: forecast.balanceCents,
    commitmentsCents:
      b.billsCents + b.spreadBillsCents + b.essentialsCents + b.irregularReserveCents,
    status: forecast.status,
  };
}

/** "How much could I save?", optionally testing a specific amount. Nothing is ever moved. */
export function saveTool(ctx: CoachContext, input: { amountCents?: number }): ToolResult {
  const { t, money } = helpers(ctx);
  const now = safeToSave(ctx);
  if (now.status === "insufficient_data") {
    return { tool: "safe_to_save", text: t("coach.save.noData"), facts: [], followUps: [] };
  }
  const amount = input.amountCents && input.amountCents > 0 ? Math.round(input.amountCents) : null;
  const after = amount ? safeToSave(ctx, amount) : null;
  const text = amount
    ? t(amount <= now.safeCents ? "coach.save.fits" : "coach.save.tooMuch", {
        amount: money(amount),
        safe: money(now.safeCents),
        left: money(Math.max(0, after?.safeCents ?? 0)),
      })
    : t(now.safeCents > 0 ? "coach.save.summary" : "coach.save.none", {
        safe: money(now.safeCents),
        keep: money(now.keepCents),
      });
  const points = [
    { label: t("coach.save.row.commitments"), valueCents: now.commitmentsCents },
    { label: t("coach.save.row.keep"), valueCents: now.keepCents },
    { label: t("coach.save.row.earmarked"), valueCents: now.earmarkedCents },
    { label: t("coach.save.row.safe"), valueCents: now.safeCents },
  ].filter((point) => point.valueCents > 0);
  return {
    tool: "safe_to_save",
    text,
    card: {
      title: t("coach.save.title"),
      summary: text,
      chart: { kind: "stack", points },
      basis: t("coach.save.basis", { days: SAVE_HORIZON_DAYS }),
    },
    facts: [{ label: t("dashboard.balance"), valueCents: now.balanceCents }, ...points],
    lesson: t("coach.save.lesson"),
    followUps: [t("chat.suggest.goal"), t("chat.suggest.safe")],
  };
}

/** The customer's own mortgage application as a short account, or a pointer to the guide. Teaching only. */
export function mortgageTool(ctx: CoachContext): ToolResult {
  const { t, money } = helpers(ctx);
  const story = ctx.record.mortgage;
  if (!story) {
    return {
      tool: "mortgage",
      text: t("coach.mortgage.general"),
      facts: [],
      lesson: t("coach.mortgage.lesson"),
      followUps: [t("chat.suggest.safe")],
    };
  }
  const o = story.outcome;
  const first = story.events[0]?.date ?? ctx.asOf;
  const last = story.events.at(-1)?.date ?? ctx.asOf;
  const days = Math.max(1, Math.round((Date.parse(last) - Date.parse(first)) / 86_400_000));
  const text = t(
    o.decision === "approved" ? "coach.mortgage.approved" : "coach.mortgage.rejected",
    {
      days,
      steps: story.events.length,
      price: money(o.priceCents),
      loan: money(o.loanCents),
      equity: money(o.equityCents),
      ltv: o.loanToValuePercent,
      reason: o.rejectionReason ? t(`mortgage.reason.${o.rejectionReason}` as MessageKey) : "",
    },
  );
  const points = [
    { label: t("mortgage.figure.loan"), valueCents: o.loanCents },
    { label: t("mortgage.figure.equity"), valueCents: o.equityCents },
  ];
  return {
    tool: "mortgage",
    text,
    card: {
      title: t("coach.mortgage.title"),
      summary: text,
      chart: { kind: "stack", points },
      basis: t("coach.mortgage.basis"),
    },
    facts: [
      { label: t("mortgage.figure.price"), valueCents: o.priceCents },
      ...points,
      { label: t("mortgage.figure.collateral"), valueCents: o.collateralCents },
      { label: t("mortgage.figure.income"), valueCents: o.requiredMonthlyIncomeCents },
    ],
    lesson: t("coach.mortgage.lesson"),
    followUps: [t("chat.suggest.safe")],
  };
}
