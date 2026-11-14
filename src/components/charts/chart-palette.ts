/** Series colours, defined once as CSS variables in globals.css so light and dark stay in step. */
export const CHART_COLORS: readonly string[] = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
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
  // The fifth series colour is dark in the light theme and light in the dark one, so it has its own.
  return index % CHART_COLORS.length === 4 ? "var(--chart-ink-5)" : "var(--chart-ink)";
}

/**
 * Axis and tile labels in SVG charts. The charts draw in a 300-unit-wide viewBox that is shown
 * at roughly 1:1 on a phone, so this is close to the pixel size; 14 keeps labels at about 12px
 * down to a 320px screen (about 12px there).
 */
export const CHART_LABEL_SIZE = 14;

/** Cuts a label to what fits in `width` viewBox units at the chart label size, with an ellipsis. */
export function fitLabel(label: string, width: number): string {
  const chars = Math.max(3, Math.floor(width / (CHART_LABEL_SIZE * 0.55)));
  return label.length > chars ? `${label.slice(0, chars - 1)}…` : label;
}
