"use client";

import { useCallback, useEffect, useState } from "react";

import {
  entryLabel,
  EntryWizard,
  type EntryDraft,
  type EntryRow,
} from "@/components/entries/EntryWizard";
import { useOverview } from "@/components/providers/OverviewProvider";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { PlusIcon } from "@/components/ui/icons";
import { api } from "@/lib/api-client";
import { formatDay, formatMoney } from "@/lib/i18n/config";

interface Payload {
  asOf: string;
  balanceCents: number;
  entries: EntryRow[];
}

/**
 * Income and expenses the customer recorded themselves: add, change, or move
 * to the recycle bin. Each one counts in the balance, the baskets, the
 * monthly limits and the plan like any other transaction.
 */
export function EntriesView(): React.JSX.Element {
  const { t, locale } = usePreferences();
  const toast = useToast();
  const { refresh } = useOverview();
  const [data, setData] = useState<Payload | null>(null);
  const [failed, setFailed] = useState(false);
  const [tick, setTick] = useState(0);
  const [draft, setDraft] = useState<EntryDraft | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<Payload>("/api/entries")
      .then((payload) => {
        if (cancelled) return;
        setData(payload);
        setFailed(false);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [tick]);

  const reload = useCallback(() => setTick((value) => value + 1), []);
  const money = (cents: number): string => formatMoney(cents, locale);

  async function remove(id: string): Promise<void> {
    try {
      await api("/api/entries", { method: "POST", json: { action: "delete", id } });
      toast.notify("toast.movedToBin");
      reload();
      refresh();
    } catch {
      toast.fail();
    }
  }

  const month = data?.asOf.slice(0, 7) ?? "";
  const thisMonth = (data?.entries ?? []).filter((entry) => entry.date.startsWith(month));
  const sum = (kind: EntryRow["kind"]): number =>
    thisMonth.filter((entry) => entry.kind === kind).reduce((total, e) => total + e.cents, 0);

  return (
    <div className="flex flex-col gap-5 px-4 py-4">
      <div>
        <h1 className="text-xl font-semibold">{t("entries.title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("entries.intro")}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setDraft({ kind: "income" })}
          className="flex items-center gap-1 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary"
        >
          <PlusIcon className="size-4" />
          {t("entries.add.income")}
        </button>
        <button
          type="button"
          onClick={() => setDraft({ kind: "expense" })}
          className="flex items-center gap-1 rounded-full border border-border bg-surface px-4 py-2.5 text-sm font-semibold"
        >
          <PlusIcon className="size-4" />
          {t("entries.add.expense")}
        </button>
      </div>

      {failed ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-warning bg-warning-soft px-4 py-3 text-sm"
        >
          <span>{t("admin.loadFailed")}</span>
          <button type="button" className="font-semibold underline" onClick={reload}>
            {t("admin.retry")}
          </button>
        </div>
      ) : null}

      {data ? (
        <>
          <section className="rounded-2xl bg-brand p-5 text-on-brand">
            <p className="text-sm opacity-80">{t("dashboard.balance")}</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">{money(data.balanceCents)}</p>
            <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-white/15 pt-3 text-sm">
              <div>
                <dt className="text-xs opacity-80">{t("entries.month.income")}</dt>
                <dd className="text-lg font-semibold tabular-nums">{money(sum("income"))}</dd>
              </div>
              <div>
                <dt className="text-xs opacity-80">{t("entries.month.expense")}</dt>
                <dd className="text-lg font-semibold tabular-nums">{money(sum("expense"))}</dd>
              </div>
            </dl>
          </section>

          {data.entries.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted">
              {t("entries.empty")}
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {data.entries.map((entry) => (
                <li key={entry.id} className="rounded-2xl border border-border bg-surface p-4">
                  <p className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate font-semibold">
                      {t(entryLabel(entry.kind, entry.category))}
                    </span>
                    <span
                      className={`shrink-0 font-semibold tabular-nums ${
                        entry.kind === "income" ? "text-accent" : ""
                      }`}
                    >
                      {entry.kind === "income" ? "+" : "−"}
                      {money(entry.cents)}
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {t(`entries.kind.${entry.kind}`)} · {formatDay(entry.date, locale)}
                    {entry.note ? ` · ${entry.note}` : ""}
                  </p>
                  <div className="mt-2 flex gap-4 text-sm font-semibold">
                    <button
                      type="button"
                      className="text-accent"
                      onClick={() => setDraft({ kind: entry.kind, entry })}
                    >
                      {t("common.edit")}
                    </button>
                    <button
                      type="button"
                      className="text-muted"
                      onClick={() => void remove(entry.id)}
                    >
                      {t("common.moveToBin")}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}

      <EntryWizard draft={draft} onClose={() => setDraft(null)} onSaved={reload} />
    </div>
  );
}
