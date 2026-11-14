import type { ChartPoint } from "@/lib/contracts/chart";

const WIDTH = 300;
const HEIGHT = 150;
const LABEL_SPACE = 20;
const GAP = 10;
const SHORT_LABEL = 5;

/** Bars with longer names are drawn as rows, so the labels stay readable on a phone. */
function Rows({ points }: { points: ChartPoint[] }): React.JSX.Element {
  const max = Math.max(...points.map((point) => point.valueCents), 1);
  return (
    <ul className="flex flex-col gap-2" aria-hidden="true">
      {points.map((point, index) => (
        <li key={point.label} className="flex flex-col gap-1">
          <span className="text-xs text-muted">{point.label}</span>
          <span className="h-3 w-full overflow-hidden rounded-full bg-border">
            <span
              className="block h-full rounded-full fs-grow-x"
              style={{
                width: `${Math.max((Math.max(point.valueCents, 0) / max) * 100, 1)}%`,
                background:
                  index === points.length - 1 ? "var(--chart-1)" : "var(--chart-bar-muted)",
              }}
            />
          </span>
        </li>
      ))}
    </ul>
  );
}

export function BarChart({ points }: { points: ChartPoint[] }): React.JSX.Element {
  if (points.some((point) => point.label.length > SHORT_LABEL)) return <Rows points={points} />;

  const max = Math.max(...points.map((point) => point.valueCents), 1);
  const plotHeight = HEIGHT - LABEL_SPACE;
  const barWidth = (WIDTH - GAP * (points.length - 1)) / points.length;

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full" aria-hidden="true">
      {points.map((point, index) => {
        const height = Math.max((Math.max(point.valueCents, 0) / max) * plotHeight, 2);
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
              className="fs-grow-y"
              style={{ animationDelay: `${index * 0.05}s` }}
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
