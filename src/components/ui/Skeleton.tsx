"use client";

import { usePreferences } from "@/components/providers/PreferencesProvider";
import type { MessageKey } from "@/lib/i18n/translate";

/** Placeholder block. Size it with `className`, for example `h-6 w-1/2`. */
export function Skeleton({ className = "" }: { className?: string }): React.JSX.Element {
  return <div aria-hidden="true" className={`fs-shimmer rounded-lg ${className}`} />;
}

/** `lines` text lines, the last one shorter. */
export function SkeletonText({
  lines = 3,
  className = "",
}: {
  lines?: number;
  className?: string;
}): React.JSX.Element {
  return (
    <div aria-hidden="true" className={`flex flex-col gap-2 ${className}`}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton
          key={index}
          className={`h-4 ${index === lines - 1 && lines > 1 ? "w-2/3" : "w-full"}`}
        />
      ))}
    </div>
  );
}

/** Card-shaped placeholder matching the app's rounded cards. */
export function SkeletonCard({ className = "" }: { className?: string }): React.JSX.Element {
  return (
    <div
      aria-hidden="true"
      className={`flex min-h-32 flex-col gap-3 rounded-2xl border border-border bg-surface p-5 ${className}`}
    >
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-8 w-1/2" />
      <SkeletonText lines={2} />
    </div>
  );
}

/** `rows` list rows with a leading dot and two text lines. */
export function SkeletonList({
  rows = 4,
  className = "",
}: {
  rows?: number;
  className?: string;
}): React.JSX.Element {
  return (
    <div aria-hidden="true" className={`flex flex-col gap-3 ${className}`}>
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className="flex min-h-16 items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3"
        >
          <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Wraps skeletons so screen readers hear a single "Loading…" announcement. */
export function LoadingRegion({
  children,
  labelKey = "common.loading",
  className = "",
}: {
  children: React.ReactNode;
  labelKey?: MessageKey;
  className?: string;
}): React.JSX.Element {
  const { t } = usePreferences();
  return (
    <div role="status" aria-busy="true" className={className}>
      <span className="sr-only">{t(labelKey)}</span>
      {children}
    </div>
  );
}
