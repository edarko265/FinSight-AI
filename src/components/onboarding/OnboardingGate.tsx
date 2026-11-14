"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { usePreferences } from "@/components/providers/PreferencesProvider";
import { PendingLabel } from "@/components/ui/Spinner";
import { useAsyncAction } from "@/components/ui/useAsyncAction";
import { Wizard, WizardChoices } from "@/components/ui/Wizard";
import { api } from "@/lib/api-client";
import type { MessageKey } from "@/lib/i18n/translate";

const TERMS: MessageKey[] = [
  "terms.service.body",
  "terms.advice.body",
  "terms.ai.body",
  "terms.rewards.body",
];
const PRIVACY: MessageKey[] = [
  "onboarding.privacy.point.what",
  "onboarding.privacy.point.secure",
  "onboarding.privacy.point.rights",
];

function Points({ keys }: { keys: MessageKey[] }): React.JSX.Element {
  const { t } = usePreferences();
  return (
    <ul className="flex flex-col gap-2.5">
      {keys.map((key) => (
        <li key={key} className="flex gap-2.5 text-sm">
          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
          <span>{t(key)}</span>
        </li>
      ))}
    </ul>
  );
}

function Agree({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}): React.JSX.Element {
  return (
    <label
      className={`mt-4 flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium ${
        checked ? "border-accent bg-accent-soft" : "border-border bg-surface"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-5 shrink-0 accent-(--accent)"
      />
      {label}
    </label>
  );
}

/**
 * Shown the first time a customer signs in, and again whenever the terms
 * change. Nothing of theirs is loaded until the terms of use and the privacy
 * notice are accepted; the AI coach is a separate, optional choice.
 */
export function OnboardingGate({
  aiAvailable,
  onDone,
}: {
  aiAvailable: boolean;
  onDone: () => void;
}): React.JSX.Element {
  const { t } = usePreferences();
  const router = useRouter();
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [ai, setAi] = useState<"yes" | "no">("yes");

  const [leaving, setLeaving] = useState(false);
  const consent = useAsyncAction(() =>
    api("/api/consent", {
      method: "POST",
      json: { terms: true, accepted: aiAvailable && ai === "yes" },
    }),
  );
  const logout = useAsyncAction(() => api("/api/auth/logout", { method: "POST" }));

  // Returning false keeps the wizard open so the choices are not lost after a failure.
  async function finish(): Promise<boolean> {
    const result = await consent.run();
    if (!result.ok) return false;
    onDone();
    return true;
  }

  async function signOut(): Promise<void> {
    const result = await logout.run();
    if (!result.ok) return;
    setLeaving(true);
    router.replace("/login");
  }

  const link = "mt-3 inline-block text-sm font-medium text-accent";
  const steps = [
    {
      title: t("onboarding.terms.title"),
      hint: t("onboarding.terms.hint"),
      valid: terms,
      content: (
        <>
          <Points keys={TERMS} />
          <Link href="/terms" target="_blank" className={link}>
            {t("onboarding.terms.read")}
          </Link>
          <Agree checked={terms} onChange={setTerms} label={t("onboarding.terms.accept")} />
          <button
            type="button"
            aria-disabled={logout.pending || leaving}
            onClick={() => void signOut()}
            className="mt-3 block min-h-11 text-sm text-muted underline"
          >
            {logout.pending || leaving ? (
              <PendingLabel>{t("common.signingOut")}</PendingLabel>
            ) : (
              t("onboarding.signOut")
            )}
          </button>
        </>
      ),
    },
    {
      title: t("onboarding.privacy.title"),
      hint: t("onboarding.privacy.hint"),
      valid: privacy,
      content: (
        <>
          <Points keys={PRIVACY} />
          <Link href="/privacy" target="_blank" className={link}>
            {t("consent.readMore")}
          </Link>
          <Agree checked={privacy} onChange={setPrivacy} label={t("onboarding.privacy.accept")} />
        </>
      ),
    },
  ];
  if (aiAvailable) {
    steps.push({
      title: t("onboarding.ai.title"),
      hint: t("onboarding.ai.hint"),
      valid: true,
      content: (
        <WizardChoices
          name="onboarding-ai"
          value={ai}
          onChange={setAi}
          options={[
            {
              value: "yes" as const,
              label: t("onboarding.ai.yes"),
              note: t("onboarding.ai.yesNote"),
            },
            { value: "no" as const, label: t("onboarding.ai.no"), note: t("onboarding.ai.noNote") },
          ]}
        />
      ),
    });
  }

  return (
    <Wizard
      open
      dismissable={false}
      title={t("onboarding.title")}
      finishLabel={t("onboarding.finish")}
      onClose={() => undefined}
      onFinish={finish}
      steps={steps}
    />
  );
}
