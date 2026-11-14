"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { NotifyPrefs } from "@/components/settings/NotifyPrefs";
import { TwoStep } from "@/components/settings/TwoStep";
import { useNotifications } from "@/components/notifications/useNotifications";
import { useOverview } from "@/components/providers/OverviewProvider";
import {
  FONT_SIZES,
  usePreferences,
  type FontSize,
  type Theme,
} from "@/components/providers/PreferencesProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { LanguagePicker } from "@/components/settings/LanguagePicker";
import { PendingLabel } from "@/components/ui/Spinner";
import { useAsyncAction } from "@/components/ui/useAsyncAction";
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
  const toast = useToast();
  const notifications = useNotifications();
  const { me, refresh } = useOverview();
  const [confirmErase, setConfirmErase] = useState(false);
  const router = useRouter();

  // `leaving` keeps the buttons busy through the redirect after a successful call.
  const [leaving, setLeaving] = useState(false);

  const signOutAction = useAsyncAction(() => api("/api/auth/logout", { method: "POST" }));
  const notificationsAction = useAsyncAction(async (on: boolean) =>
    on ? await notifications.enable() : (await notifications.disable(), false),
  );
  const consentAction = useAsyncAction((accepted: boolean) =>
    api("/api/consent", { method: "POST", json: { accepted } }),
  );
  const eraseAction = useAsyncAction(() => api("/api/privacy/erase", { method: "POST" }));

  async function signOut(): Promise<void> {
    const result = await signOutAction.run();
    if (!result.ok) return;
    setLeaving(true);
    router.replace("/login");
  }

  async function toggleNotifications(on: boolean): Promise<void> {
    const result = await notificationsAction.run(on);
    if (!result.ok) return;
    toast.notify(on && result.value ? "notify.on" : "notify.off");
  }

  async function setConsent(accepted: boolean): Promise<void> {
    const result = await consentAction.run(accepted);
    if (!result.ok) return;
    toast.notify(accepted ? "toast.consentOn" : "toast.consentOff");
    refresh();
  }

  // A failed erase must not look like a successful one: stay here and show the error.
  async function erase(): Promise<void> {
    const result = await eraseAction.run();
    if (!result.ok) return;
    setLeaving(true);
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

      <Section title={t("notify.title")}>
        <label className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-3 text-sm">
          <span className="text-muted">
            {notifications.state === "unsupported"
              ? t("notify.unsupported")
              : notifications.state === "blocked"
                ? t("notify.blocked")
                : t("notify.settingHint")}
          </span>
          <input
            type="checkbox"
            checked={notifications.state === "on"}
            disabled={notifications.state === "unsupported" || notifications.state === "blocked"}
            aria-disabled={notificationsAction.pending}
            onChange={(event) => void toggleNotifications(event.target.checked)}
            className="size-5 shrink-0 accent-(--accent)"
          />
        </label>
        <NotifyPrefs />
      </Section>

      {me?.aiEnabled ? (
        <Section title={t("settings.ai")}>
          <label className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-3 text-sm">
            <span className="text-muted">
              {t(me.aiConsent ? "settings.aiOn" : "settings.aiOff")}
            </span>
            <input
              type="checkbox"
              checked={me.aiConsent}
              aria-disabled={consentAction.pending}
              onChange={(event) => void setConsent(event.target.checked)}
              className="size-5 shrink-0 accent-(--accent)"
            />
          </label>
        </Section>
      ) : null}

      <Section title={t("twoStep.section")}>
        <TwoStep endpoint="/api/security/totp" />
      </Section>

      <Section title={t("settings.money")}>
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface px-4 py-3 text-sm">
          <Link href="/accounts" className="font-semibold text-accent">
            {t("accounts.title")}
          </Link>
          <Link href="/corrections" className="font-semibold text-accent">
            {t("corrections.title")}
          </Link>
          <Link href="/plans" className="font-semibold text-accent">
            {t("plans.title")}
          </Link>
          <Link href="/mortgage" className="font-semibold text-accent">
            {t("mortgage.title")}
          </Link>
        </div>
      </Section>

      <Section title={t("settings.privacy")}>
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface px-4 py-3 text-sm">
          <p className="text-muted">{t("settings.privacyBody")}</p>
          <Link href="/privacy" className="font-semibold text-accent">
            {t("settings.privacyLink")}
          </Link>
          <Link href="/terms" className="font-semibold text-accent">
            {t("settings.termsLink")}
          </Link>
          <Link href="/trash" className="font-semibold text-accent">
            {t("trash.open")}
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
                  aria-disabled={eraseAction.pending || leaving}
                  onClick={() => void erase()}
                  className="min-h-11 rounded-full bg-brand px-4 py-2 font-semibold text-on-brand"
                >
                  {eraseAction.pending || leaving ? (
                    <PendingLabel>{t("common.erasing")}</PendingLabel>
                  ) : (
                    t("settings.eraseYes")
                  )}
                </button>
                <button
                  type="button"
                  aria-disabled={eraseAction.pending || leaving}
                  onClick={() => {
                    if (!eraseAction.pending && !leaving) setConfirmErase(false);
                  }}
                  className="min-h-11 rounded-full border border-border px-4 py-2 font-semibold"
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
            aria-disabled={signOutAction.pending || leaving}
            onClick={() => void signOut()}
            className="min-h-11 text-sm font-semibold text-accent"
          >
            {signOutAction.pending || leaving ? (
              <PendingLabel>{t("common.signingOut")}</PendingLabel>
            ) : (
              t("settings.signOut")
            )}
          </button>
        </div>
      </Section>
    </div>
  );
}
