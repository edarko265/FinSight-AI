"use client";

import Link from "next/link";

import { useOverview } from "@/components/providers/OverviewProvider";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import { BellIcon, Logo } from "@/components/ui/icons";
import { formatDay } from "@/lib/i18n/config";

export function AppHeader(): React.JSX.Element {
  const { t, locale } = usePreferences();
  const { overview } = useOverview();
  const unread = overview?.unreadInsights ?? 0;

  return (
    <header className="shrink-0 bg-brand px-4 pt-[env(safe-area-inset-top)] text-on-brand">
      <div className="mx-auto flex w-full max-w-xl items-center justify-between gap-3 py-2.5 md:max-w-3xl xl:max-w-6xl">
        <Link href="/dashboard" className="flex items-center gap-2">
          {/* The logo's tile is the header's own green, so it gets an outline to stand apart. */}
          <Logo className="size-8 rounded-[22%] ring-1 ring-white/30 md:hidden" />
          <span className="flex flex-col leading-tight">
            <span className="text-base font-semibold tracking-tight">{t("app.name")}</span>
            <span className="text-[11px] opacity-75">
              {overview
                ? t("app.asOf", { date: formatDay(overview.asOf, locale) })
                : t("app.synthetic")}
            </span>
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-primary px-2.5 py-1 text-center text-[11px] leading-tight font-semibold text-on-primary">
            {t("app.synthetic")}
          </span>
          <Link
            href="/insights"
            aria-label={unread > 0 ? `${t("nav.insights")} (${unread})` : t("nav.insights")}
            className="relative -m-1 rounded-full p-1"
          >
            <BellIcon className="size-6" />
            {unread > 0 ? (
              <span className="absolute -top-0.5 -right-0.5 flex min-w-4.5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-on-primary">
                {unread}
              </span>
            ) : null}
          </Link>
        </div>
      </div>
    </header>
  );
}
