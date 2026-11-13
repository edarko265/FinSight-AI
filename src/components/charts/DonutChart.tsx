import type { ChartPoint } from "@/lib/contracts/chart";
import { chartColor } from "@/components/charts/chart-palette";

const SIZE = 140;
const RADIUS = 52;
const STROKE = 22;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function DonutChart({ points }: { points: ChartPoint[] }): React.JSX.Element {
  const total = Math.max(
    points.reduce((sum, point) => sum + point.valueCents, 0),
    1,
  );

  const segments = points.map((point, index) => ({
    label: point.label,
    length: (point.valueCents / total) * CIRCUMFERENCE,
    offset:
      (points.slice(0, index).reduce((sum, earlier) => sum + earlier.valueCents, 0) / total) *
      CIRCUMFERENCE,
    color: chartColor(index),
  }));

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="mx-auto h-auto w-40" aria-hidden="true">
      <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
        {segments.map((segment) => (
          <circle
            key={segment.label}
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke={segment.color}
            strokeWidth={STROKE}
            strokeDasharray={`${Math.max(segment.length - 1.5, 0)} ${CIRCUMFERENCE}`}
            strokeDashoffset={-segment.offset}
          />
        ))}
      </g>
    </svg>
  );
}
