"use client";

import { useState } from "react";

import { usePreferences } from "@/components/providers/PreferencesProvider";
import {
  Suggestions,
  Wizard,
  WizardChoices,
  WizardField,
  WizardReview,
} from "@/components/ui/Wizard";
import { VIEW_PERIODS, type ViewPeriod } from "@/lib/contracts/chart";
import type { MessageKey } from "@/lib/i18n/translate";

const NAMES: MessageKey[] = [
  "views.suggest.monthly",
  "views.suggest.bills",
  "views.suggest.savings",
  "views.suggest.fun",
];

export interface ViewDraft {
  mode: "new" | "rename";
  name: string;
  period: ViewPeriod;
}

/** Saves the current widgets as a new named view, or renames the open one. */
export function ViewWizard({
  draft,
  onClose,
  onSave,
}: {
  draft: ViewDraft | null;
  onClose: () => void;
  onSave: (name: string, period: ViewPeriod) => void;
}): React.JSX.Element {
  const { t } = usePreferences();
  const [edited, setEdited] = useState<ViewDraft | null>(null);
  const value = edited ??
    draft ?? { mode: "new" as const, name: "", period: "last_month" as ViewPeriod };
  const set = (patch: Partial<ViewDraft>): void => setEdited({ ...value, ...patch });
  const periodLabel = (period: ViewPeriod): string => t(`views.period.${period}` as MessageKey);

  return (
    <Wizard
      open={draft !== null}
      title={t(value.mode === "rename" ? "views.wizard.rename" : "views.wizard.new")}
      finishLabel={t("views.save")}
      onClose={() => {
        setEdited(null);
        onClose();
      }}
      onFinish={() => {
        onSave(value.name.trim(), value.period);
        setEdited(null);
      }}
      steps={[
        {
          title: t("views.step.name"),
          hint: t("views.step.nameHint"),
          valid: value.name.trim().length > 0,
          content: (
            <>
              <WizardField
                label={t("goals.edit.name")}
                value={value.name}
                onChange={(event) => set({ name: event.target.value })}
                placeholder={t("views.suggest.monthly")}
                maxLength={40}
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
          title: t("views.step.period"),
          hint: t("views.step.periodHint"),
          valid: true,
          content: (
            <WizardChoices
              name="view-period"
              value={value.period}
              onChange={(period) => set({ period })}
              options={VIEW_PERIODS.map((period) => ({
                value: period,
                label: periodLabel(period),
              }))}
            />
          ),
        },
        {
          title: t("wizard.review"),
          hint: t("wizard.reviewHint"),
          valid: value.name.trim().length > 0,
          content: (
            <WizardReview
              rows={[
                { label: t("goals.edit.name"), value: value.name },
                { label: t("views.period"), value: periodLabel(value.period) },
              ]}
            />
          ),
        },
      ]}
    />
  );
}
