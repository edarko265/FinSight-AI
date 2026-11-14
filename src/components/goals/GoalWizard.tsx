"use client";

import { useState } from "react";

import { usePreferences } from "@/components/providers/PreferencesProvider";
import { Suggestions, Wizard, WizardChoices, WizardField, WizardReview } from "@/components/ui/Wizard";
import { useAsyncAction } from "@/components/ui/useAsyncAction";
import { api } from "@/lib/api-client";
import { formatMoney } from "@/lib/i18n/config";
import type { MessageKey } from "@/lib/i18n/translate";

export interface GoalDraft {
  id?: string;
  name: string;
  euros: string;
  months: string;
  /** Months since the customer started saving towards it. New goals only. */
  started?: string;
}

const NAMES: MessageKey[] = [
  "goals.suggest.buffer",
  "goals.suggest.holiday",
  "goals.suggest.home",
  "goals.suggest.device",
];
const AMOUNTS = [500, 1000, 2000, 5000];
const SPANS = [6, 12, 24, 36];

/** Adds or edits a savings goal, one question at a time. */
export function GoalWizard({
  draft,
  onClose,
  onSaved,
}: {
  /** The goal being edited, an empty draft for a new one, or null when closed. */
  draft: GoalDraft | null;
  onClose: () => void;
  onSaved: () => void;
}): React.JSX.Element {
  const { t, locale } = usePreferences();
  const [edited, setEdited] = useState<GoalDraft | null>(null);
  const value = edited ?? draft ?? { name: "", euros: "", months: "" };
  const set = (patch: Partial<GoalDraft>): void => setEdited({ ...value, ...patch });

  const euros = Number(value.euros.replace(",", "."));
  const months = Math.round(Number(value.months));
  const targetCents = Math.round(euros * 100);
  const amountOk = Number.isFinite(euros) && euros >= 1 && euros <= 1_000_000;
  const monthsOk = Number.isFinite(months) && months >= 1 && months <= 120;

  const { run } = useAsyncAction(() =>
    api("/api/goals", {
      method: value.id ? "PATCH" : "POST",
      json: { id: value.id, name: value.name.trim(), targetCents, months },
    }),
  );

  // False keeps the wizard open on the review step; the error toast comes from the hook.
  async function save(): Promise<boolean> {
    const result = await run();
    if (!result.ok) return false;
    setEdited(null);
    onSaved();
    return true;
  }

  return (
    <Wizard
      open={draft !== null}
      title={t(value.id ? "goals.wizard.edit" : "goals.wizard.new")}
      finishLabel={t("goals.save")}
      onClose={() => {
        setEdited(null);
        onClose();
      }}
      onFinish={save}
      steps={[
        {
          title: t("goals.step.name"),
          hint: t("goals.step.nameHint"),
          valid: value.name.trim().length > 0,
          content: (
            <>
              <WizardField
                label={t("goals.edit.name")}
                value={value.name}
                onChange={(event) => set({ name: event.target.value })}
                placeholder={t("goals.suggest.holiday")}
                maxLength={60}
                autoFocus
              />
              <Suggestions
                label={t("wizard.suggestions")}
                options={NAMES.map((key) => ({ label: t(key), value: t(key) }))}
                onPick={(name) => set({ name })}
              />
            </>
          ),
        },
        {
          title: t("goals.step.amount"),
          hint: t("goals.step.amountHint"),
          valid: amountOk,
          content: (
            <>
              <WizardField
                label={t("goals.edit.target")}
                value={value.euros}
                onChange={(event) => set({ euros: event.target.value })}
                placeholder="1000"
                inputMode="decimal"
                autoFocus
              />
              <Suggestions
                label={t("wizard.suggestions")}
                options={AMOUNTS.map((amount) => ({
                  label: formatMoney(amount * 100, locale),
                  value: String(amount),
                }))}
                onPick={(amount) => set({ euros: amount })}
              />
            </>
          ),
        },
        {
          title: t("goals.step.time"),
          hint: t("goals.step.timeHint"),
          valid: monthsOk,
          content: (
            <>
              <WizardField
                label={t("goals.edit.months")}
                value={value.months}
                onChange={(event) => set({ months: event.target.value })}
                placeholder="12"
                inputMode="numeric"
                autoFocus
              />
              <Suggestions
                label={t("wizard.suggestions")}
                options={SPANS.map((span) => ({
                  label: t("goals.months", { months: span }),
                  value: String(span),
                }))}
                onPick={(span) => set({ months: span })}
              />
            </>
          ),
        },
        ...(value.id
          ? []
          : [
              {
                title: t("goals.step.started"),
                hint: t("goals.step.startedHint"),
                valid: true,
                content: (
                  <WizardChoices
                    name="goal-started"
                    value={value.started ?? "0"}
                    onChange={(started) => set({ started })}
                    options={(["0", "3", "6", "12"] as const).map((months) => ({
                      value: months,
                      label: t(`goals.started.${months}` as MessageKey),
                    }))}
                  />
                ),
              },
            ]),
        {
          title: t("wizard.review"),
          hint: t("wizard.reviewHint"),
          valid: amountOk && monthsOk,
          content: (
            <WizardReview
              rows={[
                { label: t("goals.edit.name"), value: value.name },
                {
                  label: t("goals.step.amount"),
                  value: amountOk ? formatMoney(targetCents, locale) : "—",
                },
                {
                  label: t("goals.step.time"),
                  value: monthsOk ? t("goals.months", { months }) : "—",
                },
                {
                  label: t("goals.review.monthly"),
                  value:
                    amountOk && monthsOk
                      ? formatMoney(Math.ceil(targetCents / months), locale)
                      : "—",
                },
              ]}
            />
          ),
        },
      ]}
    />
  );
}
