"use client";

import { ChartView } from "@/components/charts/ChartView";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import { CloseIcon } from "@/components/ui/icons";
import { CHART_STYLES, type ChartStyle, type DashboardWidget } from "@/lib/contracts/chart";
import type { MessageKey } from "@/lib/i18n/translate";

interface WidgetCardProps {
  widget: DashboardWidget;
  onRemove: (id: string) => void;
  /** Lets the user redraw this widget as bars, a line or a pie. */
  onChart?: (id: string, chart: ChartStyle) => void;
}

export function WidgetCard({ widget, onRemove, onChart }: WidgetCardProps): React.JSX.Element {
  const { t } = usePreferences();
  return (
    <article className="rounded-2xl border border-border bg-surface p-4">
      <header className="mb-1 flex items-start justify-between gap-3">
        <h2 className="text-base font-semibold">{widget.title}</h2>
        <button
          type="button"
          onClick={() => onRemove(widget.id)}
          aria-label={`${t("dashboard.remove")}: ${widget.title}`}
          className="-m-2 rounded-full p-2 text-muted"
        >
          <CloseIcon className="size-5" />
        </button>
      </header>
      <p className="mb-3 text-sm text-muted">{widget.summary}</p>
      <ChartView card={widget} />
      {onChart ? (
        <div
          role="radiogroup"
          aria-label={t("chart.type")}
          className="mt-3 flex gap-1 rounded-full bg-background p-1"
        >
          {CHART_STYLES.map((style) => (
            <button
              key={style}
              type="button"
              role="radio"
              aria-checked={widget.chart.kind === style}
              onClick={() => onChart(widget.id, style)}
              className={`flex-1 rounded-full px-2 py-1.5 text-xs font-medium ${
                widget.chart.kind === style ? "bg-surface text-accent shadow-sm" : "text-muted"
              }`}
            >
              {t(`chart.type.${style}` as MessageKey)}
            </button>
          ))}
        </div>
      ) : null}
      <p className="mt-3 text-xs text-muted">{widget.basis}</p>
    </article>
  );
}
