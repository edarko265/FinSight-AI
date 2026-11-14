/**
 * Serialisable chart and widget shapes shared by the chat, the dashboard and (later) the AI tool
 * results. The model never draws anything: it returns one of these specs, computed on the server,
 * and the UI renders it. Money is integer cents.
 */

export interface ChartPoint {
  label: string;
  valueCents: number;
}

/**
 * Chart types a user can ask for or switch any widget to. Every calculation
 * returns a list of labelled amounts, so each of them can be drawn in any of
 * these shapes; the customer chooses.
 */
export const CHART_STYLES = [
  "bar",
  "hbar",
  "line",
  "area",
  "donut",
  "pie",
  "stack",
  "treemap",
  "radial",
  "radar",
  "waterfall",
  "lollipop",
  "funnel",
  "table",
  "stat",
] as const;
export type ChartStyle = (typeof CHART_STYLES)[number];

/** Any chart drawn from a list of labelled amounts. */
interface PointsChartSpec {
  kind: ChartStyle;
  points: ChartPoint[];
}

/** Where income went: one source split into destinations, drawn as a flow. */
interface FlowChartSpec {
  kind: "flow";
  source: ChartPoint;
  points: ChartPoint[];
}

export type ChartSpec = PointsChartSpec | FlowChartSpec;

export type ChartKind = ChartSpec["kind"];

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

/** How much room a widget takes: one column, two, or the full width of the grid. */
export const WIDGET_SIZES = ["small", "medium", "wide"] as const;
export type WidgetSize = (typeof WIDGET_SIZES)[number];

/**
 * Widgets that are not a calculation but a shortcut or a live panel: ask the
 * coach by typing or speaking, start a voice call, check a purchase, play the
 * month story, see goals or the latest insights.
 */
export const ACTION_WIDGETS = ["ask", "call", "afford", "story", "goals", "insights"] as const;
export type ActionWidget = (typeof ACTION_WIDGETS)[number];

export function isActionWidget(tool: string): tool is ActionWidget {
  return (ACTION_WIDGETS as readonly string[]).includes(tool);
}

/** One saved widget in a view: the question to run (or the action), and how it is laid out. */
export interface SavedWidget {
  id: string;
  query: WidgetQuery;
  size?: WidgetSize;
  /** Minimised to its title bar. */
  collapsed?: boolean;
}

/** A widget ready to draw. A calculation carries its chart; an action widget carries only its kind. */
export interface DashboardWidget {
  id: string;
  size: WidgetSize;
  collapsed: boolean;
  action?: ActionWidget;
  /** Present for calculations. */
  card?: ChartCard;
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
  widgets: SavedWidget[];
}

export interface DashboardState {
  activeId: string;
  views: DashboardView[];
}

export interface DashboardPayload extends DashboardState {
  /** The active view's widgets, calculated for its period. */
  cards: DashboardWidget[];
}
