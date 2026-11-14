"use client";

import {
  averageCents,
  barPercent,
  barVariant,
  sortRanked,
  visibleLabelIndexes,
} from "@/components/charts/chart-data";
import { CHART_EMPHASIS, CHART_REST, chartColor } from "@/components/charts/chart-palette";
import { useChartLabels } from "@/components/charts/chart-labels";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import type { ChartPoint } from "@/lib/contracts/chart";
import { formatMoney } from "@/lib/i18n/config";

/**
 * Ranked comparison: one row per item, largest first. The name and the amount share a line (the
 * name wraps, the amount stays on the right), the bar sits right under them. The largest row is
 * the emphasis colour and bold; the rest are calmer. `keyed` gives each row its own series colour.
 */
export function RankedBars({
  points,
  keyed = false,
  sort = false,
}: {
  points: ChartPoint[];
  keyed?: boolean;
  /** Largest first. Only for rankings: a series the user picked keeps its own order. */
  sort?: boolean;
}): React.JSX.Element {
  const { locale } = usePreferences();
  const rows = sort ? sortRanked(points) : points;
  const max = Math.max(...rows.map((point) => point.valueCents), 1);
  const top = rows.findIndex((point) => point.valueCents === max);
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((point, index) => (
        <li key={`${index}-${point.label}`} className="flex flex-col gap-1">
          <span className="flex items-baseline justify-between gap-3 text-sm">
            <span className={`min-w-0 break-words ${index === top ? "font-semibold" : ""}`}>
              {point.label}
            </span>
            <span
              className={`shrink-0 whitespace-nowrap text-right tabular-nums ${
                index === top ? "font-semibold" : "text-muted"
              }`}
            >
              {formatMoney(point.valueCents, locale)}
            </span>
          </span>
          <span className="block h-3 w-full" aria-hidden="true">
            <span
              className="fs-grow-x block h-full rounded-full"
              style={{
                width: `${barPercent(point.valueCents, max)}%`,
                background: keyed ? chartColor(index) : index === top ? CHART_EMPHASIS : CHART_REST,
              }}
            />
          </span>
        </li>
      ))}
    </ul>
  );
}

const COLUMN_HEIGHT = 112;
/** With this many columns or fewer each column has room for its own amount above it. */
const VALUES_ON_COLUMNS = 4;

/**
 * Time series: one column per period in calendar order, the latest in the emphasis colour and a
 * dashed line at the average. The amounts are written on the columns when there is room, and the
 * list under the chart always carries all of them.
 */
export function Columns({ points }: { points: ChartPoint[] }): React.JSX.Element {
  const { locale, t } = usePreferences();
  const labels = useChartLabels();
  const max = Math.max(...points.map((point) => point.valueCents), 1);
  const average = averageCents(points);
  const averageY = (barPercent(average, max) / 100) * COLUMN_HEIGHT;
  const shownLabels = new Set(visibleLabelIndexes(points.length));
  const showValues = labels && points.length <= VALUES_ON_COLUMNS;
  return (
    <div>
      <div className="relative" style={{ height: COLUMN_HEIGHT + (showValues ? 20 : 0) }}>
        <div
          className="absolute inset-x-0 border-t-2 border-dashed border-foreground/60"
          style={{ bottom: averageY }}
          aria-hidden="true"
        />
        <div className="absolute inset-0 flex items-end gap-2" aria-hidden="true">
          {points.map((point, index) => {
            const height = (barPercent(point.valueCents, max) / 100) * COLUMN_HEIGHT;
            const latest = index === points.length - 1;
            return (
              <div
                key={`${index}-${point.label}`}
                className="flex min-w-0 flex-1 flex-col items-center"
              >
                {showValues ? (
                  <span
                    className={`relative mb-1 rounded bg-surface px-0.5 text-xs tabular-nums ${latest ? "font-semibold" : "text-muted"}`}
                  >
                    {formatMoney(point.valueCents, locale)}
                  </span>
                ) : null}
                <div
                  className="fs-grow-y w-full rounded-t-md"
                  style={{
                    height,
                    background: latest ? CHART_EMPHASIS : CHART_REST,
                    animationDelay: `${index * 0.05}s`,
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>
      {labels ? (
        <div className="mt-1 flex gap-2 text-xs text-muted" aria-hidden="true">
          {points.map((point, index) => (
            <span key={`${index}-${point.label}`} className="min-w-0 flex-1 text-center">
              {shownLabels.has(index) ? point.label : ""}
            </span>
          ))}
        </div>
      ) : null}
      {labels ? (
        <p className="mt-2 text-sm text-muted">
          {t("chart.caption.columns", { average: formatMoney(average, locale) })}
        </p>
      ) : null}
    </div>
  );
}

/** Bars: a calendar series as columns, anything else as ranked rows. */
export function BarChart({ points }: { points: ChartPoint[] }): React.JSX.Element {
  return barVariant(points) === "columns" ? (
    <Columns points={points} />
  ) : (
    <RankedBars points={points} sort />
  );
}
