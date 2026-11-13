import type { ChartPoint } from "@/lib/contracts/chart";

const WIDTH = 300;
const HEIGHT = 150;
const LABEL_SPACE = 20;
const PAD_X = 8;
const PAD_TOP = 10;

export function LineChart({ points }: { points: ChartPoint[] }): React.JSX.Element {
  const values = points.map((point) => point.valueCents);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 1);
  const plotHeight = HEIGHT - LABEL_SPACE - PAD_TOP;
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
          <text x={c.x} y={HEIGHT - 5} textAnchor="middle" fontSize={11} fill="var(--muted)">
            {c.label}
          </text>
        </g>
      ))}
      {last ? <circle cx={last.x} cy={last.y} r={5} fill="var(--chart-1)" /> : null}
    </svg>
  );
}
