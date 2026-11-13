/**
 * Serialisable chart and widget shapes shared by the chat, the dashboard and (later) the AI tool
 * results. The model never draws anything: it returns one of these specs, computed on the server,
 * and the UI renders it. Money is integer cents.
 */

export interface ChartPoint {
  label: string;
  valueCents: number;
}

export interface BarChartSpec {
  kind: "bar";
  points: ChartPoint[];
}

export interface LineChartSpec {
  kind: "line";
  points: ChartPoint[];
}

export interface DonutChartSpec {
  kind: "donut";
  points: ChartPoint[];
}

export type ChartSpec = BarChartSpec | LineChartSpec | DonutChartSpec;

export type ChartKind = ChartSpec["kind"];

/** A chart with the text that must accompany it: colour and shape are never the only signal. */
export interface ChartCard {
  title: string;
  summary: string;
  chart: ChartSpec;
  /** Plain-language note on where the numbers come from, shown under the chart. */
  basis: string;
}

export interface DashboardWidget extends ChartCard {
  id: string;
}
