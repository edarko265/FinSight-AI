"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useOverview } from "@/components/providers/OverviewProvider";
import {
  FONT_SIZES,
  usePreferences,
  type FontSize,
  type Theme,
} from "@/components/providers/PreferencesProvider";
import { LanguagePicker } from "@/components/settings/LanguagePicker";
import { api } from "@/lib/api-client";
import type { MessageKey } from "@/lib/i18n/translate";

const THEMES: Theme[] = ["system", "light", "dark"];
const SIZES = Object.keys(FONT_SIZES) as FontSize[];

function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  labelFor,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
  labelFor: (option: T) => string;
}): React.JSX.Element {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex gap-1 rounded-full border border-border bg-surface p-1"
    >
      {options.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={value === option}
          onClick={() => onChange(option)}
          className={`flex-1 rounded-full px-2 py-2 text-sm font-medium ${
            value === option ? "bg-brand text-on-brand" : "text-muted"
          }`}
        >
          {labelFor(option)}
        </button>
      ))}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function SettingsView(): React.JSX.Element {
  const prefs = usePreferences();
  const { t } = prefs;
  const { me, refresh } = useOverview();
  const [confirmErase, setConfirmErase] = useState(false);
  const router = useRouter();

  async function signOut(): Promise<void> {
    await api("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/login");
  }

  async function setConsent(accepted: boolean): Promise<void> {
    await api("/api/consent", { method: "POST", json: { accepted } }).catch(() => undefined);
    refresh();
  }

  async function erase(): Promise<void> {
    await api("/api/privacy/erase", { method: "POST" }).catch(() => undefined);
    router.replace("/login");
  }

  return (
    <div className="flex flex-col gap-6 px-4 py-4">
      <h1 className="text-xl font-semibold">{t("settings.title")}</h1>

      <Section title={t("settings.language")}>
        <LanguagePicker />
      </Section>

      <Section title={t("settings.theme")}>
        <Segmented
          label={t("settings.theme")}
          options={THEMES}
          value={prefs.theme}
          onChange={prefs.setTheme}
          labelFor={(theme) => t(`settings.theme.${theme}` as MessageKey)}
        />
      </Section>

      <Section title={t("settings.fontSize")}>
        <Segmented
          label={t("settings.fontSize")}
          options={SIZES}
          value={prefs.fontSize}
          onChange={prefs.setFontSize}
          labelFor={(size) => t(`settings.fontSize.${size}` as MessageKey)}
        />
      </Section>

      {me?.voiceEnabled ? (
        <Section title={t("settings.voice")}>
          <label className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-3 text-sm">
            <span className="text-muted">{t("settings.voiceHint")}</span>
            <input
              type="checkbox"
              checked={prefs.voiceReplies}
              onChange={(event) => prefs.setVoiceReplies(event.target.checked)}
              className="size-5 accent-(--accent)"
            />
          </label>
        </Section>
      ) : null}

      {me?.aiEnabled ? (
        <Section title={t("settings.ai")}>
          <label className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-3 text-sm">
            <span className="text-muted">
              {t(me.aiConsent ? "settings.aiOn" : "settings.aiOff")}
            </span>
            <input
              type="checkbox"
              checked={me.aiConsent}
              onChange={(event) => void setConsent(event.target.checked)}
              className="size-5 shrink-0 accent-(--accent)"
            />
          </label>
        </Section>
      ) : null}

      <Section title={t("settings.privacy")}>
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface px-4 py-3 text-sm">
          <p className="text-muted">{t("settings.privacyBody")}</p>
          <Link href="/privacy" className="font-semibold text-accent">
            {t("settings.privacyLink")}
          </Link>
          <a href="/api/privacy/export" download className="font-semibold text-accent">
            {t("settings.download")}
          </a>
          {confirmErase ? (
            <div className="flex flex-col gap-2 rounded-xl bg-warning-soft p-3">
              <p className="text-warning">{t("settings.eraseConfirm")}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void erase()}
                  className="rounded-full bg-brand px-4 py-2 font-semibold text-on-brand"
                >
                  {t("settings.eraseYes")}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmErase(false)}
                  className="rounded-full border border-border px-4 py-2 font-semibold"
                >
                  {t("dashboard.cancel")}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmErase(true)}
              className="self-start font-semibold text-warning"
            >
              {t("settings.erase")}
            </button>
          )}
        </div>
      </Section>

      <Section title={t("settings.account")}>
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
          <span className="text-sm text-muted">
            {me ? t("settings.signedInAs", { id: me.customerId }) : "…"}
          </span>
          <button
            type="button"
            onClick={() => void signOut()}
            className="text-sm font-semibold text-accent"
          >
            {t("settings.signOut")}
          </button>
        </div>
      </Section>
    </div>
  );
}
