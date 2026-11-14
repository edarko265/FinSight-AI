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

/** Where income went: one source split into destinations, drawn as a flow. */
export interface FlowChartSpec {
  kind: "flow";
  source: ChartPoint;
  points: ChartPoint[];
}

export type ChartSpec = BarChartSpec | LineChartSpec | DonutChartSpec | FlowChartSpec;

export type ChartKind = ChartSpec["kind"];

/** Chart types a user can ask for or switch any widget to. */
export const CHART_STYLES = ["bar", "line", "donut"] as const;
export type ChartStyle = (typeof CHART_STYLES)[number];

/** A chart with the text that must accompany it: colour and shape are never the only signal. */
export interface ChartCard {
  title: string;
  summary: string;
  chart: ChartSpec;
  /** Plain-language note on where the numbers come from, shown under the chart. */
  basis: string;
}

/** A saved question: which calculation to run and with what input. Re-run whenever it is shown. */
export interface WidgetQuery {
  tool: string;
  input: Record<string, unknown>;
  /** The chart type the user chose for this widget, if they changed it from the default. */
  chart?: ChartStyle;
}

export interface DashboardWidget extends ChartCard {
  id: string;
}

export const VIEW_PERIODS = [
  "last_month",
  "this_month",
  "last_3_months",
  "last_6_months",
  "last_12_months",
] as const;
export type PresetPeriod = (typeof VIEW_PERIODS)[number];

/** A date range the customer picked: "YYYY-MM-DD..YYYY-MM-DD", both days included. */
export const CUSTOM_PERIOD = /^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/;

/** A view's period: one of the presets, or a custom date range. */
export type ViewPeriod = PresetPeriod | (string & {});

export function isCustomPeriod(period: string): boolean {
  return CUSTOM_PERIOD.test(period);
}

/** A named dashboard setup: a set of widgets and the period they are shown for. */
export interface DashboardView {
  id: string;
  /** Set for the built-in starting views, whose names are translated. */
  preset?: "overview" | "baskets" | "everyday";
  name: string;
  period: ViewPeriod;
  widgets: { id: string; query: WidgetQuery }[];
}

export interface DashboardState {
  activeId: string;
  views: DashboardView[];
}

export interface DashboardPayload extends DashboardState {
  /** The active view's widgets, calculated for its period. */
  cards: DashboardWidget[];
}
