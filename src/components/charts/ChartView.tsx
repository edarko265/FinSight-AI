import { BarChart } from "@/components/charts/BarChart";
import { chartColor } from "@/components/charts/chart-palette";
import { DonutChart } from "@/components/charts/DonutChart";
import { LineChart } from "@/components/charts/LineChart";
import type { ChartCard, ChartSpec } from "@/lib/contracts/chart";
import { formatEur } from "@/lib/money";

function Plot({ chart }: { chart: ChartSpec }): React.JSX.Element {
  switch (chart.kind) {
    case "bar":
      return <BarChart points={chart.points} />;
    case "line":
      return <LineChart points={chart.points} />;
    case "donut":
      return <DonutChart points={chart.points} />;
  }
}

/**
 * A chart is never the only carrier of the numbers: every one is paired with a values list, so the
 * data is readable without colour, and by screen readers.
 */
function Values({ chart }: { chart: ChartSpec }): React.JSX.Element {
  const isDonut = chart.kind === "donut";
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
            {formatEur(point.valueCents)}
            {isDonut && total > 0
              ? ` · ${Math.round((point.valueCents / total) * 100)} %`
              : null}
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
      <summary className="cursor-pointer text-sm font-medium text-accent">Show values</summary>
      <div className="mt-2">{list}</div>
    </details>
  );
}

export function ChartView({ card }: { card: ChartCard }): React.JSX.Element {
  return (
    <figure aria-label={card.title}>
      <Plot chart={card.chart} />
      <figcaption className="sr-only">{card.summary}</figcaption>
      <Values chart={card.chart} />
    </figure>
  );
}
