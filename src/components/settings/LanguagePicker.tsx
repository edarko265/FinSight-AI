"use client";

import { usePreferences } from "@/components/providers/PreferencesProvider";
import { LOCALE_INFO, LOCALES } from "@/lib/i18n/config";

/** Language buttons with flags. Used on the sign-in page and in settings. */
export function LanguagePicker({ compact = false }: { compact?: boolean }): React.JSX.Element {
  const { locale, setLocale, t } = usePreferences();
  return (
    <div role="radiogroup" aria-label={t("settings.language")} className="flex gap-2">
      {LOCALES.map((code) => (
        <button
          key={code}
          type="button"
          role="radio"
          aria-checked={locale === code}
          onClick={() => setLocale(code)}
          className={`flex flex-1 items-center justify-center gap-2 rounded-full border px-3 py-2 text-sm font-medium ${
            locale === code
              ? "border-accent bg-accent-soft text-accent"
              : "border-border bg-surface"
          }`}
        >
          <span aria-hidden="true" className="text-lg leading-none">
            {LOCALE_INFO[code].flag}
          </span>
          {compact ? code.toUpperCase() : LOCALE_INFO[code].label}
        </button>
      ))}
    </div>
  );
}
