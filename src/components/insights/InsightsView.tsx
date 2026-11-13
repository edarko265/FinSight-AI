"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useOverview } from "@/components/providers/OverviewProvider";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import { api } from "@/lib/api-client";

interface InsightItem {
  id: string;
  severity: "warning" | "info" | "good";
  title: string;
  body: string;
  ask: string;
  read: boolean;
}

const TONE = {
  warning: "border-warning bg-warning-soft",
  info: "border-border bg-surface",
  good: "border-accent bg-accent-soft",
} as const;

/** In-app notifications: each one comes from the user's own data and opens the coach on that topic. */
export function InsightsView(): React.JSX.Element {
  const { t, locale } = usePreferences();
  const { refresh } = useOverview();
  const [insights, setInsights] = useState<InsightItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<{ insights: InsightItem[] }>(`/api/insights?locale=${locale}`)
      .then((data) => {
        if (!cancelled) setInsights(data.insights);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [locale]);

  async function markAllRead(): Promise<void> {
    await api("/api/insights", { method: "POST" });
    setInsights((current) => current?.map((insight) => ({ ...insight, read: true })) ?? null);
    refresh();
  }

  const unread = insights?.some((insight) => !insight.read) ?? false;

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{t("insights.title")}</h1>
        {unread ? (
          <button
            type="button"
            onClick={() => void markAllRead()}
            className="text-sm font-medium text-accent"
          >
            {t("insights.markRead")}
          </button>
        ) : null}
      </div>

      {insights && insights.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted">
          {t("insights.empty")}
        </p>
      ) : null}

      <ul className="flex flex-col gap-3">
        {insights?.map((insight) => (
          <li key={insight.id} className={`rounded-2xl border p-4 ${TONE[insight.severity]}`}>
            <div className="flex items-start gap-2">
              {!insight.read ? (
                <span
                  className="mt-1.5 size-2 shrink-0 rounded-full bg-accent"
                  aria-hidden="true"
                />
              ) : null}
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold">{insight.title}</h2>
                <p className="mt-1 text-sm text-muted">{insight.body}</p>
                <Link
                  href={`/chat?q=${encodeURIComponent(insight.ask)}`}
                  className="mt-2 inline-block text-sm font-medium text-accent"
                >
                  {t("insights.ask")} →
                </Link>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
