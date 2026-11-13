import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";
import { en, type MessageKey } from "@/lib/i18n/messages/en";
import { fi } from "@/lib/i18n/messages/fi";
import { sv } from "@/lib/i18n/messages/sv";

const MESSAGES: Record<Locale, Record<MessageKey, string>> = { en, fi, sv };

export type { MessageKey };
export type MessageParams = Record<string, string | number>;

export function translate(locale: Locale, key: MessageKey, params?: MessageParams): string {
  const template = MESSAGES[locale][key] ?? MESSAGES[DEFAULT_LOCALE][key] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

export function hasMessage(key: string): key is MessageKey {
  return key in en;
}
