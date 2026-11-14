"use client";

import Link from "next/link";

import { useOverview } from "@/components/providers/OverviewProvider";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import { useLoad } from "@/components/shared/useLoad";
import { LoadError } from "@/components/ui/LoadError";
import { SkeletonList, LoadingRegion } from "@/components/ui/Skeleton";
import { PendingLabel } from "@/components/ui/Spinner";
import { useAsyncAction } from "@/components/ui/useAsyncAction";
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
  const {
    data,
    failed,
    retry,
    setData: setInsights,
    headingRef,
  } = useLoad(() => api<{ insights: InsightItem[] }>(`/api/insights?locale=${locale}`), locale);
  const insights = data?.insights ?? null;

  const markAllRead = useAsyncAction(() => api("/api/insights", { method: "POST" }), {
    successKey: "toast.markedRead",
  });

  async function onMarkAllRead(): Promise<void> {
    const result = await markAllRead.run();
    if (!result.ok) return;
    setInsights((current) =>
      current
        ? { insights: current.insights.map((insight) => ({ ...insight, read: true })) }
        : null,
    );
    refresh();
  }

  const unread = insights?.some((insight) => !insight.read) ?? false;

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <h1 ref={headingRef} tabIndex={-1} className="text-xl font-semibold focus:outline-none">
          {t("insights.title")}
        </h1>
        {unread ? (
          <button
            type="button"
            aria-disabled={markAllRead.pending}
            onClick={() => void onMarkAllRead()}
            className="min-h-11 text-sm font-medium text-accent"
          >
            {markAllRead.pending ? (
              <PendingLabel>{t("common.saving")}</PendingLabel>
            ) : (
              t("insights.markRead")
            )}
          </button>
        ) : null}
      </div>

      {failed ? <LoadError onRetry={retry} /> : null}
      {!insights && !failed ? (
        <LoadingRegion>
          <SkeletonList rows={4} />
        </LoadingRegion>
      ) : null}

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
                {insight.ask ? (
                  <Link
                    href={`/chat?q=${encodeURIComponent(insight.ask)}`}
                    className="mt-2 inline-block text-sm font-medium text-accent"
                  >
                    {t("insights.ask")} →
                  </Link>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
