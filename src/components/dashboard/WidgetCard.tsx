"use client";

import { useEffect, useRef, useState } from "react";

import { ChartLabelsProvider } from "@/components/charts/chart-labels";
import { ChartView } from "@/components/charts/ChartView";
import { dragStartDelay } from "@/components/dashboard/widget-drag";
import { nextWidgetMode, type WidgetMode } from "@/components/dashboard/widget-edit-mode";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import { CloseIcon, SettingsIcon } from "@/components/ui/icons";
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
  /** The widget under the pointer while one is being dragged, or null. */
  onDragOver: (targetId: string | null) => void;
  /** Lets go of the dragged widget where it is. */
  onDrop: () => void;
  onDragStart: (id: string) => void;
}

interface WidgetCardProps extends WidgetHandlers {
  widget: DashboardWidget;
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
 * One widget on the dashboard. A press-and-hold on its title bar enters the
 * Android-like editing state: drag to move, or use the exposed controls to resize.
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
  over,
  dragged,
  children,
  onRemove,
  onChart,
  onCollapse,
  onResize,
  onDragOver,
  onDrop,
  onDragStart,
}: WidgetCardProps): React.JSX.Element {
  const { t } = usePreferences();
  const frame = useRef<HTMLElement>(null);
  const dragTimer = useRef<number | null>(null);
  const pendingDrag = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  // Dragging uses pointer events, so it works the same with a mouse, a pen and a finger.
  const [grabbing, setGrabbing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editing, setEditing] = useState<WidgetMode>("view");
  const isEditing = editing === "editing";
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

  useEffect(
    () => () => {
      if (dragTimer.current !== null) window.clearTimeout(dragTimer.current);
    },
    [],
  );

  useEffect(() => {
    // Native capture prevents Chrome's menu before it can be shown, even when a
    // pointer is captured by this header during a long press.
    function blockWidgetContextMenu(event: MouseEvent): void {
      if (event.target instanceof Element && event.target.closest("[data-widget-id]")) {
        event.preventDefault();
      }
    }

    window.addEventListener("contextmenu", blockWidgetContextMenu, true);
    return () => window.removeEventListener("contextmenu", blockWidgetContextMenu, true);
  }, []);

  useEffect(() => {
    if (!settingsOpen) return;
    function close(event: Event): void {
      if (event.target instanceof Node && frame.current?.contains(event.target)) return;
      setSettingsOpen(false);
    }
    function escape(event: KeyboardEvent): void {
      if (event.key === "Escape") setSettingsOpen(false);
    }
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [settingsOpen]);

  function clearPendingDrag(): void {
    pendingDrag.current = null;
    if (dragTimer.current !== null) window.clearTimeout(dragTimer.current);
    dragTimer.current = null;
  }

  function beginDrag(): void {
    clearPendingDrag();
    setEditing((mode) => nextWidgetMode(mode, "long-press"));
    setGrabbing(true);
    onDragStart(widget.id);
  }

  function startDrag(event: React.PointerEvent, immediate = false): void {
    event.currentTarget.setPointerCapture(event.pointerId);
    const delay = immediate ? 0 : dragStartDelay(event.pointerType);
    if (delay === 0) {
      beginDrag();
      return;
    }
    pendingDrag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    dragTimer.current = window.setTimeout(beginDrag, delay);
  }

  function dragMove(event: React.PointerEvent): void {
    const pending = pendingDrag.current;
    if (pending?.pointerId === event.pointerId) {
      // Let a finger that starts scrolling leave the card before the hold completes.
      if (Math.hypot(event.clientX - pending.x, event.clientY - pending.y) > 10) clearPendingDrag();
      return;
    }
    if (!grabbing) return;
    event.preventDefault();
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

  function finishDrag(event: React.PointerEvent): void {
    const wasGrabbing = grabbing;
    clearPendingDrag();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (wasGrabbing) onDrop();
    else setEditing((mode) => nextWidgetMode(mode, "tap-surface"));
    setGrabbing(false);
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
      onContextMenu={(event) => event.preventDefault()}
      onContextMenuCapture={(event) => event.preventDefault()}
      className={`${span} relative min-w-0 [-webkit-touch-callout:none] rounded-2xl border bg-surface transition-[box-shadow,opacity,transform] duration-150 motion-reduce:transition-none ${
        over ? "border-accent ring-2 ring-accent" : "border-border"
      } ${dragged ? "opacity-60" : ""} ${grabbing ? "z-10 scale-[1.02] border-accent shadow-xl" : ""} ${isEditing ? "ring-1 ring-accent" : ""} ${compact ? "p-3" : "p-4"}`}
    >
      <header
        onPointerDown={(event) => {
          if ((event.target as HTMLElement).closest("button, select, input, textarea, a")) return;
          startDrag(event);
        }}
        onPointerMove={dragMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        className={`flex cursor-grab touch-pan-y select-none items-center gap-1 ${grabbing ? "cursor-grabbing touch-none" : ""} ${compact ? "flex-wrap justify-between" : ""}`}
      >
        <h2
          className={`line-clamp-2 min-w-0 select-none font-semibold ${compact ? "order-first basis-full text-sm" : "flex-1 text-base"}`}
        >
          {title}
        </h2>
        {card && card.chart.kind !== "flow" ? (
          <button
            type="button"
            aria-expanded={settingsOpen}
            aria-label={`${t("nav.settings")}: ${title}`}
            title={t("nav.settings")}
            onClick={() => setSettingsOpen((open) => !open)}
            className={`${control} ${settingsOpen ? "bg-background" : ""}`}
          >
            <SettingsIcon className="size-4" />
          </button>
        ) : null}
        {isEditing ? (
          <>
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
          </>
        ) : null}
      </header>

      {settingsOpen && card && card.chart.kind !== "flow" ? (
        <div className="absolute right-3 top-12 z-20 w-56 rounded-xl border border-border bg-surface p-3 shadow-lg">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">{t("chart.type")}</span>
            <select
              value={card.chart.kind}
              onChange={(event) => onChart(widget.id, event.target.value as ChartStyle)}
              className="w-full rounded-full border border-border bg-background px-3 py-1.5 text-sm text-foreground"
            >
              {CHART_STYLES.map((style) => (
                <option key={style} value={style}>
                  {t(`chart.type.${style}` as MessageKey)}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      {widget.collapsed ? null : card ? (
        <div className="mt-1">
          <ChartLabelsProvider value>
            <ChartView card={card} compact />
          </ChartLabelsProvider>
          <InfoTip className="mt-1">
            <span className="block">{card.basis}</span>
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
        className={`absolute inset-y-3 right-0 w-2 cursor-ew-resize touch-none rounded-full ${isEditing ? "md:block" : "hidden"} ${
          pulling ? "bg-accent" : "hover:bg-border"
        }`}
      />
    </article>
  );
}
