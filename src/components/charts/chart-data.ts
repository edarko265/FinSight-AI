import type { ChartPoint } from "@/lib/contracts/chart";
import { formatMonth, LOCALE_INFO, LOCALES, type Locale } from "@/lib/i18n/config";

/** Largest-remainder rounding: whole percentages, in the same order, that always add up to 100. */
export function sharePercents(valuesCents: number[]): number[] {
  const values = valuesCents.map((value) => Math.max(0, value));
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return values.map(() => 0);
  const exact = values.map((value) => (value * 100) / total);
  const floors = exact.map((share) => Math.floor(share));
  let left = 100 - floors.reduce((sum, share) => sum + share, 0);
  const order = exact
    .map((share, index) => ({ index, rest: share - Math.floor(share) }))
    .sort((a, b) => b.rest - a.rest || a.index - b.index);
  for (const { index } of order) {
    if (left <= 0) break;
    floors[index] = (floors[index] ?? 0) + 1;
    left -= 1;
  }
  return floors;
}

/** Ranked comparison reads best largest first. Stable: equal amounts keep their order. */
export function sortRanked(points: ChartPoint[]): ChartPoint[] {
  return points
    .map((point, index) => ({ point, index }))
    .sort((a, b) => b.point.valueCents - a.point.valueCents || a.index - b.index)
    .map(({ point }) => point);
}

/** Every month name the app can print, short and long, in every language. */
const MONTH_LABELS: ReadonlySet<string> = new Set(
  LOCALES.flatMap((locale) =>
    Array.from({ length: 12 }, (_, month) => {
      const key = `2026-${String(month + 1).padStart(2, "0")}`;
      return [formatMonth(key, locale), formatMonth(key, locale, "long")];
    }).flat(),
  ),
);

/** Months are in calendar order, so they are never re-sorted and are drawn as columns. */
export function isTimeSeries(points: ChartPoint[]): boolean {
  return points.length >= 2 && points.every((point) => MONTH_LABELS.has(point.label));
}

export type BarVariant = "columns" | "rows";

export function barVariant(points: ChartPoint[]): BarVariant {
  return isTimeSeries(points) ? "columns" : "rows";
}

/** Whole-cent average of the points, rounded once. */
export function averageCents(points: ChartPoint[]): number {
  if (points.length === 0) return 0;
  const total = points.reduce((sum, point) => sum + point.valueCents, 0);
  return Math.round(total / points.length);
}

/** Bar length as a percentage of the largest value, never negative, at least 1 so it stays visible. */
export function barPercent(valueCents: number, maxCents: number): number {
  if (maxCents <= 0) return 1;
  return Math.max(Math.min((Math.max(valueCents, 0) / maxCents) * 100, 100), 1);
}

/** A whole percentage (0 to 100) written for the locale, e.g. "60 %" in Finnish. */
export function formatPercent(percent: number, locale: Locale): string {
  return new Intl.NumberFormat(LOCALE_INFO[locale].intl, { style: "percent" }).format(
    percent / 100,
  );
}

/** Sizes for the donut: negatives are left out, so arcs, centre total and shares agree. */
export function donutShares(points: ChartPoint[]): { positiveCents: number; fractions: number[] } {
  const values = points.map((point) => Math.max(0, point.valueCents));
  const positiveCents = values.reduce((sum, value) => sum + value, 0);
  return {
    positiveCents,
    fractions: values.map((v) => (positiveCents > 0 ? v / positiveCents : 0)),
  };
}

/** Which labels to write under a long column series: all up to 6, then every other one. */
export function visibleLabelIndexes(count: number): number[] {
  const all = Array.from({ length: count }, (_, index) => index);
  if (count <= 6) return all;
  const lastIndex = count - 1;
  // Count back from the latest so it is always labelled.
  return all.filter((index) => (lastIndex - index) % 2 === 0);
}
