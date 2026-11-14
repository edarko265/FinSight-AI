"use client";

import Link from "next/link";

import { useOverview } from "@/components/providers/OverviewProvider";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import { BellIcon, Logo } from "@/components/ui/icons";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatDay } from "@/lib/i18n/config";

export function AppHeader(): React.JSX.Element {
  const { t, locale } = usePreferences();
  const { overview, overviewLoading } = useOverview();
  const unread = overview?.unreadInsights ?? 0;

  return (
    <header className="shrink-0 bg-brand px-4 pt-[env(safe-area-inset-top)] text-on-brand">
      <div className="mx-auto flex w-full max-w-xl items-center justify-between gap-3 py-2.5 md:max-w-3xl xl:max-w-6xl">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Logo className="size-8 md:hidden" />
          <span className="flex flex-col leading-tight">
            <span className="text-base font-semibold tracking-tight">{t("app.name")}</span>
            <span className="text-sm">
              {overview ? (
                t("app.asOf", { date: formatDay(overview.asOf, locale) })
              ) : overviewLoading ? (
                <Skeleton className="h-4 w-24 bg-white/20" />
              ) : (
                t("app.synthetic")
              )}
            </span>
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-primary px-2.5 py-1 text-center text-xs leading-tight font-semibold text-on-primary">
            {t("app.synthetic")}
          </span>
          <Link
            href="/insights"
            aria-label={unread > 0 ? `${t("nav.insights")} (${unread})` : t("nav.insights")}
            className="relative -m-1 rounded-full p-1"
          >
            <BellIcon className="size-6" />
            {unread > 0 ? (
              <span className="absolute -top-0.5 -right-0.5 flex min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-bold text-on-primary">
                {unread}
              </span>
            ) : null}
          </Link>
        </div>
      </div>
    </header>
  );
}
