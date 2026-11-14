"use client";

import { useRouter } from "next/navigation";

import { usePreferences } from "@/components/providers/PreferencesProvider";
import { LanguagePicker } from "@/components/settings/LanguagePicker";
import type { MessageKey } from "@/lib/i18n/translate";

const SECTIONS = ["service", "advice", "ai", "use", "rewards", "changes"] as const;

export function TermsNotice(): React.JSX.Element {
  const { t } = usePreferences();
  const router = useRouter();
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 py-6">
      <LanguagePicker compact />
      <h1 className="text-2xl font-semibold tracking-tight">{t("terms.title")}</h1>
      <p className="rounded-2xl border border-border bg-accent-soft px-4 py-3 text-sm">
        {t("terms.intro")}
      </p>
      {SECTIONS.map((section) => (
        <section key={section} className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold">{t(`terms.${section}.title` as MessageKey)}</h2>
          <p className="text-sm text-muted">{t(`terms.${section}.body` as MessageKey)}</p>
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
