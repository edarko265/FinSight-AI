"use client";

import Link from "next/link";

import { showHeaderBalance } from "@/components/dashboard/balance-visibility";
import { useOverview } from "@/components/providers/OverviewProvider";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import { Logo } from "@/components/ui/icons";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatDay, formatMoney } from "@/lib/i18n/config";

export function AppHeader(): React.JSX.Element {
  const { t, locale } = usePreferences();
  const { overview, overviewLoading, dashboardBalanceVisible } = useOverview();

  return (
    <header className="shrink-0 bg-brand px-4 pt-[env(safe-area-inset-top)] text-on-brand">
      <div className="mx-auto flex w-full max-w-xl items-center justify-between gap-3 py-2.5 md:max-w-3xl xl:max-w-6xl">
        <Link href="/dashboard" className="flex items-center gap-2">
          {/* The logo's tile is the header's own green, so it gets an outline to stand apart. */}
          <Logo className="size-8 rounded-[22%] ring-1 ring-white/30 md:hidden" />
          <span className="flex flex-col leading-tight">
            <span className="text-base font-semibold tracking-tight">{t("app.name")}</span>
            <span className="text-xs">
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
          {overview && showHeaderBalance(dashboardBalanceVisible) ? (
            <span
              aria-label={t("dashboard.balance")}
              className="rounded-full bg-white/15 px-2.5 py-1 text-sm font-semibold tabular-nums"
            >
              {formatMoney(overview.balanceCents, locale)}
            </span>
          ) : null}
          <span className="rounded-full bg-primary px-2.5 py-1 text-center text-xs leading-tight font-semibold text-on-primary">
            {t("app.synthetic")}
          </span>
        </div>
      </div>
    </header>
  );
}
