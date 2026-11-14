"use client";

import { usePreferences } from "@/components/providers/PreferencesProvider";
import type { MessageKey } from "@/lib/i18n/translate";

/** Standard inline load failure with a retry button. */
export function LoadError({
  onRetry,
  messageKey = "common.loadFailed",
  className = "",
}: {
  onRetry: () => void;
  messageKey?: MessageKey;
  className?: string;
}): React.JSX.Element {
  const { t } = usePreferences();
  return (
    <div
      role="alert"
      className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-warning bg-warning-soft px-4 py-3 text-sm ${className}`}
    >
      <span>{t(messageKey)}</span>
      <button
        type="button"
        className="min-h-11 rounded-lg px-3 font-semibold underline focus-visible:ring-2 focus-visible:ring-accent"
        onClick={onRetry}
      >
        {t("common.retry")}
      </button>
    </div>
  );
}
