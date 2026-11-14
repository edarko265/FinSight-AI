"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from "@/lib/i18n/config";
import { translate, type MessageKey, type MessageParams } from "@/lib/i18n/translate";

export type Theme = "system" | "light" | "dark";
export type FontSize = "small" | "medium" | "large" | "xlarge";

export const FONT_SIZES: Record<FontSize, string> = {
  small: "14px",
  medium: "16px",
  large: "18px",
  xlarge: "20px",
};

interface Preferences {
  locale: Locale;
  theme: Theme;
  fontSize: FontSize;
  voiceReplies: boolean;
}

interface PreferencesValue extends Preferences {
  setLocale: (locale: Locale) => void;
  setTheme: (theme: Theme) => void;
  setFontSize: (size: FontSize) => void;
  setVoiceReplies: (on: boolean) => void;
  t: (key: MessageKey, params?: MessageParams) => string;
}

export const PREFS_STORAGE_KEY = "fs_prefs";
const DEFAULTS: Preferences = {
  locale: DEFAULT_LOCALE,
  theme: "system",
  fontSize: "medium",
  voiceReplies: false,
};

const PreferencesContext = createContext<PreferencesValue | null>(null);

function readStored(): Preferences {
  try {
    const stored = JSON.parse(
      window.localStorage.getItem(PREFS_STORAGE_KEY) ?? "{}",
    ) as Partial<Preferences>;
    return {
      locale: isLocale(stored.locale) ? stored.locale : DEFAULTS.locale,
      theme: stored.theme === "light" || stored.theme === "dark" ? stored.theme : "system",
      fontSize: stored.fontSize && stored.fontSize in FONT_SIZES ? stored.fontSize : "medium",
      voiceReplies: stored.voiceReplies === true,
    };
  } catch {
    return DEFAULTS;
  }
}

function apply(prefs: Preferences): void {
  const root = document.documentElement;
  root.lang = prefs.locale;
  root.style.fontSize = FONT_SIZES[prefs.fontSize];
  if (prefs.theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", prefs.theme);
  try {
    window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Storage can be unavailable (private mode); preferences then last for the visit only.
  }
  document.cookie = `${LOCALE_COOKIE}=${prefs.locale}; path=/; max-age=31536000; samesite=lax`;
}

export function PreferencesProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULTS);

  // Stored preferences are only known in the browser, so they are adopted after the first render.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from browser storage
    setPrefs(readStored());
  }, []);

  const update = useCallback((patch: Partial<Preferences>) => {
    setPrefs((current) => {
      const next = { ...current, ...patch };
      apply(next);
      return next;
    });
  }, []);

  const value = useMemo<PreferencesValue>(
    () => ({
      ...prefs,
      setLocale: (locale) => update({ locale }),
      setTheme: (theme) => update({ theme }),
      setFontSize: (fontSize) => update({ fontSize }),
      setVoiceReplies: (voiceReplies) => update({ voiceReplies }),
      t: (key, params) => translate(prefs.locale, key, params),
    }),
    [prefs, update],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesValue {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error("usePreferences must be used inside PreferencesProvider");
  return value;
}

/** Runs before first paint so the saved theme and text size apply without a flash. */
export const PREFERENCES_BOOT_SCRIPT =
  // A fixed piece of text with nothing spliced into it. The storage key and the text sizes
  // are written out here and must match PREFS_STORAGE_KEY and FONT_SIZES above.
  '(function(){try{var p=JSON.parse(localStorage.getItem("fs_prefs")||"{}");var r=document.documentElement;var s={"small":"14px","medium":"16px","large":"18px","xlarge":"20px"};if(p.theme==="light"||p.theme==="dark")r.setAttribute("data-theme",p.theme);if(s[p.fontSize])r.style.fontSize=s[p.fontSize];if(p.locale)r.lang=p.locale;}catch(e){}})();';
