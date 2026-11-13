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
