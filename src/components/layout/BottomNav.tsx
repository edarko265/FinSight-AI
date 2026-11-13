"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: <path d="M4 13h6V4H4v9zm0 7h6v-5H4v5zm10 0h6V11h-6v9zm0-16v5h6V4h-6z" />,
  },
  {
    href: "/chat",
    label: "Chat",
    icon: <path d="M4 5h16v11H9l-5 4V5z" strokeLinejoin="round" />,
  },
] as const;

export function BottomNav(): React.JSX.Element {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="shrink-0 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="grid grid-cols-2">
        {ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-1 py-2.5 text-xs font-medium ${
                  active ? "text-accent" : "text-muted"
                }`}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="size-6"
                  fill={active ? "currentColor" : "none"}
                  stroke="currentColor"
                  strokeWidth={1.8}
                  aria-hidden="true"
                >
                  {item.icon}
                </svg>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
