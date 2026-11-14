"use client";

import { usePreferences } from "@/components/providers/PreferencesProvider";
import { isLocale, LOCALE_INFO, LOCALES } from "@/lib/i18n/config";

/**
 * The language selector, with flags. One control used everywhere: sign-in,
 * settings, the legal pages and the admin area. `compact` is the small version
 * for a page corner; the default fills its container.
 */
export function LanguagePicker({ compact = false }: { compact?: boolean }): React.JSX.Element {
  const { locale, setLocale, t } = usePreferences();
  return (
    <label className={`relative block ${compact ? "w-fit self-end" : "w-full"}`}>
      <span className="sr-only">{t("settings.language")}</span>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-lg"
      >
        {LOCALE_INFO[locale].flag}
      </span>
      <select
        value={locale}
        onChange={(event) => {
          if (isLocale(event.target.value)) setLocale(event.target.value);
        }}
        className={`w-full appearance-none rounded-full border border-border bg-surface py-2.5 pr-10 pl-11 font-medium outline-none focus-visible:ring-2 focus-visible:ring-accent ${
          compact ? "text-sm" : "text-base"
        }`}
      >
        {LOCALES.map((code) => (
          <option key={code} value={code}>
            {LOCALE_INFO[code].label}
          </option>
        ))}
      </select>
      <svg
        viewBox="0 0 24 24"
        className="pointer-events-none absolute inset-y-0 right-3.5 my-auto size-4 text-muted"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </label>
  );
}
