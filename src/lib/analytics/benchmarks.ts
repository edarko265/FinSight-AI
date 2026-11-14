import { classify, CONSUMPTION_CATEGORIES, flowOf, isConsumption } from "@/lib/analytics/classify";
import { completedMonths, inPeriod } from "@/lib/analytics/periods";
import { percentile } from "@/lib/analytics/stats";
import type { Transaction } from "@/lib/data/types";

/**
 * Peer benchmarks: how one customer's typical month compares with others of a
 * similar age in the same synthetic dataset. Only group percentiles are ever
 * stored, and groups below MIN_GROUP_SIZE are dropped.
 */
const BENCHMARK_MONTHS = 12;
export const MIN_GROUP_SIZE = 30;

export const AGE_BANDS = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"] as const;
export type AgeBand = (typeof AGE_BANDS)[number] | "all";

export function ageBand(age: number | null): AgeBand {
  if (age === null) return "all";
  if (age < 25) return "18-24";
  if (age < 35) return "25-34";
  if (age < 45) return "35-44";
  if (age < 55) return "45-54";
  if (age < 65) return "55-64";
  return "65+";
}

const BENCHMARK_METRICS = [
  "consumption",
  "basket:regular",
  "basket:irregular",
  "basket:everyday",
  "income",
  "invested",
  ...CONSUMPTION_CATEGORIES.map((category) => `category:${category}`),
] as const;

/** A customer's average monthly cents per metric over the completed months before the as-of date. */
export function customerMetrics(
  transactions: readonly Transaction[],
  asOf: string,
): Map<string, number> {
  const months = completedMonths(asOf, BENCHMARK_MONTHS);
  const window = {
    startInclusive: months[0]?.startInclusive ?? asOf,
    endExclusive: months[months.length - 1]?.endExclusive ?? asOf,
  };
  const totals = new Map<string, number>(BENCHMARK_METRICS.map((metric) => [metric, 0]));
  const add = (metric: string, cents: number): void => {
    totals.set(metric, (totals.get(metric) ?? 0) + cents);
  };
  for (const tx of transactions) {
    if (!inPeriod(tx.date, window)) continue;
    const flow = flowOf(tx);
    if (flow === "salary" || flow === "other_income") add("income", tx.amountCents);
    if (flow === "investment_out") add("invested", -tx.amountCents);
    if (!isConsumption(tx)) continue;
    add("consumption", -tx.amountCents);
    add(`category:${tx.category}`, -tx.amountCents);
    const { basket } = classify(tx);
    if (basket !== "unclassified") add(`basket:${basket}`, -tx.amountCents);
  }
  for (const [metric, cents] of totals) totals.set(metric, Math.round(cents / months.length));
  return totals;
}

export interface BenchmarkRow {
  ageBand: AgeBand;
  metric: string;
  groupSize: number;
  p25Cents: number;
  p50Cents: number;
  p75Cents: number;
}

/** Collects per-customer metrics and reduces them to group percentiles. */
export class BenchmarkBuilder {
  private readonly values = new Map<string, number[]>();

  add(band: AgeBand, metrics: Map<string, number>): void {
    for (const [metric, cents] of metrics) {
      for (const group of band === "all" ? ["all"] : [band, "all"]) {
        const key = `${group}|${metric}`;
        const list = this.values.get(key) ?? [];
        list.push(cents);
        this.values.set(key, list);
      }
    }
  }

  rows(): BenchmarkRow[] {
    const rows: BenchmarkRow[] = [];
    for (const [key, list] of this.values) {
      if (list.length < MIN_GROUP_SIZE) continue;
      const [band = "all", metric = ""] = key.split("|");
      rows.push({
        ageBand: band as AgeBand,
        metric,
        groupSize: list.length,
        p25Cents: percentile(list, 0.25),
        p50Cents: percentile(list, 0.5),
        p75Cents: percentile(list, 0.75),
      });
    }
    return rows;
  }
}

export type BenchmarkPosition = "lower" | "typical" | "higher";

export function positionAgainst(valueCents: number, row: BenchmarkRow): BenchmarkPosition {
  if (valueCents < row.p25Cents) return "lower";
  if (valueCents > row.p75Cents) return "higher";
  return "typical";
}
