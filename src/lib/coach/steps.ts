import { RULE_VERSION } from "@/lib/analytics/classify";
import { MIN_GROUP_SIZE } from "@/lib/analytics/benchmarks";
import { safeToSave } from "@/lib/coach/advice";
import { forecastFor, type CoachContext, type ToolResult } from "@/lib/coach/tools";
import { formatMoney } from "@/lib/i18n/config";
import { translate, type MessageKey, type MessageParams } from "@/lib/i18n/translate";

/**
 * "How this was worked out": the steps a calculation took, in the order it
 * took them, in plain words. Built from the same result the answer shows and
 * from the same functions, so it cannot drift from what was actually done.
 */
export function explain(ctx: CoachContext, result: ToolResult): string[] {
  const t = (key: MessageKey, params?: MessageParams): string => translate(ctx.locale, key, params);
  const money = (cents: number): string => formatMoney(cents, ctx.locale);
  const period = result.evidence?.periodLabel ?? "";
  const count = result.evidence?.transactionCount ?? 0;
  const first = result.facts[0];
  const input = (result.query?.input ?? {}) as Record<string, unknown>;
  const steps: string[] = [];
  const linked = (ctx.record.accounts ?? []).filter((a) => a.simulated && a.included).length;

  switch (result.tool) {
    case "spending":
      steps.push(t("steps.period", { period }));
      steps.push(t(input.target ? "steps.filter.target" : "steps.filter.all", { count }));
      if (first) steps.push(t("steps.sum", { total: money(first.valueCents) }));
      if (!input.target) steps.push(t("steps.group"));
      break;
    case "trend":
      steps.push(t("steps.trend.months", { months: result.card?.chart.points.length ?? 0 }));
      steps.push(t(input.target ? "steps.filter.target" : "steps.filter.all", { count }));
      steps.push(t("steps.trend.sum"));
      break;
    case "baskets":
    case "profile":
      steps.push(t("steps.period", { period }));
      steps.push(t("steps.filter.all", { count }));
      steps.push(t("steps.baskets.place", { version: RULE_VERSION }));
      steps.push(t("steps.baskets.sum"));
      break;
    case "flow":
      steps.push(t("steps.period", { period }));
      steps.push(t("steps.flow.income"));
      steps.push(t("steps.baskets.place", { version: RULE_VERSION }));
      steps.push(t("steps.flow.left"));
      break;
    case "safe_to_spend": {
      const f = forecastFor(ctx, input);
      const b = f.breakdown;
      steps.push(t("steps.safe.start", { balance: money(f.balanceCents) }));
      steps.push(
        t("steps.safe.upfront", {
          amount: money(b.protectedCents + b.irregularReserveCents + b.otherOutflowsCents),
        }),
      );
      steps.push(
        t("steps.safe.walk", {
          days: f.assumptions.horizonDays,
          daily: money(f.assumptions.essentialDailyCents + f.assumptions.spreadBillsDailyCents),
          bills: money(b.billsCents),
        }),
      );
      steps.push(
        t(f.status === "shortfall" ? "steps.safe.short" : "steps.safe.lowest", {
          amount: money(f.status === "shortfall" ? f.shortfallCents : f.availableCents),
        }),
      );
      steps.push(t("steps.safe.income"));
      break;
    }
    case "what_if":
      steps.push(t("steps.filter.target", { count }));
      steps.push(t("steps.whatif.saving", { percent: Number(input.percent ?? 0) }));
      steps.push(t("steps.whatif.year"));
      break;
    case "peers":
      steps.push(t("steps.peers.own"));
      steps.push(t("steps.peers.group", { min: MIN_GROUP_SIZE }));
      steps.push(t("steps.peers.position"));
      break;
    case "recurring":
      steps.push(t("steps.recurring.look"));
      steps.push(t("steps.recurring.keep"));
      steps.push(t("steps.recurring.day"));
      break;
    case "subscriptions":
      steps.push(t("steps.subs.group"));
      steps.push(t("steps.subs.keep"));
      steps.push(t("steps.subs.year"));
      break;
    case "plan":
      steps.push(t("steps.plan.average"));
      steps.push(t("steps.plan.saving"));
      steps.push(t("steps.plan.percent"));
      break;
    case "safe_to_save": {
      const s = safeToSave(ctx);
      steps.push(t("steps.save.walk", { available: money(s.availableCents) }));
      steps.push(t("steps.save.keep", { keep: money(s.keepCents) }));
      steps.push(t("steps.save.result", { safe: money(s.safeCents) }));
      break;
    }
    case "recommend":
      steps.push(t("steps.recommend.rules"));
      steps.push(t("steps.recommend.rank"));
      break;
    case "goal":
      steps.push(t("steps.goal.monthly"));
      steps.push(t("steps.goal.room"));
      steps.push(t("steps.goal.trims"));
      break;
    case "balance":
    case "accounts":
      steps.push(t("steps.balance"));
      break;
    default:
      return [];
  }
  if (linked > 0) steps.push(t("steps.linked", { count: linked }));
  if (result.evidence) steps.push(t("steps.source"));
  return steps;
}
