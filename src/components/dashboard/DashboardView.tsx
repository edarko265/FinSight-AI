"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { NewWidgetSheet } from "@/components/dashboard/NewWidgetSheet";
import { WidgetCard } from "@/components/dashboard/WidgetCard";
import { useOverview } from "@/components/providers/OverviewProvider";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import { PlusIcon } from "@/components/ui/icons";
import { api } from "@/lib/api-client";
import type { ChartCard, DashboardWidget } from "@/lib/contracts/chart";
import { formatMoney } from "@/lib/i18n/config";

interface InsightItem {
  id: string;
  severity: "warning" | "info" | "good";
  title: string;
  body: string;
  read: boolean;
}

export function DashboardView(): React.JSX.Element {
  const { t, locale } = usePreferences();
  const { overview } = useOverview();
  const [widgets, setWidgets] = useState<DashboardWidget[] | null>(null);
  const [banner, setBanner] = useState<InsightItem | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api<{ widgets: DashboardWidget[] }>(`/api/dashboard?locale=${locale}`)
      .then((data) => {
        if (!cancelled) setWidgets(data.widgets);
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

  function save(next: DashboardWidget[]): void {
    setWidgets(next);
    void api(`/api/dashboard?locale=${locale}`, { method: "PUT", json: { widgets: next } }).catch(
      () => undefined,
    );
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

      {widgets && widgets.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted">
          {t("dashboard.empty")}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {(widgets ?? []).map((widget) => (
            <WidgetCard
              key={widget.id}
              widget={widget}
              onRemove={(id) => save((widgets ?? []).filter((item) => item.id !== id))}
            />
          ))}
        </div>
      )}

      <NewWidgetSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onAdd={(card: ChartCard) =>
          save([{ id: `widget-${Date.now()}`, ...card }, ...(widgets ?? [])])
        }
      />
    </div>
  );
}
