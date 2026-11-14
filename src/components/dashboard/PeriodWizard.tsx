"use client";

import { useState } from "react";

import { usePreferences } from "@/components/providers/PreferencesProvider";
import { Suggestions, Wizard, WizardReview } from "@/components/ui/Wizard";
import { formatDay } from "@/lib/i18n/config";

/** The first day in the dataset. */
export const DATA_START = "2024-10-01";

function shift(date: string, days: number): string {
  const moved = new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000);
  return moved.toISOString().slice(0, 10);
}

function DateField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: string;
  min: string;
  max: string;
  onChange: (value: string) => void;
}): React.JSX.Element {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      {label}
      <input
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-base font-normal outline-none focus-visible:ring-2 focus-visible:ring-accent"
      />
    </label>
  );
}

/** Picks a custom date range for a dashboard view, with the device's own date picker. */
export function PeriodWizard({
  open,
  asOf,
  initial,
  onClose,
  onApply,
}: {
  open: boolean;
  /** The demo's "today": the last day there is data for. */
  asOf: string;
  initial?: { from: string; to: string };
  onClose: () => void;
  onApply: (from: string, to: string) => void;
}): React.JSX.Element {
  const { t, locale } = usePreferences();
  const [from, setFrom] = useState(initial?.from ?? shift(asOf, -29));
  const [to, setTo] = useState(initial?.to ?? asOf);
  const inRange = (value: string): boolean => value >= DATA_START && value <= asOf;
  const fromOk = inRange(from);
  const toOk = inRange(to) && to >= from;

  return (
    <Wizard
      open={open}
      title={t("views.custom.title")}
      finishLabel={t("views.custom.apply")}
      onClose={onClose}
      onFinish={() => onApply(from, to)}
      steps={[
        {
          title: t("views.custom.from"),
          hint: t("views.custom.fromHint", { start: formatDay(DATA_START, locale) }),
          valid: fromOk,
          content: (
            <>
              <DateField
                label={t("views.custom.fromField")}
                value={from}
                min={DATA_START}
                max={asOf}
                onChange={setFrom}
              />
              <Suggestions
                label={t("wizard.suggestions")}
                options={[
                  { label: t("views.custom.last30"), value: shift(asOf, -29) },
                  { label: t("views.custom.last90"), value: shift(asOf, -89) },
                  { label: t("views.custom.thisYear"), value: `${asOf.slice(0, 4)}-01-01` },
                  { label: t("views.custom.all"), value: DATA_START },
                ]}
                onPick={setFrom}
              />
            </>
          ),
        },
        {
          title: t("views.custom.to"),
          hint: t("views.custom.toHint", { end: formatDay(asOf, locale) }),
          valid: toOk,
          content: (
            <>
              <DateField
                label={t("views.custom.toField")}
                value={to}
                min={from}
                max={asOf}
                onChange={setTo}
              />
              <Suggestions
                label={t("wizard.suggestions")}
                options={[{ label: t("views.custom.today"), value: asOf }]}
                onPick={setTo}
              />
            </>
          ),
        },
        {
          title: t("wizard.review"),
          hint: t("wizard.reviewHint"),
          valid: fromOk && toOk,
          content: (
            <WizardReview
              rows={[
                {
                  label: t("views.custom.fromField"),
                  value: fromOk ? formatDay(from, locale) : "—",
                },
                { label: t("views.custom.toField"), value: toOk ? formatDay(to, locale) : "—" },
              ]}
            />
          ),
        },
      ]}
    />
  );
}
