"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ActionWidgetBody } from "@/components/dashboard/ActionWidgets";
import { AddWidgetWizard } from "@/components/dashboard/AddWidgetWizard";
import { AffordWizard } from "@/components/dashboard/AffordWizard";
import { NewWidgetSheet } from "@/components/dashboard/NewWidgetSheet";
import { PeriodWizard } from "@/components/dashboard/PeriodWizard";
import { ViewWizard, type ViewDraft } from "@/components/dashboard/ViewWizard";
import { WidgetCard } from "@/components/dashboard/WidgetCard";
import { useOverview } from "@/components/providers/OverviewProvider";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { CountUp } from "@/components/ui/CountUp";
import { DASHBOARD_CHANGED } from "@/components/chat/PinnableChat";
import { PlusIcon } from "@/components/ui/icons";
import { api } from "@/lib/api-client";
import {
  CUSTOM_PERIOD,
  VIEW_PERIODS,
  type DashboardPayload,
  type DashboardState,
  type DashboardView as SavedView,
  type SavedWidget,
  type ViewPeriod,
  type WidgetQuery,
} from "@/lib/contracts/chart";
import { formatDay } from "@/lib/i18n/config";
import type { MessageKey } from "@/lib/i18n/translate";

interface InsightItem {
  id: string;
  severity: "warning" | "info" | "good";
  title: string;
  body: string;
  read: boolean;
}

/** A fresh ID for something the customer just created. */
function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function DashboardView(): React.JSX.Element {
  const { t, locale } = usePreferences();
  const toast = useToast();
  const { overview } = useOverview();
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [banner, setBanner] = useState<InsightItem | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [affordOpen, setAffordOpen] = useState(false);
  const [periodOpen, setPeriodOpen] = useState(false);
  const [viewDraft, setViewDraft] = useState<ViewDraft | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<DashboardPayload>(`/api/dashboard?locale=${locale}`)
      .then((data) => {
        if (!cancelled) setDashboard(data);
      })
      .catch(() => undefined);
    api<{ insights: InsightItem[] }>(`/api/insights?locale=${locale}`)
      .then((data) => {
        if (!cancelled) setBanner(data.insights.find((insight) => !insight.read) ?? null);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [locale]);

  // A chart pinned from the floating coach changes the dashboard open behind it.
  useEffect(() => {
    const reload = (): void => {
      api<DashboardPayload>(`/api/dashboard?locale=${locale}`)
        .then(setDashboard)
        .catch(() => undefined);
    };
    window.addEventListener(DASHBOARD_CHANGED, reload);
    return () => window.removeEventListener(DASHBOARD_CHANGED, reload);
  }, [locale]);

  const active = dashboard?.views.find((view) => view.id === dashboard.activeId);
  const customMatch = active ? CUSTOM_PERIOD.exec(active.period) : null;
  const customRange =
    customMatch?.[1] && customMatch[2] ? { from: customMatch[1], to: customMatch[2] } : null;
  const viewName = (view: SavedView): string =>
    view.name ||
    (view.preset ? t(`views.preset.${view.preset}` as MessageKey) : t("views.unnamed"));

  function save(next: DashboardState): void {
    void api<DashboardPayload>(`/api/dashboard?locale=${locale}`, { method: "PUT", json: next })
      .then(setDashboard)
      .catch(() => undefined);
  }

  function update(change: (state: DashboardState) => DashboardState): void {
    if (!dashboard) return;
    save(change({ activeId: dashboard.activeId, views: dashboard.views }));
  }

  const updateActive = (change: (view: SavedView) => SavedView): void =>
    update((state) => ({
      ...state,
      views: state.views.map((view) => (view.id === state.activeId ? change(view) : view)),
    }));

  const changeWidget = (id: string, change: (widget: SavedWidget) => SavedWidget): void =>
    updateActive((view) => ({
      ...view,
      widgets: view.widgets.map((item) => (item.id === id ? change(item) : item)),
    }));

  /** Puts widget `id` at the place of widget `beforeId`, shifting the rest along. */
  function reorder(id: string, beforeId: string): void {
    if (id === beforeId) return;
    updateActive((view) => {
      const moving = view.widgets.find((item) => item.id === id);
      if (!moving) return view;
      const from = view.widgets.findIndex((item) => item.id === id);
      const to = view.widgets.findIndex((item) => item.id === beforeId);
      const rest = view.widgets.filter((item) => item.id !== id);
      // Dragging downwards lands after the target, upwards before it: where the eye expects.
      const at = rest.findIndex((item) => item.id === beforeId) + (from < to ? 1 : 0);
      return { ...view, widgets: [...rest.slice(0, at), moving, ...rest.slice(at)] };
    });
  }

  function addWidget(widget: Omit<SavedWidget, "id">): void {
    updateActive((view) => ({
      ...view,
      widgets: [{ id: newId("widget"), ...widget }, ...view.widgets].slice(0, 24),
    }));
    toast.notify("toast.added");
  }

  function saveView(name: string, period: ViewPeriod): void {
    if (!active || !viewDraft) return;
    if (viewDraft.mode === "rename") {
      updateActive((view) => ({ ...view, name, period, preset: undefined }));
    } else {
      const id = newId("view");
      update((state) => ({
        activeId: id,
        views: [...state.views, { id, name, period, widgets: active.widgets }],
      }));
    }
    toast.notify("toast.saved");
    setViewDraft(null);
  }

  const forecast = overview?.forecast;
  const shortfall = forecast?.status === "shortfall";

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      {banner ? (
        <Link
          href="/insights"
          className={`flex flex-col gap-0.5 rounded-2xl border px-4 py-3 text-sm ${
            banner.severity === "warning"
              ? "border-warning bg-warning-soft"
              : "border-border bg-accent-soft"
          }`}
        >
          <span className="font-semibold">{banner.title}</span>
          <span className="text-muted">{banner.body}</span>
        </Link>
      ) : null}

      <section className="rounded-2xl bg-brand p-5 text-on-brand">
        <p className="text-sm opacity-80">{t("dashboard.balance")}</p>
        <p className="mt-1 text-3xl font-semibold tabular-nums">
          {overview ? <CountUp cents={overview.balanceCents} locale={locale} /> : "—"}
        </p>
        {forecast && forecast.status !== "insufficient_data" ? (
          <div className="mt-4 flex items-end justify-between gap-3 border-t border-white/15 pt-3">
            <div>
              <p className="text-sm opacity-80">
                {t(shortfall ? "dashboard.shortfall" : "dashboard.safeToSpend")}
              </p>
              <p className="text-xl font-semibold tabular-nums">
                <CountUp
                  cents={shortfall ? forecast.shortfallCents : forecast.availableCents}
                  locale={locale}
                />
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAffordOpen(true)}
              className="rounded-full bg-primary px-3.5 py-2 text-sm font-semibold text-on-primary"
            >
              {t("afford.cta")}
            </button>
          </div>
        ) : null}
      </section>

      <Link
        href="/story"
        className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-3 text-sm font-semibold"
      >
        <span className="flex items-center gap-3">
          <span
            className="flex size-9 items-center justify-center rounded-full bg-accent-soft text-accent"
            aria-hidden="true"
          >
            ▶
          </span>
          {t("story.cta")}
        </span>
        <span className="text-accent" aria-hidden="true">
          →
        </span>
      </Link>

      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{t("dashboard.title")}</h1>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-1 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary"
        >
          <PlusIcon className="size-4" />
          {t("dashboard.newWidget")}
        </button>
      </div>

      {dashboard ? (
        <section className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-3">
          <div role="tablist" aria-label={t("views.label")} className="flex flex-wrap gap-2">
            {dashboard.views.map((view) => (
              <button
                key={view.id}
                type="button"
                role="tab"
                aria-selected={view.id === dashboard.activeId}
                onClick={() => update((state) => ({ ...state, activeId: view.id }))}
                className={`max-w-full truncate rounded-full border px-3.5 py-2 text-sm font-medium ${
                  view.id === dashboard.activeId
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-border text-muted"
                }`}
              >
                {viewName(view)}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="view-period" className="text-sm font-medium text-muted">
              {t("views.period")}
            </label>
            <select
              id="view-period"
              value={customRange ? "custom" : (active?.period ?? "last_month")}
              onChange={(event) => {
                if (event.target.value === "custom") setPeriodOpen(true);
                else
                  updateActive((view) => ({ ...view, period: event.target.value as ViewPeriod }));
              }}
              className="min-w-0 flex-1 rounded-full border border-border bg-background px-3 py-2 text-sm"
            >
              {VIEW_PERIODS.map((period) => (
                <option key={period} value={period}>
                  {t(`views.period.${period}` as MessageKey)}
                </option>
              ))}
              <option value="custom">
                {customRange
                  ? `${formatDay(customRange.from, locale)} – ${formatDay(customRange.to, locale)}`
                  : t("views.period.custom")}
              </option>
            </select>
            {customRange ? (
              <button
                type="button"
                onClick={() => setPeriodOpen(true)}
                className="shrink-0 text-sm font-medium text-accent"
              >
                {t("common.edit")}
              </button>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm">
            <button
              type="button"
              onClick={() =>
                setViewDraft({ mode: "new", name: "", period: active?.period ?? "last_month" })
              }
              className="font-medium text-accent"
            >
              {t("views.saveAs")}
            </button>
            <button
              type="button"
              onClick={() =>
                setViewDraft({
                  mode: "rename",
                  name: active ? viewName(active) : "",
                  period: active?.period ?? "last_month",
                })
              }
              className="font-medium text-accent"
            >
              {t("views.rename")}
            </button>
            {dashboard.views.length > 1 ? (
              <button
                type="button"
                onClick={() => {
                  update((state) => ({
                    ...state,
                    views: state.views.filter((view) => view.id !== state.activeId),
                  }));
                  toast.notify("toast.movedToBin");
                }}
                className="text-muted"
              >
                {t("common.moveToBin")}
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      {dashboard && dashboard.cards.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted">
          {t("dashboard.empty")}
        </p>
      ) : (
        <div className="grid grid-flow-row-dense grid-cols-2 items-start gap-3 md:gap-4 xl:grid-cols-3">
          {(dashboard?.cards ?? []).map((widget, index, all) => (
            <WidgetCard
              key={widget.id}
              widget={widget}
              first={index === 0}
              last={index === all.length - 1}
              dragging={dragId !== null && dragId !== widget.id}
              onDragStart={setDragId}
              onDragEnd={() => setDragId(null)}
              onDropOn={(targetId) => {
                if (dragId) reorder(dragId, targetId);
                setDragId(null);
              }}
              onMove={(id, by) => {
                const neighbour = all[index + by];
                if (neighbour) reorder(id, neighbour.id);
              }}
              onResize={(id, size) => changeWidget(id, (item) => ({ ...item, size }))}
              onCollapse={(id, collapsed) => changeWidget(id, (item) => ({ ...item, collapsed }))}
              onChart={(id, chart) =>
                changeWidget(id, (item) => ({ ...item, query: { ...item.query, chart } }))
              }
              onRemove={(id) => {
                updateActive((view) => ({
                  ...view,
                  widgets: view.widgets.filter((item) => item.id !== id),
                }));
                toast.notify("toast.movedToBin");
              }}
            >
              {widget.action ? (
                <ActionWidgetBody action={widget.action} onAfford={() => setAffordOpen(true)} />
              ) : null}
            </WidgetCard>
          ))}
        </div>
      )}

      <AffordWizard open={affordOpen} onClose={() => setAffordOpen(false)} />
      {overview ? (
        <PeriodWizard
          key={active?.period}
          open={periodOpen}
          asOf={overview.asOf}
          initial={customRange ?? undefined}
          onClose={() => setPeriodOpen(false)}
          onApply={(from, to) => {
            updateActive((view) => ({ ...view, period: `${from}..${to}` }));
            setPeriodOpen(false);
            toast.notify("toast.saved");
          }}
        />
      ) : null}
      <ViewWizard draft={viewDraft} onClose={() => setViewDraft(null)} onSave={saveView} />

      <AddWidgetWizard
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdd={addWidget}
        onDescribe={() => setSheetOpen(true)}
      />
      <NewWidgetSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onAdd={(query: WidgetQuery) => addWidget({ query })}
      />
    </div>
  );
}
