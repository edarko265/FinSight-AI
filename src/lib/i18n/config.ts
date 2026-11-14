export const LOCALES = ["en", "fi", "sv"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "fs_locale";

export const LOCALE_INFO: Record<
  Locale,
  { label: string; flag: string; intl: string; speech: string }
> = {
  en: { label: "English", flag: "🇬🇧", intl: "en-GB", speech: "en" },
  fi: { label: "Suomi", flag: "🇫🇮", intl: "fi-FI", speech: "fi" },
  sv: { label: "Svenska", flag: "🇸🇪", intl: "sv-SE", speech: "sv" },
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function formatMoney(cents: number, locale: Locale): string {
  return new Intl.NumberFormat(LOCALE_INFO[locale].intl, {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

export function formatMonth(
  month: string,
  locale: Locale,
  style: "short" | "long" = "short",
): string {
  const [year = 2026, m = 1] = month.split("-").map(Number);
  return new Intl.DateTimeFormat(LOCALE_INFO[locale].intl, {
    month: style,
    year: style === "long" ? "numeric" : undefined,
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, m - 1, 1)));
}

export function formatDay(date: string, locale: Locale): string {
  return new Intl.DateTimeFormat(LOCALE_INFO[locale].intl, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

/** Formats a local date-time such as "2026-09-16T10:00" for display. */
export function formatSlot(slot: string, locale: Locale): string {
  return new Intl.DateTimeFormat(LOCALE_INFO[locale].intl, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(`${slot}:00Z`));
}
