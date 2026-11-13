import type { ChartPoint } from "@/lib/contracts/chart";

const WIDTH = 300;
const HEIGHT = 150;
const LABEL_SPACE = 20;
const GAP = 10;

export function BarChart({ points }: { points: ChartPoint[] }): React.JSX.Element {
  const max = Math.max(...points.map((point) => point.valueCents), 1);
  const plotHeight = HEIGHT - LABEL_SPACE;
  const barWidth = (WIDTH - GAP * (points.length - 1)) / points.length;

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full" aria-hidden="true">
      {points.map((point, index) => {
        const height = Math.max((point.valueCents / max) * plotHeight, 2);
        const x = index * (barWidth + GAP);
        const isLast = index === points.length - 1;
        return (
          <g key={point.label}>
            <rect
              x={x}
              y={plotHeight - height}
              width={barWidth}
              height={height}
              rx={4}
              fill={isLast ? "var(--chart-1)" : "var(--chart-bar-muted)"}
            />
            <text
              x={x + barWidth / 2}
              y={HEIGHT - 5}
              textAnchor="middle"
              fontSize={11}
              fill="var(--muted)"
            >
              {point.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
