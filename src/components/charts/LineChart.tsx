import { CHART_LABEL_SIZE } from "@/components/charts/chart-palette";
import { useChartLabels } from "@/components/charts/chart-labels";
import type { ChartPoint } from "@/lib/contracts/chart";

const WIDTH = 300;
const HEIGHT = 150;
const LABEL_SPACE = 26;
const PAD_X = 16;
const PAD_TOP = 10;

export function LineChart({ points }: { points: ChartPoint[] }): React.JSX.Element {
  const labels = useChartLabels();
  const values = points.map((point) => point.valueCents);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 1);
  const plotHeight = HEIGHT - (labels ? LABEL_SPACE : 4) - PAD_TOP;
  const step = points.length > 1 ? (WIDTH - PAD_X * 2) / (points.length - 1) : 0;

  const coordinates = points.map((point, index) => ({
    label: point.label,
    x: PAD_X + index * step,
    y: PAD_TOP + plotHeight - ((point.valueCents - min) / span) * plotHeight,
  }));
  const path = coordinates.map((c, i) => `${i === 0 ? "M" : "L"}${c.x},${c.y}`).join(" ");
  const last = coordinates[coordinates.length - 1];

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full" aria-hidden="true">
      <path
        d={path}
        fill="none"
        stroke="var(--chart-1)"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {coordinates.map((c) => (
        <g key={c.label}>
          <circle
            cx={c.x}
            cy={c.y}
            r={3}
            fill="var(--surface)"
            stroke="var(--chart-1)"
            strokeWidth={2}
          />
          {labels ? (
            <text
              x={c.x}
              y={HEIGHT - 7}
              textAnchor="middle"
              fontSize={CHART_LABEL_SIZE}
              fill="var(--muted)"
            >
              {c.label}
            </text>
          ) : null}
        </g>
      ))}
      {last ? <circle cx={last.x} cy={last.y} r={5} fill="var(--chart-1)" /> : null}
    </svg>
  );
}
