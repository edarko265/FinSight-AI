/** Series colours, defined once as CSS variables in globals.css so light and dark stay in step. */
export const CHART_COLORS: readonly string[] = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export function chartColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length] ?? "var(--chart-1)";
}

/** Text colour that stays readable on top of a series colour, in light and dark. */
export function chartInk(index: number): string {
  // The fifth series colour is a light green in both themes, so it always takes dark text.
  return index % CHART_COLORS.length === 4 ? "#04291a" : "var(--chart-ink)";
}
