"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useOverview } from "@/components/providers/OverviewProvider";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import {
  BellIcon,
  ChatIcon,
  DashboardIcon,
  Logo,
  SettingsIcon,
  TargetIcon,
} from "@/components/ui/icons";

const ITEMS = [
  { href: "/dashboard", label: "nav.dashboard", Icon: DashboardIcon },
  { href: "/chat", label: "nav.chat", Icon: ChatIcon },
  { href: "/goals", label: "nav.goals", Icon: TargetIcon },
  { href: "/insights", label: "nav.insights", Icon: BellIcon },
  { href: "/settings", label: "nav.settings", Icon: SettingsIcon },
] as const;

function Badge({
  count,
  className,
}: {
  count: number;
  className: string;
}): React.JSX.Element | null {
  if (count <= 0) return null;
  return (
    <span
      className={`flex min-w-4 items-center justify-center rounded-full bg-accent px-1 text-xs font-bold text-surface ${className}`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

/** Navigation along the bottom on phones. */
export function BottomNav(): React.JSX.Element {
  const pathname = usePathname();
  const { t } = usePreferences();
  const { overview } = useOverview();
  const unread = overview?.unreadInsights ?? 0;

  return (
    <nav
      aria-label="Main"
      className="shrink-0 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid grid-cols-5">
        {ITEMS.map(({ href, label, Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 px-0 py-2 text-xs font-medium tracking-tight ${
                  active ? "text-accent" : "text-muted"
                }`}
              >
                <span className="relative">
                  <Icon className="size-6" filled={active} />
                  {href === "/insights" ? (
                    <Badge count={unread} className="absolute -top-1 -right-2" />
                  ) : null}
                </span>
                <span className="max-w-full truncate">{t(label)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Navigation down the side on tablets and desktops. */
export function SideNav(): React.JSX.Element {
  const pathname = usePathname();
  const { t } = usePreferences();
  const { overview } = useOverview();
  const unread = overview?.unreadInsights ?? 0;

  return (
    <nav
      aria-label="Main"
      className="hidden w-20 shrink-0 flex-col items-center gap-2 border-r border-border bg-surface py-4 md:flex lg:w-60 lg:items-stretch lg:px-3"
    >
      <Link href="/dashboard" className="mb-4 flex items-center gap-3 lg:px-3">
        <Logo className="size-10" />
        <span className="hidden text-lg font-semibold tracking-tight lg:inline">
          {t("app.name")}
        </span>
      </Link>
      <ul className="flex flex-col gap-1">
        {ITEMS.map(({ href, label, Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-1 rounded-2xl px-3 py-2.5 text-xs font-medium lg:flex-row lg:gap-3 lg:text-sm ${
                  active ? "bg-accent-soft text-accent" : "text-muted hover:bg-background"
                }`}
              >
                <span className="relative">
                  <Icon className="size-6" filled={active} />
                  {href === "/insights" ? (
                    <Badge count={unread} className="absolute -top-1 -right-2 lg:hidden" />
                  ) : null}
                </span>
                <span className="max-w-full truncate">{t(label)}</span>
                {href === "/insights" ? (
                  <Badge count={unread} className="ml-auto hidden lg:flex" />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
