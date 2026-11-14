/** Series colours, defined once as CSS variables in globals.css so light and dark stay in step. */
export const CHART_COLORS: readonly string[] = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

/** The one item that matters: the largest row, or the latest month. */
export const CHART_EMPHASIS = "var(--chart-1)";
/**
 * The rest of the items: calmer than the emphasis, set per theme in globals.css (--chart-rest).
 * Measured against the card: light #4da07a on #fff 3.17:1 (emphasis 5.58:1); dark #348259 on
 * #14261c 3.39:1 (emphasis #4cc486 7.21:1). Both clear the 3:1 minimum for graphics.
 */
export const CHART_REST = "var(--chart-rest)";

export function chartColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length] ?? "var(--chart-1)";
}

/** Text colour that stays readable on top of a series colour, in light and dark. */
export function chartInk(index: number): string {
  // The fifth series colour is a light green in both themes, so it always takes dark text.
  return index % CHART_COLORS.length === 4 ? "#04291a" : "var(--chart-ink)";
}

/**
 * Axis and tile labels in SVG charts, in rem so they follow the font-size preference. The charts
 * draw in a 300-unit-wide viewBox that is shown at roughly 1:1 on a phone, so 0.875rem is about
 * 14 units at the default root size; `CHART_LABEL_UNITS` is that width for fitting labels.
 */
export const CHART_LABEL_SIZE = "0.875rem";

/** Label size in viewBox units at the default root size, for estimating label widths. */
export const CHART_LABEL_UNITS = 14;

/** Cuts a label to what fits in `width` viewBox units at the chart label size, with an ellipsis. */
export function fitLabel(label: string, width: number): string {
  const chars = Math.max(3, Math.floor(width / (CHART_LABEL_UNITS * 0.55)));
  return label.length > chars ? `${label.slice(0, chars - 1)}…` : label;
}
