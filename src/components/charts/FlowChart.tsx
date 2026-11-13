import { chartColor } from "@/components/charts/chart-palette";
import type { ChartPoint } from "@/lib/contracts/chart";

const WIDTH = 300;
const HEIGHT = 170;
const NODE = 14;
const GAP = 6;

/**
 * A money-flow diagram: one source on the left splitting into destinations on
 * the right, each band as thick as its share. Decorative; the values list
 * under every chart carries the numbers.
 */
export function FlowChart({
  points,
}: {
  source: ChartPoint;
  points: ChartPoint[];
}): React.JSX.Element {
  const total = Math.max(
    points.reduce((sum, point) => sum + point.valueCents, 0),
    1,
  );
  const usable = HEIGHT - GAP * Math.max(0, points.length - 1);
  const bands = points.map((point, index) => {
    const before = points.slice(0, index).reduce((sum, earlier) => sum + earlier.valueCents, 0);
    const height = Math.max((point.valueCents / total) * usable, 2);
    return {
      label: point.label,
      height,
      sourceY: (before / total) * HEIGHT,
      sourceHeight: (point.valueCents / total) * HEIGHT,
      targetY: (before / total) * usable + index * GAP,
      color: chartColor(index),
    };
  });
  const left = NODE;
  const right = WIDTH - NODE;
  const mid = (left + right) / 2;

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full" aria-hidden="true">
      <rect x={0} y={0} width={NODE} height={HEIGHT} rx={4} fill="var(--brand)" />
      {bands.map((band) => (
        <g key={band.label}>
          <path
            d={`M${left},${band.sourceY} C${mid},${band.sourceY} ${mid},${band.targetY} ${right},${band.targetY} L${right},${
              band.targetY + band.height
            } C${mid},${band.targetY + band.height} ${mid},${band.sourceY + band.sourceHeight} ${left},${
              band.sourceY + band.sourceHeight
            } Z`}
            fill={band.color}
            opacity={0.35}
          />
          <rect
            x={right}
            y={band.targetY}
            width={NODE}
            height={band.height}
            rx={3}
            fill={band.color}
          />
        </g>
      ))}
    </svg>
  );
}
