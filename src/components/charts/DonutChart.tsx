"use client";

import type { ChartPoint } from "@/lib/contracts/chart";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import { formatMoney } from "@/lib/i18n/config";
import { chartColor } from "@/components/charts/chart-palette";

const SIZE = 140;
const RADIUS = 52;
const STROKE = 22;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function DonutChart({ points }: { points: ChartPoint[] }): React.JSX.Element {
  const { locale, t } = usePreferences();
  const whole = points.reduce((sum, point) => sum + point.valueCents, 0);
  const total = Math.max(whole, 1);

  const segments = points.map((point, index) => ({
    label: point.label,
    length: (point.valueCents / total) * CIRCUMFERENCE,
    offset:
      (points.slice(0, index).reduce((sum, earlier) => sum + earlier.valueCents, 0) / total) *
      CIRCUMFERENCE,
    color: chartColor(index),
  }));

  return (
    <div className="relative mx-auto w-44" aria-hidden="true">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-auto w-full">
        <g className="fs-draw">
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
        </g>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-xs text-muted">{t("chart.total")}</span>
        <span className="text-sm font-semibold tabular-nums">{formatMoney(whole, locale)}</span>
      </div>
    </div>
  );
}
