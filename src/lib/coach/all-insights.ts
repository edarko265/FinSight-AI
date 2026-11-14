import "server-only";

import { activeAnnouncements, localise } from "@/lib/admin/announcements";
import { budgetStatuses } from "@/lib/coach/budgets";
import type { SessionContext } from "@/lib/coach/context";
import { listGoalPlans } from "@/lib/coach/goals";
import { buildInsights, type Insight } from "@/lib/coach/insights";
import { actualSplit, SLICES } from "@/lib/coach/plan-math";
import { listPlans } from "@/lib/coach/plans";
import { formatMoney } from "@/lib/i18n/config";
import { translate, type MessageKey } from "@/lib/i18n/translate";

/** A slice has drifted when it is this many percentage points away from the plan. */
const DRIFT_POINTS = 5;

/**
 * Everything worth the customer's attention: staff announcements, a monthly
 * reminder for each savings goal, then the insights calculated from their own
 * transactions.
 */
export async function allInsights(ctx: SessionContext): Promise<Insight[]> {
  // Four independent reads, made side by side rather than one after another.
  const [announcements, goalPlans, plans, budgets] = await Promise.all([
    activeAnnouncements(),
    listGoalPlans(ctx),
    listPlans(ctx),
    budgetStatuses(ctx),
  ]);
  const notices: Insight[] = announcements.map((notice) => ({
    id: `announcement-${notice.id}-${notice.updatedAt}`,
    severity: notice.severity,
    // In the customer's language where staff wrote one.
    ...localise(notice, ctx.locale),
    ask: "",
  }));

  // One reminder per goal per month, so it comes back each month until the goal is removed.
  const month = ctx.asOf.slice(0, 7);
  const reminders: Insight[] = goalPlans.map((plan) => ({
    id: `goal-${plan.goal.id}-${month}`,
    severity: plan.fit === "hard" ? "warning" : "info",
    title: translate(ctx.locale, "insight.goal.title", { name: plan.goal.name }),
    body: translate(ctx.locale, `insight.goal.body.${plan.fit}`, {
      monthly: formatMoney(plan.goal.monthlyCents, ctx.locale),
      room: formatMoney(plan.roomCents, ctx.locale),
    }),
    ask: translate(ctx.locale, "chat.suggest.recommend"),
  }));

  // The plan the customer follows: say so when the month has drifted from it.
  const drift: Insight[] = [];
  const followed = plans.find((plan) => plan.tracked);
  if (followed) {
    const actual = actualSplit(ctx.record.transactions, ctx.asOf).percent;
    for (const slice of SLICES) {
      const gap = actual[slice] - followed.split[slice];
      // Spending slices matter when they run over; saving and investing when they fall short.
      const over = slice === "bills" || slice === "essentials" || slice === "everyday";
      if (over ? gap < DRIFT_POINTS : gap > -DRIFT_POINTS) continue;
      drift.push({
        id: `plan-${followed.id}-${slice}-${month}`,
        severity: slice === "essentials" || slice === "bills" ? "info" : "warning",
        title: translate(
          ctx.locale,
          over ? "insight.plan.over.title" : "insight.plan.under.title",
          {
            slice: translate(ctx.locale, `plan.slice.${slice}`),
          },
        ),
        body: translate(ctx.locale, "insight.plan.body", {
          actual: actual[slice],
          planned: followed.split[slice],
          plan: followed.name,
        }),
        ask: translate(ctx.locale, "plans.ask"),
      });
    }
  }

  // Monthly limits that are nearly or fully used.
  const limits: Insight[] = budgets
    .filter((budget) => budget.level !== "ok")
    .map((budget) => ({
      id: `budget-${budget.id}-${month}-${budget.level}`,
      severity: budget.level === "over" ? ("warning" as const) : ("info" as const),
      title: translate(
        ctx.locale,
        budget.level === "over" ? "insight.budget.over.title" : "insight.budget.close.title",
        {
          category: translate(ctx.locale, `cat.${budget.target}` as MessageKey),
        },
      ),
      body: translate(ctx.locale, "insight.budget.body", {
        spent: formatMoney(budget.spentCents, ctx.locale),
        limit: formatMoney(budget.cents, ctx.locale),
        percent: budget.percent,
      }),
      ask: translate(ctx.locale, "chat.suggest.whatif"),
    }));

  return [...notices, ...limits, ...drift, ...reminders, ...buildInsights(ctx)];
}
