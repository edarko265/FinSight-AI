import { ageBand, customerMetrics } from "@/lib/analytics/benchmarks";
import { classify, isConsumption } from "@/lib/analytics/classify";
import {
  completedMonths,
  daysBetween,
  inPeriod,
  lastCompletedMonth,
} from "@/lib/analytics/periods";
import { detectRegularBills } from "@/lib/analytics/recurrence";
import { basketBreakdown, recordedBalance, summariseSpending } from "@/lib/analytics/spending";
import { forecastFor, type CoachContext } from "@/lib/coach/tools";
import { formatDay, formatMoney } from "@/lib/i18n/config";
import { hasMessage, translate, type MessageKey, type MessageParams } from "@/lib/i18n/translate";

/**
 * Proactive insights: things worth the user's attention, each computed from
 * their own data and each leading into a question for the coach. Shown in the
 * app as notifications; nothing is pushed to the device.
 */
export interface Insight {
  id: string;
  severity: "warning" | "info" | "good";
  title: string;
  body: string;
  /** A question that opens the coach on this topic. */
  ask: string;
}

const SMALL_PURCHASE_CENTS = 1500;
const SPIKE_PERCENT = 25;
const SPIKE_MIN_CENTS = 3000;

export function buildInsights(ctx: CoachContext): Insight[] {
  const t = (key: MessageKey, params?: MessageParams): string => translate(ctx.locale, key, params);
  const money = (cents: number): string => formatMoney(cents, ctx.locale);
  const label = (category: string): string => {
    const key = `cat.${category}`;
    return hasMessage(key) ? t(key) : category;
  };
  const txs = ctx.record.transactions;
  const insights: Insight[] = [];
  const last = lastCompletedMonth(ctx.asOf);
  const monthId = last.startInclusive.slice(0, 7);

  const forecast = forecastFor(ctx, { horizonDays: 7 });
  if (forecast.status === "shortfall") {
    insights.push({
      id: `shortfall-${ctx.asOf}`,
      severity: "warning",
      title: t("insight.shortfall.title"),
      body: t("insight.shortfall.body", { shortfall: money(forecast.shortfallCents), days: 7 }),
      ask: t("chat.suggest.safe"),
    });
  }

  const bills = detectRegularBills(txs, ctx.asOf);
  for (const bill of bills) {
    if (!bill.nextExpectedDate) continue;
    const days = daysBetween(ctx.asOf, bill.nextExpectedDate);
    if (days < 0 || days > 10) continue;
    insights.push({
      id: `bill-${bill.category}-${bill.nextExpectedDate}`,
      severity: "info",
      title: t("insight.bill.title", { category: label(bill.category) }),
      body: t("insight.bill.body", {
        amount: money(bill.typicalMonthlyCents),
        date: formatDay(bill.nextExpectedDate, ctx.locale),
      }),
      ask: t("chat.suggest.bills"),
    });
  }

  const balance = recordedBalance(txs, ctx.asOf);
  const monthlyBills = bills.reduce((sum, bill) => sum + bill.typicalMonthlyCents, 0);
  if (balance && monthlyBills > 0 && balance.balanceCents < monthlyBills) {
    insights.push({
      id: `buffer-${monthId}`,
      severity: "warning",
      title: t("insight.buffer.title"),
      body: t("insight.buffer.body", {
        bills: money(monthlyBills),
        balance: money(balance.balanceCents),
      }),
      ask: t("chat.suggest.safe"),
    });
  }

  // Month-over-average changes in everyday categories.
  const previous = completedMonths(last.startInclusive, 3);
  const current = summariseSpending(txs, { period: last });
  const changes: { category: string; cents: number; average: number; percent: number }[] = [];
  for (const entry of current.byCategory) {
    const average = Math.round(
      previous.reduce(
        (sum, month) =>
          sum + summariseSpending(txs, { period: month, categories: [entry.category] }).totalCents,
        0,
      ) / previous.length,
    );
    if (average <= 0) continue;
    const percent = Math.round(((entry.totalCents - average) / average) * 100);
    if (Math.abs(entry.totalCents - average) >= SPIKE_MIN_CENTS) {
      changes.push({ category: entry.category, cents: entry.totalCents, average, percent });
    }
  }
  const spike = changes
    .filter((c) => c.percent >= SPIKE_PERCENT)
    .sort((a, b) => b.percent - a.percent)[0];
  if (spike) {
    insights.push({
      id: `spike-${spike.category}-${monthId}`,
      severity: "info",
      title: t("insight.spike.title", { category: label(spike.category) }),
      body: t("insight.spike.body", {
        amount: money(spike.cents),
        percent: spike.percent,
        average: money(spike.average),
      }),
      ask: t("chat.suggest.where"),
    });
  }
  const drop = changes
    .filter((c) => c.percent <= -SPIKE_PERCENT)
    .sort((a, b) => a.percent - b.percent)[0];
  if (drop) {
    insights.push({
      id: `drop-${drop.category}-${monthId}`,
      severity: "good",
      title: t("insight.drop.title", { category: label(drop.category) }),
      body: t("insight.drop.body", {
        amount: money(drop.cents),
        percent: Math.abs(drop.percent),
        average: money(drop.average),
      }),
      ask: t("chat.suggest.where"),
    });
  }

  // "Slips through your fingers": small free-choice purchases.
  let smallCount = 0;
  let smallCents = 0;
  for (const tx of txs) {
    if (!isConsumption(tx) || !inPeriod(tx.date, last) || -tx.amountCents >= SMALL_PURCHASE_CENTS)
      continue;
    if (classify(tx).necessity !== "discretionary") continue;
    smallCount += 1;
    smallCents -= tx.amountCents;
  }
  if (smallCount >= 8) {
    insights.push({
      id: `slips-${monthId}`,
      severity: "info",
      title: t("insight.slips.title"),
      body: t("insight.slips.body", {
        count: smallCount,
        limit: money(SMALL_PURCHASE_CENTS),
        amount: money(smallCents),
      }),
      ask: t("chat.suggest.whatif"),
    });
  }

  // Irregular essentials: plan a reserve.
  const year = completedMonths(ctx.asOf, 12);
  const irregular = basketBreakdown(txs, {
    startInclusive: year[0]?.startInclusive ?? ctx.asOf,
    endExclusive: year[year.length - 1]?.endExclusive ?? ctx.asOf,
  }).baskets.find((basket) => basket.basket === "irregular");
  if (irregular && irregular.byNecessity.essential > 0) {
    insights.push({
      id: `reserve-${monthId}`,
      severity: "info",
      title: t("insight.reserve.title"),
      body: t("insight.reserve.body", {
        amount: money(Math.round(irregular.byNecessity.essential / 12)),
      }),
      ask: t("chat.suggest.safe"),
    });
  }

  // Free-choice category well above people of the same age.
  const band = ageBand(ctx.record.profile.age);
  const metrics = customerMetrics(txs, ctx.asOf);
  const above = ["Restaurants", "Entertainment", "Lifestyle", "Travel"]
    .map((category) => {
      const row = ctx.benchmarks.find(
        (r) => r.ageBand === band && r.metric === `category:${category}`,
      );
      const value = metrics.get(`category:${category}`) ?? 0;
      return row && value > row.p75Cents
        ? { category, value, row, ratio: value / Math.max(1, row.p75Cents) }
        : null;
    })
    .filter((entry) => entry !== null)
    .sort((a, b) => b.ratio - a.ratio)[0];
  if (above) {
    insights.push({
      id: `peers-${above.category}-${monthId}`,
      severity: "info",
      title: t("insight.peers.title", { category: label(above.category) }),
      body: t("insight.peers.body", {
        amount: money(above.value),
        band: above.row.ageBand,
        low: money(above.row.p25Cents),
        high: money(above.row.p75Cents),
      }),
      ask: t("chat.suggest.peers"),
    });
  }

  const order = { warning: 0, info: 1, good: 2 } as const;
  return insights.sort((a, b) => order[a.severity] - order[b.severity]);
}
