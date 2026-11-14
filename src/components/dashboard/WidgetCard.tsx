"use client";

import { useRef, useState } from "react";

import { ChartLabelsProvider } from "@/components/charts/chart-labels";
import { ChartView } from "@/components/charts/ChartView";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import { CloseIcon } from "@/components/ui/icons";
import {
  CHART_STYLES,
  type ChartStyle,
  type DashboardWidget,
  type WidgetSize,
} from "@/lib/contracts/chart";
import type { MessageKey } from "@/lib/i18n/translate";
import { InfoTip } from "@/components/ui/InfoTip";

export interface WidgetHandlers {
  onRemove: (id: string) => void;
  /** Redraws the widget in another chart type. */
  onChart: (id: string, chart: ChartStyle) => void;
  onCollapse: (id: string, collapsed: boolean) => void;
  onResize: (id: string, size: WidgetSize) => void;
  /** Moves the widget one place earlier (-1) or later (1). */
  onMove: (id: string, by: -1 | 1) => void;
  /** The widget under the pointer while one is being dragged, or null. */
  onDragOver: (targetId: string | null) => void;
  /** Lets go of the dragged widget where it is. */
  onDrop: () => void;
  onDragStart: (id: string) => void;
}

interface WidgetCardProps extends WidgetHandlers {
  widget: DashboardWidget;
  /** Whether this is the first or last widget, to disable a move that would do nothing. */
  first: boolean;
  last: boolean;
  /** True while this widget is the one a dragged widget would land on. */
  over: boolean;
  /** True while this widget is the one being dragged. */
  dragged: boolean;
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
const SIZES: WidgetSize[] = ["small", "medium", "wide"];

/** The nearest ancestor that scrolls, so a drag near its edge can bring more widgets into view. */
function scroller(from: HTMLElement | null): HTMLElement | null {
  for (let node = from?.parentElement ?? null; node; node = node.parentElement) {
    const overflow = getComputedStyle(node).overflowY;
    if ((overflow === "auto" || overflow === "scroll") && node.scrollHeight > node.clientHeight) {
      return node;
    }
  }
  return null;
}

export function WidgetCard({
  widget,
  first,
  last,
  over,
  dragged,
  children,
  onRemove,
  onChart,
  onCollapse,
  onResize,
  onMove,
  onDragOver,
  onDrop,
  onDragStart,
}: WidgetCardProps): React.JSX.Element {
  const { t } = usePreferences();
  const frame = useRef<HTMLElement>(null);
  // Dragging uses pointer events, so it works the same with a mouse, a pen and a finger.
  const [grabbing, setGrabbing] = useState(false);
  // While the edge is being pulled, the size it would snap to.
  const [pulling, setPulling] = useState<{ startX: number; from: number; width: number } | null>(
    null,
  );
  const [preview, setPreview] = useState<WidgetSize | null>(null);
  const card = widget.card;
  const title = card?.title ?? t(`widget.${widget.action ?? "ask"}.title` as MessageKey);
  const size = preview ?? widget.size;
  const compact = Boolean(widget.action) && size === "small";
  const span = widget.action
    ? size === "wide"
      ? "col-span-2 xl:col-span-3"
      : size === "medium"
        ? "col-span-2"
        : "col-span-1"
    : size === "wide"
      ? "col-span-2 xl:col-span-3"
      : size === "medium"
        ? "col-span-2"
        : "col-span-2 md:col-span-1";
  const nextSize = SIZES[(SIZES.indexOf(widget.size) + 1) % SIZES.length] ?? "small";

  function dragMove(event: React.PointerEvent): void {
    if (!grabbing) return;
    const under = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>("[data-widget-id]");
    const target = under?.dataset.widgetId;
    onDragOver(target && target !== widget.id ? target : null);
    const box = scroller(frame.current);
    if (box) {
      const edge = box.getBoundingClientRect();
      if (event.clientY < edge.top + 70) box.scrollBy(0, -14);
      else if (event.clientY > edge.bottom - 70) box.scrollBy(0, 14);
    }
  }

  function pullMove(event: React.PointerEvent): void {
    if (!pulling) return;
    // One step for every column's width the edge is pulled.
    const steps = Math.round((event.clientX - pulling.startX) / Math.max(120, pulling.width));
    setPreview(SIZES[Math.min(SIZES.length - 1, Math.max(0, pulling.from + steps))] ?? "small");
  }

  return (
    <article
      ref={frame}
      data-widget-id={widget.id}
      className={`${span} relative min-w-0 rounded-2xl border bg-surface transition-shadow ${
        over ? "border-accent ring-2 ring-accent" : "border-border"
      } ${dragged ? "opacity-60" : ""} ${compact ? "p-3" : "p-4"}`}
    >
      <header className={`flex items-center gap-1 ${compact ? "flex-wrap justify-between" : ""}`}>
        <button
          type="button"
          aria-label={`${t("widget.drag")}: ${title}`}
          title={t("widget.drag")}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            setGrabbing(true);
            onDragStart(widget.id);
          }}
          onPointerMove={dragMove}
          onPointerUp={() => {
            if (grabbing) onDrop();
            setGrabbing(false);
          }}
          onPointerCancel={() => {
            setGrabbing(false);
            onDragOver(null);
            onDrop();
          }}
          className={`${control} -ml-1.5 touch-none ${grabbing ? "cursor-grabbing" : "cursor-grab"}`}
        >
          <Glyph d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01" />
        </button>
        <h2
          className={`line-clamp-2 min-w-0 font-semibold ${compact ? "order-first basis-full text-sm" : "flex-1 text-base"}`}
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
          aria-label={`${t("widget.resize")}: ${title}. ${t(`widget.size.${nextSize}` as MessageKey)}`}
          title={`${t("widget.resize")}: ${t(`widget.size.${nextSize}` as MessageKey)}`}
          onClick={() => onResize(widget.id, nextSize)}
          className={control}
        >
          <Glyph d="M10 12H3M3 12l3-3M3 12l3 3M14 12h7M21 12l-3-3M21 12l-3 3" />
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
          <ChartLabelsProvider value={false}>
            <ChartView card={card} />
          </ChartLabelsProvider>
          {card.chart.kind === "flow" ? null : (
            <label className="mt-3 flex items-center gap-2 text-sm text-muted">
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
          <InfoTip className="mt-1">
            <span className="block">{t(`chart.help.${card.chart.kind}` as MessageKey)}</span>
            <span className="mt-2 block">{card.basis}</span>
          </InfoTip>
        </div>
      ) : (
        <div className={compact ? "mt-2" : "mt-3"}>{children}</div>
      )}
      {/* Pull the right edge to make the widget wider or narrower; it snaps to the columns. */}
      <span
        role="separator"
        aria-orientation="vertical"
        aria-label={t("widget.resize")}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          const columns = SIZES.indexOf(widget.size) + 1;
          setPulling({
            startX: event.clientX,
            from: SIZES.indexOf(widget.size),
            width: (frame.current?.offsetWidth ?? 300) / columns,
          });
        }}
        onPointerMove={pullMove}
        onPointerUp={() => {
          if (preview && preview !== widget.size) onResize(widget.id, preview);
          setPulling(null);
          setPreview(null);
        }}
        onPointerCancel={() => {
          setPulling(null);
          setPreview(null);
        }}
        className={`absolute inset-y-3 right-0 hidden w-2 cursor-ew-resize touch-none rounded-full md:block ${
          pulling ? "bg-accent" : "hover:bg-border"
        }`}
      />
    </article>
  );
}
