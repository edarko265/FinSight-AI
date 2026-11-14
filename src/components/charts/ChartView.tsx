"use client";

import { BarChart } from "@/components/charts/BarChart";
import { barVariant, sharePercents } from "@/components/charts/chart-data";
import { chartColor } from "@/components/charts/chart-palette";
import { DonutChart } from "@/components/charts/DonutChart";
import { FlowChart } from "@/components/charts/FlowChart";
import { LineChart } from "@/components/charts/LineChart";
import {
  AreaChart,
  FunnelChart,
  HBarChart,
  LollipopChart,
  PieChart,
  RadarChart,
  RadialChart,
  StackChart,
  StatChart,
  TableChart,
  TreemapChart,
  WaterfallChart,
} from "@/components/charts/MoreCharts";
import type { ChartCard, ChartSpec } from "@/lib/contracts/chart";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import { formatMoney } from "@/lib/i18n/config";

/** The drawing alone, without the values list: used for previews. */
export function ChartPlot({ chart }: { chart: ChartSpec }): React.JSX.Element {
  switch (chart.kind) {
    case "bar":
      return <BarChart points={chart.points} />;
    case "hbar":
      return <HBarChart points={chart.points} />;
    case "line":
      return <LineChart points={chart.points} />;
    case "area":
      return <AreaChart points={chart.points} />;
    case "donut":
      return <DonutChart points={chart.points} />;
    case "pie":
      return <PieChart points={chart.points} />;
    case "stack":
      return <StackChart points={chart.points} />;
    case "treemap":
      return <TreemapChart points={chart.points} />;
    case "radial":
      return <RadialChart points={chart.points} />;
    case "radar":
      return <RadarChart points={chart.points} />;
    case "waterfall":
      return <WaterfallChart points={chart.points} />;
    case "lollipop":
      return <LollipopChart points={chart.points} />;
    case "funnel":
      return <FunnelChart points={chart.points} />;
    case "table":
      return <TableChart points={chart.points} />;
    case "stat":
      return <StatChart points={chart.points} />;
    case "flow":
      return <FlowChart source={chart.source} points={chart.points} />;
  }
}

/** Shapes where each item has its own colour, so the values list needs the colour key. */
const KEYED = new Set([
  "donut",
  "pie",
  "stack",
  "treemap",
  "radial",
  "funnel",
  "hbar",
  "lollipop",
  "flow",
]);
/** Shapes that already write every number out next to the mark. */
const SELF_EXPLAINING = new Set(["table", "stat", "hbar"]);
/** Shares of a whole: the list also gives each part's percentage. */
const SHARES = new Set(["donut", "pie", "stack", "treemap", "radial", "flow"]);

function isSelfExplaining(chart: ChartSpec): boolean {
  if (SELF_EXPLAINING.has(chart.kind)) return true;
  return chart.kind === "bar" && barVariant(chart.points) === "rows";
}

/**
 * A chart is never the only carrier of the numbers: unless the marks are labelled with their
 * amounts, every chart is paired with an always-visible values list, readable without colour and
 * by screen readers.
 */
function Values({ chart }: { chart: ChartSpec }): React.JSX.Element {
  const { locale } = usePreferences();
  const keyed = KEYED.has(chart.kind);
  const percents = SHARES.has(chart.kind)
    ? sharePercents(chart.points.map((point) => point.valueCents))
    : null;
  const lastIndex = chart.points.length - 1;

  return (
    <ul className="mt-3 grid grid-cols-1 gap-1.5 text-sm">
      {chart.points.map((point, index) => (
        <li key={point.label} className="flex items-baseline justify-between gap-3">
          <span className="flex min-w-0 items-baseline gap-2 break-words">
            {keyed ? (
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ background: chartColor(index) }}
                aria-hidden="true"
              />
            ) : null}
            {point.label}
          </span>
          <span
            className={`shrink-0 whitespace-nowrap text-right tabular-nums ${
              index === lastIndex && !keyed ? "font-semibold" : "text-muted"
            }`}
          >
            {formatMoney(point.valueCents, locale)}
            {percents ? ` · ${percents[index]} %` : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function ChartView({ card }: { card: ChartCard }): React.JSX.Element {
  return (
    <figure aria-label={card.title}>
      <ChartPlot chart={card.chart} />
      <figcaption className="sr-only">{card.summary}</figcaption>
      {isSelfExplaining(card.chart) ? null : <Values chart={card.chart} />}
    </figure>
  );
}
