"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { useOverview } from "@/components/providers/OverviewProvider";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import { useToast } from "@/components/providers/ToastProvider";
import {
  Suggestions,
  Wizard,
  WizardChoices,
  WizardField,
  WizardReview,
} from "@/components/ui/Wizard";
import { CONSUMPTION_CATEGORIES } from "@/lib/analytics/classify";
import { addDays } from "@/lib/analytics/periods";
import { api, ApiError } from "@/lib/api-client";
import { INCOME_SOURCES, type EntryKind } from "@/lib/data/entries";
import { formatDay, formatMoney } from "@/lib/i18n/config";
import type { MessageKey } from "@/lib/i18n/translate";

export interface EntryRow {
  id: string;
  kind: EntryKind;
  cents: number;
  date: string;
  category: string;
  note: string;
}

export interface EntryAlert {
  id: string;
  severity: "warning" | "info";
  title: string;
  body: string;
}

/** What the wizard is open for: a new entry of one kind, or an existing one to change. */
export type EntryDraft = { kind: EntryKind; entry?: EntryRow };

const QUICK: Record<EntryKind, number[]> = {
  expense: [5, 10, 20, 50, 100],
  income: [50, 100, 500, 1000, 2000],
};
const BACK_DAYS = 366;
const signed = (kind: EntryKind, cents: number): number => (kind === "income" ? cents : -cents);

/** The name of an expense category or an income source, in the customer's language. */
export function entryLabel(kind: EntryKind, category: string): MessageKey {
  return (kind === "income" ? `entries.source.${category}` : `cat.${category}`) as MessageKey;
}

function Form({
  draft,
  onClose,
  onSaved,
}: {
  draft: EntryDraft;
  onClose: () => void;
  onSaved: (alerts: EntryAlert[]) => void;
}): React.JSX.Element {
  const { t, locale } = usePreferences();
  const toast = useToast();
  const { overview } = useOverview();
  const { kind, entry } = draft;
  const asOf = overview?.asOf ?? "";
  const [euros, setEuros] = useState(entry ? String(entry.cents / 100) : "");
  const [category, setCategory] = useState(
    entry?.category ?? (kind === "income" ? "salary" : "Groceries"),
  );
  const [date, setDate] = useState(entry?.date ?? asOf);
  const [note, setNote] = useState(entry?.note ?? "");
  const [error, setError] = useState<MessageKey | null>(null);

  const money = (cents: number): string => formatMoney(cents, locale);
  const amount = Number(euros.replace(",", "."));
  const amountValid =
    euros.trim() !== "" && Number.isFinite(amount) && amount >= 0.01 && amount <= 100_000;
  const cents = amountValid ? Math.round(amount * 100) : 0;
  const earliest = asOf ? addDays(asOf, -BACK_DAYS) : "";
  const dateValid = /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= asOf && date >= earliest;
  const options = (kind === "income" ? INCOME_SOURCES : CONSUMPTION_CATEGORIES).map((value) => ({
    value,
    label: t(entryLabel(kind, value)),
  }));
  // The balance once this is saved: an edit first takes the old amount back out.
  const after =
    (overview?.balanceCents ?? 0) -
    (entry ? signed(entry.kind, entry.cents) : 0) +
    signed(kind, cents);

  async function save(): Promise<boolean> {
    setError(null);
    try {
      const result = await api<{ alerts: EntryAlert[] }>(`/api/entries?locale=${locale}`, {
        method: "POST",
        json: {
          action: entry ? "update" : "add",
          ...(entry ? { id: entry.id } : {}),
          kind,
          cents,
          date,
          category,
          note: note.trim(),
        },
      });
      toast.notify(entry ? "toast.updated" : `entries.saved.${kind}`);
      onSaved(result.alerts);
      return true;
    } catch (failure) {
      setError(
        failure instanceof ApiError && failure.code === "too_many"
          ? "entries.tooMany"
          : "toast.error",
      );
      return false;
    }
  }

  return (
    <Wizard
      open
      title={t(entry ? `entries.edit.${kind}` : `entries.add.${kind}`)}
      finishLabel={t("common.save")}
      error={error ? t(error) : null}
      onClose={onClose}
      onFinish={save}
      steps={[
        {
          title: t("entries.step.amount"),
          hint: t(`entries.step.amountHint.${kind}`),
          valid: amountValid,
          content: (
            <>
              <WizardField
                label={t("entries.amount")}
                value={euros}
                onChange={(event) => setEuros(event.target.value)}
                inputMode="decimal"
                autoFocus
              />
              <Suggestions
                label={t("wizard.suggestions")}
                options={QUICK[kind].map((value) => ({
                  label: money(value * 100),
                  value: String(value),
                }))}
                onPick={setEuros}
              />
            </>
          ),
        },
        {
          title: t(`entries.step.category.${kind}`),
          hint: t(`entries.step.categoryHint.${kind}`),
          valid: true,
          content: (
            <WizardChoices
              name="entry-category"
              options={options}
              value={category}
              onChange={setCategory}
            />
          ),
        },
        {
          title: t("entries.step.when"),
          hint: t("entries.step.whenHint"),
          valid: dateValid,
          content: (
            <div className="flex flex-col gap-4">
              <div>
                <WizardField
                  label={t("entries.date")}
                  type="date"
                  value={date}
                  min={earliest}
                  max={asOf}
                  onChange={(event) => setDate(event.target.value)}
                />
                {asOf ? (
                  <Suggestions
                    label={t("wizard.suggestions")}
                    options={[
                      { label: t("entries.today"), value: asOf },
                      { label: t("entries.yesterday"), value: addDays(asOf, -1) },
                    ]}
                    onPick={setDate}
                  />
                ) : null}
              </div>
              <WizardField
                label={t("entries.note")}
                value={note}
                maxLength={60}
                placeholder={t(`entries.notePlaceholder.${kind}`)}
                onChange={(event) => setNote(event.target.value)}
              />
            </div>
          ),
        },
        {
          title: t("wizard.review"),
          hint: t("entries.reviewHint"),
          valid: amountValid && dateValid,
          content: (
            <WizardReview
              rows={[
                { label: t("entries.amount"), value: money(signed(kind, cents)) },
                {
                  label: t(`entries.step.category.${kind}`),
                  value: t(entryLabel(kind, category)),
                },
                { label: t("entries.date"), value: dateValid ? formatDay(date, locale) : "—" },
                ...(note.trim() ? [{ label: t("entries.note"), value: note.trim() }] : []),
                { label: t("entries.balanceAfter"), value: money(after) },
              ]}
            />
          ),
        },
      ]}
    />
  );
}

/** Says, right after an entry is saved, what it pushed over a limit or away from the plan. */
function Alerts({
  alerts,
  onClose,
}: {
  alerts: EntryAlert[];
  onClose: () => void;
}): React.JSX.Element {
  const { t } = usePreferences();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="entry-alerts-title"
      className="m-0 mx-auto mt-auto w-full max-w-md flex-col gap-4 rounded-t-3xl bg-background p-5 text-foreground backdrop:bg-black/50 open:flex md:my-auto md:rounded-3xl"
    >
      <h2 id="entry-alerts-title" className="text-lg font-semibold">
        {t("entries.alerts.title")}
      </h2>
      <p className="text-sm text-muted">{t("entries.alerts.intro")}</p>
      <ul className="flex flex-col gap-2">
        {alerts.map((alert) => (
          <li
            key={alert.id}
            className={`flex flex-col gap-0.5 rounded-2xl border px-4 py-3 text-sm ${
              alert.severity === "warning"
                ? "border-warning bg-warning-soft"
                : "border-border bg-accent-soft"
            }`}
          >
            <span className="font-semibold">{alert.title}</span>
            <span className="text-muted">{alert.body}</span>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Link
          href="/insights"
          onClick={onClose}
          className="rounded-full border border-border px-5 py-3 text-sm font-semibold"
        >
          {t("entries.alerts.all")}
        </Link>
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-on-primary"
        >
          {t("entries.alerts.ok")}
        </button>
      </div>
    </dialog>
  );
}

/**
 * Records income or an expense in four short steps. Once saved, the balance
 * and estimates everywhere are brought up to date, and anything the entry
 * tipped over (a monthly limit, the plan being followed) is said at once.
 */
export function EntryWizard({
  draft,
  onClose,
  onSaved,
}: {
  draft: EntryDraft | null;
  onClose: () => void;
  onSaved?: () => void;
}): React.JSX.Element | null {
  const { refresh } = useOverview();
  const [alerts, setAlerts] = useState<EntryAlert[]>([]);
  return (
    <>
      {draft ? (
        <Form
          key={`${draft.kind}:${draft.entry?.id ?? "new"}`}
          draft={draft}
          onClose={onClose}
          onSaved={(raised) => {
            onClose();
            refresh();
            onSaved?.();
            setAlerts(raised);
          }}
        />
      ) : null}
      {alerts.length > 0 ? <Alerts alerts={alerts} onClose={() => setAlerts([])} /> : null}
    </>
  );
}
