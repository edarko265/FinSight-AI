"use client";

import Link from "next/link";
import { useState } from "react";

import { usePreferences } from "@/components/providers/PreferencesProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { useLoad } from "@/components/shared/useLoad";
import { LoadError } from "@/components/ui/LoadError";
import { LoadingRegion, SkeletonCard } from "@/components/ui/Skeleton";
import { PendingLabel } from "@/components/ui/Spinner";
import { useAsyncAction } from "@/components/ui/useAsyncAction";
import {
  Suggestions,
  Wizard,
  WizardChoices,
  WizardField,
  WizardReview,
} from "@/components/ui/Wizard";
import { api } from "@/lib/api-client";
import { formatDay, formatMoney } from "@/lib/i18n/config";
import { hasMessage, type MessageKey } from "@/lib/i18n/translate";
import { InfoTip } from "@/components/ui/InfoTip";

interface Pair {
  basket: string;
  necessity: string;
}
interface Payload {
  transactions: {
    key: string;
    date: string;
    amountCents: number;
    category: string;
    original: Pair;
    override: Pair;
  }[];
  kinds: {
    key: string;
    category: string;
    mcc: string | null;
    count: number;
    original: Pair | null;
    override: Pair;
  }[];
  bills: {
    category: string;
    suggested: { cents: number; day: number | null };
    current: { cents: number; day: number | null } | null;
    adjustment: { cents?: number; day?: number; skip?: boolean } | null;
  }[];
}

type BillMode = "amount" | "skip";

/** Everything the customer has corrected, each beside what the app had worked out, each undoable. */
export function CorrectionsView(): React.JSX.Element {
  const { t, locale } = usePreferences();
  const toast = useToast();
  const { data, failed, retry: reload } = useLoad(() => api<Payload>("/api/corrections"));
  const [bill, setBill] = useState<Payload["bills"][number] | null>(null);
  const [mode, setMode] = useState<BillMode>("amount");
  const [euros, setEuros] = useState("");
  const [day, setDay] = useState("");

  const money = (cents: number): string => formatMoney(cents, locale);
  const label = (prefix: string, value: string): string =>
    hasMessage(`${prefix}.${value}`) ? t(`${prefix}.${value}` as MessageKey) : value;
  const pair = (value: Pair | null): string =>
    value ? `${label("basket", value.basket)} · ${label("necessity", value.necessity)}` : "—";

  async function send(payload: Record<string, unknown>, message: MessageKey): Promise<boolean> {
    try {
      await api("/api/corrections", { method: "POST", json: payload });
    } catch {
      toast.fail();
      return false;
    }
    toast.notify(message);
    reload();
    return true;
  }

  const undoAll = useAsyncAction(
    () => api("/api/corrections", { method: "POST", json: { action: "undo_all" } }),
    { successKey: "toast.restored" },
  );
  async function runUndoAll(): Promise<void> {
    const result = await undoAll.run();
    if (result.ok) reload();
  }

  const amount = Number(euros.replace(",", "."));
  const dayNumber = Number(day);
  const amountValid =
    euros.trim() !== "" && Number.isFinite(amount) && amount >= 0 && amount <= 100_000;
  const dayValid =
    day.trim() === "" || (Number.isInteger(dayNumber) && dayNumber >= 1 && dayNumber <= 31);
  const none = data && data.transactions.length === 0 && data.kinds.length === 0;
  const card = "rounded-2xl border border-border bg-surface p-4";

  return (
    <div className="flex flex-col gap-5 px-4 py-4">
      <div>
        <InfoTip lead={<h1 className="text-xl font-semibold">{t("corrections.title")}</h1>}>
          {t("corrections.intro")}
        </InfoTip>
      </div>
      {failed ? <LoadError onRetry={reload} /> : null}
      {!data && !failed ? (
        <LoadingRegion className="flex flex-col gap-3">
          <SkeletonCard />
          <SkeletonCard />
        </LoadingRegion>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">{t("corrections.baskets")}</h2>
        {none ? (
          <p className="rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted">
            {t("corrections.empty")}
          </p>
        ) : null}
        {data?.kinds.map((item) => (
          <article key={item.key} className={card}>
            <h3 className="text-sm font-semibold">
              {t("corrections.scope.kind", { category: label("cat", item.category) })}
              <span className="font-normal text-muted">
                {" "}
                · {t("corrections.count", { count: item.count })}
              </span>
            </h3>
            <p className="mt-1 text-sm text-muted">
              {t("corrections.was")}: {pair(item.original)}
            </p>
            <p className="text-sm">
              {t("corrections.now")}: <span className="font-medium">{pair(item.override)}</span>
            </p>
            <UndoButton scope="kind" itemKey={item.key} onDone={reload} />
          </article>
        ))}
        {data?.transactions.map((item) => (
          <article key={item.key} className={card}>
            <h3 className="text-sm font-semibold">
              {label("cat", item.category)} · {money(-item.amountCents)}
              <span className="font-normal text-muted"> · {formatDay(item.date, locale)}</span>
            </h3>
            <p className="mt-1 text-sm text-muted">
              {t("corrections.was")}: {pair(item.original)}
            </p>
            <p className="text-sm">
              {t("corrections.now")}: <span className="font-medium">{pair(item.override)}</span>
            </p>
            <UndoButton scope="transaction" itemKey={item.key} onDone={reload} />
          </article>
        ))}
        <InfoTip>{t("corrections.how")}</InfoTip>
        <Link
          href={`/chat?q=${encodeURIComponent(t("chat.suggest.where"))}`}
          className="self-start rounded-full border border-border bg-surface px-5 py-2.5 text-sm font-semibold"
        >
          {t("corrections.find")}
        </Link>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">{t("corrections.bills")}</h2>
        <InfoTip>{t("corrections.bills.note")}</InfoTip>
        {data && data.bills.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted">
            {t("corrections.bills.empty")}
          </p>
        ) : null}
        {data?.bills.map((item) => (
          <article key={item.category} className={card}>
            <h3 className="text-sm font-semibold">{label("cat", item.category)}</h3>
            <p className="mt-1 text-sm text-muted">
              {t("corrections.bills.suggested")}: {money(item.suggested.cents)}
              {item.suggested.day
                ? ` · ${t("corrections.bills.day", { day: item.suggested.day })}`
                : ""}
            </p>
            {item.adjustment ? (
              <p className="text-sm">
                {t("corrections.now")}:{" "}
                <span className="font-medium">
                  {item.adjustment.skip || !item.current
                    ? t("corrections.bills.skipped")
                    : `${money(item.current.cents)}${item.current.day ? ` · ${t("corrections.bills.day", { day: item.current.day })}` : ""}`}
                </span>
              </p>
            ) : null}
            <div className="mt-2 flex gap-4 text-sm font-semibold">
              <button
                type="button"
                className="text-accent"
                onClick={() => {
                  setMode(item.adjustment?.skip ? "skip" : "amount");
                  setEuros(String((item.adjustment?.cents ?? item.suggested.cents) / 100));
                  setDay(String(item.adjustment?.day ?? item.suggested.day ?? ""));
                  setBill(item);
                }}
              >
                {t("common.edit")}
              </button>
              {item.adjustment ? (
                <UndoButton scope="bill" itemKey={item.category} onDone={reload} muted />
              ) : null}
            </div>
          </article>
        ))}
      </section>

      {data && (!none || data.bills.some((item) => item.adjustment)) ? (
        <button
          type="button"
          className="min-h-11 self-start rounded-full border border-border px-5 py-2.5 text-sm font-semibold"
          aria-disabled={undoAll.pending}
          onClick={() => void runUndoAll()}
        >
          {undoAll.pending ? (
            <PendingLabel>{t("common.restoring")}</PendingLabel>
          ) : (
            t("corrections.undoAll")
          )}
        </button>
      ) : null}

      <Wizard
        open={bill !== null}
        title={t("corrections.bills.edit", { category: label("cat", bill?.category ?? "") })}
        finishLabel={t("common.save")}
        onClose={() => setBill(null)}
        onFinish={async () => {
          if (!bill) return false;
          const done = await send(
            mode === "skip"
              ? { action: "bill", category: bill.category, skip: true }
              : {
                  action: "bill",
                  category: bill.category,
                  cents: Math.round(amount * 100),
                  day: day.trim() === "" ? undefined : dayNumber,
                },
            "toast.updated",
          );
          if (done) setBill(null);
          return done;
        }}
        steps={[
          {
            title: t("corrections.bills.step.kind"),
            hint: t("corrections.bills.step.kindHint"),
            valid: true,
            content: (
              <WizardChoices
                name="bill-mode"
                value={mode}
                onChange={setMode}
                options={[
                  {
                    value: "amount",
                    label: t("corrections.bills.mode.amount"),
                    note: t("corrections.bills.mode.amount.note"),
                  },
                  {
                    value: "skip",
                    label: t("corrections.bills.mode.skip"),
                    note: t("corrections.bills.mode.skip.note"),
                  },
                ]}
              />
            ),
          },
          ...(mode === "amount"
            ? [
                {
                  title: t("corrections.bills.step.amount"),
                  hint: t("corrections.bills.step.amountHint"),
                  valid: amountValid && dayValid,
                  content: (
                    <>
                      <WizardField
                        label={t("corrections.bills.amount")}
                        value={euros}
                        onChange={(event) => setEuros(event.target.value)}
                        inputMode="decimal"
                        autoFocus
                      />
                      {bill ? (
                        <Suggestions
                          label={t("wizard.suggestions")}
                          options={[
                            {
                              label: money(bill.suggested.cents),
                              value: String(bill.suggested.cents / 100),
                            },
                            {
                              label: money(Math.round(bill.suggested.cents * 1.1)),
                              value: String(Math.round(bill.suggested.cents * 1.1) / 100),
                            },
                          ]}
                          onPick={setEuros}
                        />
                      ) : null}
                      <WizardField
                        label={t("corrections.bills.dayLabel")}
                        value={day}
                        onChange={(event) => setDay(event.target.value)}
                        inputMode="numeric"
                        placeholder="1–31"
                      />
                    </>
                  ),
                },
              ]
            : []),
          {
            title: t("wizard.review"),
            hint: t("corrections.reviewHint"),
            valid: mode === "skip" || (amountValid && dayValid),
            content: bill ? (
              <WizardReview
                rows={[
                  {
                    label: t("corrections.bills.suggested"),
                    value: `${money(bill.suggested.cents)}${bill.suggested.day ? ` · ${t("corrections.bills.day", { day: bill.suggested.day })}` : ""}`,
                  },
                  {
                    label: t("corrections.now"),
                    value:
                      mode === "skip"
                        ? t("corrections.bills.skipped")
                        : `${money(Math.round((amountValid ? amount : 0) * 100))}${day.trim() ? ` · ${t("corrections.bills.day", { day: dayNumber })}` : ""}`,
                  },
                ]}
              />
            ) : null,
          },
        ]}
      />
    </div>
  );
}

/** Undo button for one correction. It owns its hook so each one shows its own pending state. */
function UndoButton({
  scope,
  itemKey,
  onDone,
  muted = false,
}: {
  scope: "kind" | "transaction" | "bill";
  itemKey: string;
  onDone: () => void;
  muted?: boolean;
}): React.JSX.Element {
  const { t } = usePreferences();
  const undo = useAsyncAction(
    () =>
      api("/api/corrections", { method: "POST", json: { action: "undo", scope, key: itemKey } }),
    { successKey: "toast.restored" },
  );

  async function onClick(): Promise<void> {
    const result = await undo.run();
    if (result.ok) onDone();
  }

  return (
    <button
      type="button"
      className={`min-h-11 text-sm font-semibold ${muted ? "text-muted" : "text-accent"}`}
      aria-disabled={undo.pending}
      onClick={() => void onClick()}
    >
      {undo.pending ? <PendingLabel>{t("common.restoring")}</PendingLabel> : t("corrections.undo")}
    </button>
  );
}
