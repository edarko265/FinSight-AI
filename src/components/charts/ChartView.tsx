"use client";

import { BarChart } from "@/components/charts/BarChart";
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
/** Shapes that already write every number out. */
const SELF_EXPLAINING = new Set(["table", "stat"]);

/**
 * A chart is never the only carrier of the numbers: every one is paired with a values list, so the
 * data is readable without colour, and by screen readers.
 */
function Values({ chart }: { chart: ChartSpec }): React.JSX.Element {
  const { t, locale } = usePreferences();
  const isDonut = KEYED.has(chart.kind);
  const total = chart.points.reduce((sum, point) => sum + point.valueCents, 0);

  const list = (
    <ul className="grid grid-cols-1 gap-1.5 text-sm">
      {chart.points.map((point, index) => (
        <li key={point.label} className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            {isDonut ? (
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ background: chartColor(index) }}
                aria-hidden="true"
              />
            ) : null}
            {point.label}
          </span>
          <span className="tabular-nums text-muted">
            {formatMoney(point.valueCents, locale)}
            {isDonut && total > 0 ? ` · ${Math.round((point.valueCents / total) * 100)} %` : null}
          </span>
        </li>
      ))}
    </ul>
  );

  if (isDonut) {
    return <div className="mt-3">{list}</div>;
  }
  return (
    <details className="group mt-3">
      <summary className="cursor-pointer text-sm font-medium text-accent">
        {t("chart.showValues")}
      </summary>
      <div className="mt-2">{list}</div>
    </details>
  );
}

export function ChartView({ card }: { card: ChartCard }): React.JSX.Element {
  return (
    <figure aria-label={card.title}>
      <ChartPlot chart={card.chart} />
      <figcaption className="sr-only">{card.summary}</figcaption>
      {SELF_EXPLAINING.has(card.chart.kind) ? null : <Values chart={card.chart} />}
    </figure>
  );
}
