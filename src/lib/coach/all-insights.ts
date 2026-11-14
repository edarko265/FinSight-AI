import "server-only";

import { activeAnnouncements } from "@/lib/admin/announcements";
import type { SessionContext } from "@/lib/coach/context";
import { listGoalPlans } from "@/lib/coach/goals";
import { buildInsights, type Insight } from "@/lib/coach/insights";
import { formatMoney } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n/translate";

/**
 * Everything worth the customer's attention: staff announcements, a monthly
 * reminder for each savings goal, then the insights calculated from their own
 * transactions.
 */
export async function allInsights(ctx: SessionContext): Promise<Insight[]> {
  const notices: Insight[] = (await activeAnnouncements()).map((notice) => ({
    id: `announcement-${notice.id}-${notice.updatedAt}`,
    severity: notice.severity,
    title: notice.title,
    body: notice.body,
    ask: "",
  }));

  // One reminder per goal per month, so it comes back each month until the goal is removed.
  const month = ctx.asOf.slice(0, 7);
  const reminders: Insight[] = (await listGoalPlans(ctx)).map((plan) => ({
    id: `goal-${plan.goal.id}-${month}`,
    severity: plan.fit === "hard" ? "warning" : "info",
    title: translate(ctx.locale, "insight.goal.title", { name: plan.goal.name }),
    body: translate(ctx.locale, `insight.goal.body.${plan.fit}`, {
      monthly: formatMoney(plan.goal.monthlyCents, ctx.locale),
      room: formatMoney(plan.roomCents, ctx.locale),
    }),
    ask: translate(ctx.locale, "chat.suggest.recommend"),
  }));

  return [...notices, ...reminders, ...buildInsights(ctx)];
}
