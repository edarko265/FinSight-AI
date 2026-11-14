"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import type { AppSettings } from "@/components/admin/AdminControls";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import { ChangePassword } from "@/components/admin/ChangePassword";
import { LanguagePicker } from "@/components/settings/LanguagePicker";
import { TwoStep } from "@/components/settings/TwoStep";
import { Logo } from "@/components/ui/icons";
import { PendingLabel } from "@/components/ui/Spinner";
import { useAsyncAction } from "@/components/ui/useAsyncAction";
import { SIGNED_OUT_EVENT } from "@/lib/api-client";
import { LOCALE_INFO } from "@/lib/i18n/config";
import type { MessageKey } from "@/lib/i18n/translate";

export type AdminRole = "owner" | "admin" | "adviser" | "banker";

export interface AdminData {
  /** Who is signed in. The owner has no name: they use the installation password. */
  me: { id: string; role: AdminRole; name: string };
  /** How many days the usage figures cover: 7, 30 or 90. */
  days: number;
  system: {
    customers: number;
    transactions: number;
    ingestedAt: string | null;
    sourceChecksum: string | null;
    benchmarkGroups: number;
    activeSessions: number;
    asOf: string;
    database: "postgres" | "embedded";
    encryption: { algorithm: string; keyId: string };
    ai: { enabled: boolean; model: string | null; available: string[] };
    voice: boolean;
    spendingByAge: { ageBand: string; groupSize: number; medianCents: number }[];
  };
  usage: {
    totalQuestions: number;
    byTopic: { topic: string; count: number }[];
    byLocale: { locale: string; count: number }[];
    byMode: { mode: string; count: number }[];
    daily: { day: string; count: number }[];
    unanswered: number;
    consentAccepted: number;
    consentWithdrawn: number;
    goalsSet: number;
    voiceUses: number;
    widgetsPinned: number;
    advisorRequests: number;
    groundingCorrections: number;
    unansweredThemes: { topic: string; count: number }[];
  };
  ai: {
    requestsToday: number;
    today: { requests: number; inputTokens: number; outputTokens: number };
    last30: { requests: number; inputTokens: number; outputTokens: number };
    byModel: { model: string; requests: number; inputTokens: number; outputTokens: number }[];
    daily: { day: string; requests: number }[];
  };
  workload: {
    open: number;
    needsReply: number;
    closed: number;
    byTopic: { topic: "general" | "investment"; count: number }[];
    free: number;
    paid: number;
    averageFirstReplyMinutes: number | null;
  };
  /** Adviser fees paid. Simulated in this prototype: no money moves. */
  payments: { count: number; cents: number; simulated: boolean };
  settings: AppSettings;
  audit: { id: string; at: string; action: string; detail: string; actor: string }[];
}

interface AdminValue {
  data: AdminData | null;
  /** Fetches the figures again, for example after a setting was changed. */
  reload: () => void;
  /** Applies a change locally straight away, before the reload arrives. */
  patch: (change: Partial<AdminData>) => void;
}

const AdminContext = createContext<AdminValue>({
  data: null,
  reload: () => undefined,
  patch: () => undefined,
});

export function useAdminData(): AdminValue {
  return useContext(AdminContext);
}

export const isManager = (role: AdminRole): boolean => role === "owner" || role === "admin";

/** `manager` sections are for the owner and administrators; the rest are open to every member of staff. */
export const ADMIN_SECTIONS: { href: string; label: MessageKey; manager?: boolean }[] = [
  { href: "/admin", label: "admin.nav.overview" },
  { href: "/admin/usage", label: "admin.nav.usage" },
  { href: "/admin/training", label: "admin.nav.training" },
  { href: "/admin/advisers", label: "admin.nav.advisers" },
  { href: "/admin/plans", label: "admin.nav.plans" },
  { href: "/admin/ai", label: "admin.nav.ai", manager: true },
  { href: "/admin/announcements", label: "admin.nav.announcements", manager: true },
  { href: "/admin/notifications", label: "admin.nav.notifications", manager: true },
  { href: "/admin/team", label: "admin.nav.team", manager: true },
  { href: "/admin/controls", label: "admin.nav.controls", manager: true },
  { href: "/admin/system", label: "admin.nav.system", manager: true },
  { href: "/admin/trash", label: "admin.nav.trash" },
];

/** Switches between light and dark. Shows the mode it will switch to. */
export function ThemeToggle(): React.JSX.Element {
  const { t, theme, setTheme } = usePreferences();
  const [systemDark, setSystemDark] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = (): void => setSystemDark(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  const dark = theme === "dark" || (theme === "system" && systemDark);
  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={`${t("settings.theme")}: ${t(dark ? "settings.theme.light" : "settings.theme.dark")}`}
      title={t(dark ? "settings.theme.light" : "settings.theme.dark")}
      className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-surface outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <svg
        viewBox="0 0 24 24"
        className="size-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {dark ? (
          <>
            <circle cx={12} cy={12} r={4} />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </>
        ) : (
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        )}
      </svg>
    </button>
  );
}

/**
 * The frame around every admin page: a navigation bar with the sections the
 * signed-in person may use, the language selector, the light and dark switch
 * and sign-out, and one shared copy of the figures so that moving between
 * sections does not refetch them.
 */
export function AdminShell({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { t, locale } = usePreferences();
  const pathname = usePathname();
  const router = useRouter();
  const [data, setData] = useState<AdminData | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  const [tick, setTick] = useState(0);
  const [days, setDays] = useState(30);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const isLogin = pathname.startsWith("/admin/login");

  useEffect(() => {
    if (isLogin) return;
    let cancelled = false;
    fetch(`/api/admin/overview?days=${days}`, { credentials: "same-origin" })
      .then(async (response) => {
        if (response.status === 401) {
          router.replace("/admin/login");
          return;
        }
        if (!response.ok) throw new Error("overview failed");
        const payload = (await response.json()) as AdminData;
        if (cancelled) return;
        setData(payload);
        setFailed(false);
        setLoadedAt(new Date());
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isLogin, router, tick, days]);

  useEffect(() => {
    if (isLogin) return;
    // Any admin call that meets a lost session fires this: go and sign in again.
    const toSignIn = (): void => router.replace("/admin/login");
    window.addEventListener(SIGNED_OUT_EVENT, toSignIn);
    return () => window.removeEventListener(SIGNED_OUT_EVENT, toSignIn);
  }, [isLogin, router]);

  const reload = useCallback(() => {
    setLoading(true);
    setTick((value) => value + 1);
  }, []);
  const patch = useCallback((change: Partial<AdminData>) => {
    setData((current) => (current ? { ...current, ...change } : current));
  }, []);
  const value = useMemo(() => ({ data, reload, patch }), [data, reload, patch]);

  const { run: signOutRun, pending: signingOut } = useAsyncAction(
    async (): Promise<void> => {
      const response = await fetch("/api/admin/logout", {
        method: "POST",
        credentials: "same-origin",
      });
      // A 401 means the session is already gone, which is what signing out wanted.
      if (!response.ok && response.status !== 401) throw new Error("logout failed");
      router.replace("/admin/login");
    },
    { errorKey: "common.saveFailed" },
  );
  const signOut = (): void => {
    void signOutRun();
  };

  if (isLogin) return <>{children}</>;

  const current = (href: string): boolean =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
  const manager = data ? isManager(data.me.role) : false;
  const sections = ADMIN_SECTIONS.filter((section) => !section.manager || manager);
  const here = ADMIN_SECTIONS.find((section) => current(section.href));
  const blocked = Boolean(data && here?.manager && !manager);

  return (
    <AdminContext.Provider value={value}>
      <div className="flex min-h-dvh flex-col bg-background lg:flex-row">
        <header className="sticky top-0 z-20 border-b border-border bg-surface lg:h-dvh lg:w-64 lg:shrink-0 lg:overflow-y-auto lg:border-r lg:border-b-0">
          <div className="flex items-center justify-between gap-3 px-4 py-3 lg:flex-col lg:items-stretch lg:gap-4 lg:py-5">
            <Link href="/admin" className="flex min-w-0 items-center gap-3">
              <Logo className="size-9 shrink-0" />
              <span className="truncate text-lg font-semibold tracking-tight">
                {t("admin.title")}
              </span>
            </Link>
            <div className="flex items-center gap-2">
              <LanguagePicker compact />
              <ThemeToggle />
            </div>
          </div>
          <nav aria-label={t("admin.menu")} className="border-t border-border lg:border-t-0">
            <ul className="flex gap-1 overflow-x-auto px-3 py-2 lg:flex-col lg:overflow-visible">
              {sections.map(({ href, label }) => (
                <li key={href} className="shrink-0">
                  <Link
                    href={href}
                    aria-current={current(href) ? "page" : undefined}
                    className={`block rounded-full px-4 py-2 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-accent lg:rounded-xl ${
                      current(href)
                        ? "bg-accent-soft text-accent"
                        : "text-muted hover:bg-background"
                    }`}
                  >
                    {t(label)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="hidden flex-col gap-3 border-t border-border px-4 py-4 lg:flex">
            {data ? <SignedInAs me={data.me} /> : null}
            {data && data.me.role !== "owner" ? <TwoStep endpoint="/api/admin/me/totp" /> : null}
            {data && data.me.role !== "owner" ? (
              <button
                type="button"
                onClick={() => setPasswordOpen(true)}
                className="text-left text-sm font-semibold text-accent"
              >
                {t("admin.password.change")}
              </button>
            ) : null}
            <button
              type="button"
              onClick={signOut}
              aria-disabled={signingOut}
              className="min-h-11 rounded-full border border-border px-4 py-2 text-sm font-semibold aria-disabled:opacity-60"
            >
              {signingOut ? (
                <PendingLabel>{t("common.signingOut")}</PendingLabel>
              ) : (
                t("admin.signOut")
              )}
            </button>
          </div>
        </header>
        <main className="mx-auto flex w-full max-w-6xl min-w-0 flex-1 flex-col gap-5 px-4 py-5 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted" role="status">
              {loadedAt
                ? t("admin.updated", {
                    time: new Intl.DateTimeFormat(LOCALE_INFO[locale].intl, {
                      timeStyle: "short",
                    }).format(loadedAt),
                  })
                : " "}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-sm">
                <span className="text-muted">{t("admin.period")}</span>
                <select
                  value={days}
                  onChange={(event) => {
                    setLoading(true);
                    setDays(Number(event.target.value));
                  }}
                  className="rounded-full border border-border bg-surface px-3 py-2 text-sm font-medium"
                >
                  {[7, 30, 90].map((value) => (
                    <option key={value} value={value}>
                      {t("admin.period.days", { days: value })}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={reload}
                disabled={loading}
                className="rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold disabled:opacity-60"
              >
                {t(loading ? "admin.refreshing" : "admin.refresh")}
              </button>
              <button
                type="button"
                onClick={signOut}
                aria-disabled={signingOut}
                className="min-h-11 rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold aria-disabled:opacity-60 lg:hidden"
              >
                {signingOut ? (
                  <PendingLabel>{t("common.signingOut")}</PendingLabel>
                ) : (
                  t("admin.signOut")
                )}
              </button>
            </div>
          </div>
          {data ? (
            <div className="lg:hidden">
              <SignedInAs me={data.me} />
            </div>
          ) : null}
          <p className="rounded-2xl border border-border bg-accent-soft px-4 py-3 text-sm">
            {t("admin.anonymous")}
          </p>
          {failed ? (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-warning bg-warning-soft px-4 py-3 text-sm"
            >
              <span>{t(data ? "admin.loadFailed.stale" : "admin.loadFailed")}</span>
              <button type="button" onClick={reload} className="font-semibold underline">
                {t("admin.retry")}
              </button>
            </div>
          ) : null}
          {blocked ? (
            <div className="rounded-2xl border border-border bg-surface p-6 text-sm">
              <h1 className="text-lg font-semibold">{t("admin.forbidden.title")}</h1>
              <p className="mt-1 text-muted">{t("admin.forbidden.body")}</p>
              <Link href="/admin" className="mt-3 inline-block font-semibold text-accent">
                {t("admin.nav.overview")} →
              </Link>
            </div>
          ) : data ? (
            children
          ) : failed ? null : (
            <div className="flex flex-1 items-center justify-center py-20" role="status">
              <span className="sr-only">{t("common.loading")}</span>
              <Logo className="size-14 animate-pulse motion-reduce:animate-none" />
            </div>
          )}
        </main>
      </div>
      <ChangePassword open={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </AdminContext.Provider>
  );
}

function SignedInAs({ me }: { me: AdminData["me"] }): React.JSX.Element {
  const { t } = usePreferences();
  const role = t(`admin.role.${me.role}` as MessageKey);
  return (
    <p className="text-xs text-muted">
      {t("admin.signedInAs")}{" "}
      <span className="font-semibold text-foreground">
        {me.name ? `${me.name} · ${role}` : role}
      </span>
    </p>
  );
}
