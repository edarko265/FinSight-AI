"use client";

import { CHART_LABEL_SIZE } from "@/components/charts/chart-palette";
import { useChartLabels } from "@/components/charts/chart-labels";
import { averageCents } from "@/components/charts/chart-data";
import { CHART_EMPHASIS } from "@/components/charts/chart-palette";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import type { ChartPoint } from "@/lib/contracts/chart";
import { formatMoney } from "@/lib/i18n/config";

const WIDTH = 300;
const HEIGHT = 150;
const LABEL_SPACE = 26;
const PAD_X = 16;
const PAD_TOP = 10;

export function LineChart({ points }: { points: ChartPoint[] }): React.JSX.Element {
  const labels = useChartLabels();
  const { locale, t } = usePreferences();
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
  const lastPoint = points[points.length - 1];
  const average = averageCents(points);
  const averageY = PAD_TOP + plotHeight - ((average - min) / span) * plotHeight;

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full" aria-hidden="true">
      <line
        x1={0}
        x2={WIDTH}
        y1={averageY}
        y2={averageY}
        stroke="var(--foreground)"
        strokeOpacity={0.6}
        strokeWidth={1.5}
        strokeDasharray="5 4"
      />
      {labels ? (
        <text x={WIDTH} y={averageY - 4} textAnchor="end" fontSize={12} fill="var(--muted)">
          {t("chart.average", { amount: formatMoney(average, locale) })}
        </text>
      ) : null}
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
      {last ? <circle cx={last.x} cy={last.y} r={6} fill={CHART_EMPHASIS} /> : null}
      {labels && last && lastPoint ? (
        <text
          x={last.x}
          y={Math.max(last.y - 11, 12)}
          textAnchor="end"
          fontSize={13}
          fontWeight={600}
          fill="var(--foreground)"
        >
          {formatMoney(lastPoint.valueCents, locale)}
        </text>
      ) : null}
    </svg>
  );
}
