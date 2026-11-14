"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { NewWidgetSheet } from "@/components/dashboard/NewWidgetSheet";
import { ViewWizard, type ViewDraft } from "@/components/dashboard/ViewWizard";
import { WidgetCard } from "@/components/dashboard/WidgetCard";
import { useOverview } from "@/components/providers/OverviewProvider";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { PlusIcon } from "@/components/ui/icons";
import { api } from "@/lib/api-client";
import {
  VIEW_PERIODS,
  type DashboardPayload,
  type DashboardState,
  type DashboardView as SavedView,
  type ViewPeriod,
  type WidgetQuery,
} from "@/lib/contracts/chart";
import { formatMoney } from "@/lib/i18n/config";
import type { MessageKey } from "@/lib/i18n/translate";

interface InsightItem {
  id: string;
  severity: "warning" | "info" | "good";
  title: string;
  body: string;
  read: boolean;
}

export function DashboardView(): React.JSX.Element {
  const { t, locale } = usePreferences();
  const toast = useToast();
  const { overview } = useOverview();
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [banner, setBanner] = useState<InsightItem | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
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

  const active = dashboard?.views.find((view) => view.id === dashboard.activeId);
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

  function saveView(name: string, period: ViewPeriod): void {
    if (!active || !viewDraft) return;
    if (viewDraft.mode === "rename") {
      updateActive((view) => ({ ...view, name, period, preset: undefined }));
    } else {
      const id = `view-${Date.now()}`;
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
          {overview ? formatMoney(overview.balanceCents, locale) : "—"}
        </p>
        {forecast && forecast.status !== "insufficient_data" ? (
          <div className="mt-4 flex items-end justify-between gap-3 border-t border-white/15 pt-3">
            <div>
              <p className="text-xs opacity-80">
                {t(shortfall ? "dashboard.shortfall" : "dashboard.safeToSpend")}
              </p>
              <p className="text-xl font-semibold tabular-nums">
                {formatMoney(shortfall ? forecast.shortfallCents : forecast.availableCents, locale)}
              </p>
            </div>
            <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium">
              {t("dashboard.estimate")}
            </span>
          </div>
        ) : null}
      </section>

      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{t("dashboard.title")}</h1>
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="flex items-center gap-1 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary"
        >
          <PlusIcon className="size-4" />
          {t("dashboard.newWidget")}
        </button>
      </div>

      {dashboard ? (
        <section className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-3">
          <div
            role="tablist"
            aria-label={t("views.label")}
            className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
          >
            {dashboard.views.map((view) => (
              <button
                key={view.id}
                type="button"
                role="tab"
                aria-selected={view.id === dashboard.activeId}
                onClick={() => update((state) => ({ ...state, activeId: view.id }))}
                className={`shrink-0 rounded-full border px-3.5 py-2 text-sm font-medium ${
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
            <label htmlFor="view-period" className="text-xs font-medium text-muted">
              {t("views.period")}
            </label>
            <select
              id="view-period"
              value={active?.period ?? "last_month"}
              onChange={(event) =>
                updateActive((view) => ({ ...view, period: event.target.value as ViewPeriod }))
              }
              className="min-w-0 flex-1 rounded-full border border-border bg-background px-3 py-2 text-sm"
            >
              {VIEW_PERIODS.map((period) => (
                <option key={period} value={period}>
                  {t(`views.period.${period}` as MessageKey)}
                </option>
              ))}
            </select>
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
        <div className="flex flex-col gap-4">
          {(dashboard?.cards ?? []).map((widget) => (
            <WidgetCard
              key={widget.id}
              widget={widget}
              onRemove={(id) => {
                updateActive((view) => ({
                  ...view,
                  widgets: view.widgets.filter((item) => item.id !== id),
                }));
                toast.notify("toast.movedToBin");
              }}
              onChart={(id, chart) =>
                updateActive((view) => ({
                  ...view,
                  widgets: view.widgets.map((item) =>
                    item.id === id ? { ...item, query: { ...item.query, chart } } : item,
                  ),
                }))
              }
            />
          ))}
        </div>
      )}

      <ViewWizard draft={viewDraft} onClose={() => setViewDraft(null)} onSave={saveView} />

      <NewWidgetSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onAdd={(query: WidgetQuery) => {
          updateActive((view) => ({
            ...view,
            widgets: [{ id: `widget-${Date.now()}`, query }, ...view.widgets].slice(0, 16),
          }));
          toast.notify("toast.added");
        }}
      />
    </div>
  );
}
