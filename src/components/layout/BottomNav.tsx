"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useOverview } from "@/components/providers/OverviewProvider";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import { BellIcon, ChatIcon, DashboardIcon, SettingsIcon, TargetIcon } from "@/components/ui/icons";

const ITEMS = [
  { href: "/dashboard", label: "nav.dashboard", Icon: DashboardIcon },
  { href: "/chat", label: "nav.chat", Icon: ChatIcon },
  { href: "/goals", label: "nav.goals", Icon: TargetIcon },
  { href: "/insights", label: "nav.insights", Icon: BellIcon },
  { href: "/settings", label: "nav.settings", Icon: SettingsIcon },
] as const;

export function BottomNav(): React.JSX.Element {
  const pathname = usePathname();
  const { t } = usePreferences();
  const { overview } = useOverview();
  const unread = overview?.unreadInsights ?? 0;

  return (
    <nav
      aria-label="Main"
      className="shrink-0 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="grid grid-cols-5">
        {ITEMS.map(({ href, label, Icon }) => {
          const active = pathname.startsWith(href);
          const badge = href === "/insights" && unread > 0;
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${
                  active ? "text-accent" : "text-muted"
                }`}
              >
                <span className="relative">
                  <Icon className="size-6" filled={active} />
                  {badge ? (
                    <span className="absolute -top-1 -right-2 flex min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-surface">
                      {unread}
                    </span>
                  ) : null}
                </span>
                {t(label)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
