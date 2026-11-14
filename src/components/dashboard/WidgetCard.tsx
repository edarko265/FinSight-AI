"use client";

import { useRef, useState } from "react";

import { ChartView } from "@/components/charts/ChartView";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import { CloseIcon } from "@/components/ui/icons";
import { CHART_STYLES, type ChartStyle, type DashboardWidget } from "@/lib/contracts/chart";
import type { MessageKey } from "@/lib/i18n/translate";

export interface WidgetHandlers {
  onRemove: (id: string) => void;
  /** Redraws the widget in another chart type. */
  onChart: (id: string, chart: ChartStyle) => void;
  onCollapse: (id: string, collapsed: boolean) => void;
  onResize: (id: string, size: "small" | "wide") => void;
  /** Moves the widget one place earlier (-1) or later (1). */
  onMove: (id: string, by: -1 | 1) => void;
  /** Drops the widget being dragged in front of this one. */
  onDropOn: (targetId: string) => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
}

interface WidgetCardProps extends WidgetHandlers {
  widget: DashboardWidget;
  /** Whether this is the first or last widget, to disable a move that would do nothing. */
  first: boolean;
  last: boolean;
  /** True while another widget is being dragged, so this one can show it is a drop target. */
  dragging: boolean;
  /** What an action widget shows. Calculations draw their own chart. */
  children?: React.ReactNode;
}

const control =
  "flex size-8 shrink-0 items-center justify-center rounded-full text-muted outline-none hover:bg-background focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-30";

function Glyph({ d }: { d: string }): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

/**
 * One widget on the dashboard. The title bar carries everything that can be
 * done to it: drag to move (or the arrows, for touch and keyboard), make it
 * small or wide, minimise it to the bar, and remove it to the recycle bin.
 */
export function WidgetCard({
  widget,
  first,
  last,
  dragging,
  children,
  onRemove,
  onChart,
  onCollapse,
  onResize,
  onMove,
  onDropOn,
  onDragStart,
  onDragEnd,
}: WidgetCardProps): React.JSX.Element {
  const { t } = usePreferences();
  // Only the grip can be dragged, so text inside the card can still be selected; the whole
  // card is shown as what is being moved.
  const frame = useRef<HTMLElement>(null);
  const [over, setOver] = useState(false);
  const card = widget.card;
  const title = card?.title ?? t(`widget.${widget.action ?? "ask"}.title` as MessageKey);
  const compact = Boolean(widget.action) && widget.size === "small";
  const span = widget.action
    ? widget.size === "wide"
      ? "col-span-2 xl:col-span-2"
      : "col-span-1"
    : widget.size === "wide"
      ? "col-span-2 md:col-span-2"
      : "col-span-2 md:col-span-1";

  return (
    <article
      ref={frame}
      onDragOver={(event) => {
        if (!dragging) return;
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        onDropOn(widget.id);
      }}
      className={`${span} min-w-0 rounded-2xl border bg-surface transition-shadow ${
        over ? "border-accent ring-2 ring-accent" : "border-border"
      } ${compact ? "p-3" : "p-4"}`}
    >
      <header className={`flex items-center gap-1 ${compact ? "flex-wrap justify-end" : ""}`}>
        <button
          type="button"
          aria-label={`${t("widget.drag")}: ${title}`}
          title={t("widget.drag")}
          draggable
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", widget.id);
            if (frame.current) event.dataTransfer.setDragImage(frame.current, 24, 24);
            onDragStart(widget.id);
          }}
          onDragEnd={() => {
            setOver(false);
            onDragEnd();
          }}
          className={`${control} -ml-1.5 hidden cursor-grab active:cursor-grabbing md:flex`}
        >
          <Glyph d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01" />
        </button>
        <h2
          className={`line-clamp-2 min-w-0 font-semibold ${compact ? "basis-full text-sm" : "flex-1 text-base"}`}
        >
          {title}
        </h2>
        {compact ? null : (
          <>
            <button
              type="button"
              disabled={first}
              aria-label={`${t("widget.moveEarlier")}: ${title}`}
              title={t("widget.moveEarlier")}
              onClick={() => onMove(widget.id, -1)}
              className={`${control} md:hidden`}
            >
              <Glyph d="M12 19V5M5 12l7-7 7 7" />
            </button>
            <button
              type="button"
              disabled={last}
              aria-label={`${t("widget.moveLater")}: ${title}`}
              title={t("widget.moveLater")}
              onClick={() => onMove(widget.id, 1)}
              className={`${control} md:hidden`}
            >
              <Glyph d="M12 5v14M5 12l7 7 7-7" />
            </button>
          </>
        )}
        <button
          type="button"
          aria-label={`${t(widget.size === "wide" ? "widget.makeSmall" : "widget.makeWide")}: ${title}`}
          title={t(widget.size === "wide" ? "widget.makeSmall" : "widget.makeWide")}
          onClick={() => onResize(widget.id, widget.size === "wide" ? "small" : "wide")}
          className={control}
        >
          <Glyph
            d={
              widget.size === "wide"
                ? "M4 12h6M10 12l-3-3M10 12l-3 3M20 12h-6M14 12l3-3M14 12l3 3"
                : "M10 12H3M3 12l3-3M3 12l3 3M14 12h7M21 12l-3-3M21 12l-3 3"
            }
          />
        </button>
        <button
          type="button"
          aria-expanded={!widget.collapsed}
          aria-label={`${t(widget.collapsed ? "widget.expand" : "widget.minimise")}: ${title}`}
          title={t(widget.collapsed ? "widget.expand" : "widget.minimise")}
          onClick={() => onCollapse(widget.id, !widget.collapsed)}
          className={control}
        >
          <Glyph d={widget.collapsed ? "M12 5v14M5 12h14" : "M5 12h14"} />
        </button>
        <button
          type="button"
          onClick={() => onRemove(widget.id)}
          aria-label={`${t("dashboard.remove")}: ${title}`}
          title={t("dashboard.remove")}
          className={`${control} -mr-1.5`}
        >
          <CloseIcon className="size-4" />
        </button>
      </header>

      {widget.collapsed ? null : card ? (
        <div className="mt-1">
          <p className="mb-3 text-sm text-muted">{card.summary}</p>
          <ChartView card={card} />
          {card.chart.kind === "flow" ? null : (
            <label className="mt-3 flex items-center gap-2 text-xs text-muted">
              {t("chart.type")}
              <select
                value={card.chart.kind}
                onChange={(event) => onChart(widget.id, event.target.value as ChartStyle)}
                className="min-w-0 flex-1 rounded-full border border-border bg-background px-3 py-1.5 text-sm text-foreground"
              >
                {CHART_STYLES.map((style) => (
                  <option key={style} value={style}>
                    {t(`chart.type.${style}` as MessageKey)}
                  </option>
                ))}
              </select>
            </label>
          )}
          <p className="mt-3 text-xs text-muted">{card.basis}</p>
        </div>
      ) : (
        <div className={compact ? "mt-2" : "mt-3"}>{children}</div>
      )}
    </article>
  );
}
