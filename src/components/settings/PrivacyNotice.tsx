"use client";

import { useRouter } from "next/navigation";

import { usePreferences } from "@/components/providers/PreferencesProvider";
import { LanguagePicker } from "@/components/settings/LanguagePicker";
import type { MessageKey } from "@/lib/i18n/translate";

const SECTIONS = ["what", "why", "ai", "security", "rights", "retention"] as const;

export function PrivacyNotice(): React.JSX.Element {
  const { t } = usePreferences();
  const router = useRouter();
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 py-6">
      <LanguagePicker compact />
      <h1 className="text-2xl font-semibold tracking-tight">{t("privacy.title")}</h1>
      <p className="rounded-2xl border border-border bg-accent-soft px-4 py-3 text-sm">
        {t("privacy.demo")}
      </p>
      {SECTIONS.map((section) => (
        <section key={section} className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold">{t(`privacy.${section}.title` as MessageKey)}</h2>
          <p className="text-sm text-muted">{t(`privacy.${section}.body` as MessageKey)}</p>
        </section>
      ))}
      <button
        type="button"
        onClick={() => router.back()}
        className="self-start rounded-full border border-border px-5 py-2.5 text-sm font-semibold"
      >
        {t("privacy.back")}
      </button>
    </main>
  );
}
