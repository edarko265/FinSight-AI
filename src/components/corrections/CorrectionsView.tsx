"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { usePreferences } from "@/components/providers/PreferencesProvider";
import { useToast } from "@/components/providers/ToastProvider";
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
  const [data, setData] = useState<Payload | null>(null);
  const [failed, setFailed] = useState(false);
  const [tick, setTick] = useState(0);
  const [bill, setBill] = useState<Payload["bills"][number] | null>(null);
  const [mode, setMode] = useState<BillMode>("amount");
  const [euros, setEuros] = useState("");
  const [day, setDay] = useState("");

  useEffect(() => {
    let cancelled = false;
    api<Payload>("/api/corrections")
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
        <h1 className="text-xl font-semibold">{t("corrections.title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("corrections.intro")}</p>
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
            <button
              type="button"
              className="mt-2 text-sm font-semibold text-accent"
              onClick={() =>
                void send({ action: "undo", scope: "kind", key: item.key }, "toast.restored")
              }
            >
              {t("corrections.undo")}
            </button>
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
            <button
              type="button"
              className="mt-2 text-sm font-semibold text-accent"
              onClick={() =>
                void send({ action: "undo", scope: "transaction", key: item.key }, "toast.restored")
              }
            >
              {t("corrections.undo")}
            </button>
          </article>
        ))}
        <p className="text-xs text-muted">{t("corrections.how")}</p>
        <Link
          href={`/chat?q=${encodeURIComponent(t("chat.suggest.where"))}`}
          className="self-start rounded-full border border-border bg-surface px-5 py-2.5 text-sm font-semibold"
        >
          {t("corrections.find")}
        </Link>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">{t("corrections.bills")}</h2>
        <p className="text-xs text-muted">{t("corrections.bills.note")}</p>
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
                <button
                  type="button"
                  className="text-muted"
                  onClick={() =>
                    void send(
                      { action: "undo", scope: "bill", key: item.category },
                      "toast.restored",
                    )
                  }
                >
                  {t("corrections.undo")}
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </section>

      {data && (!none || data.bills.some((item) => item.adjustment)) ? (
        <button
          type="button"
          className="self-start rounded-full border border-border px-5 py-2.5 text-sm font-semibold"
          onClick={() => void send({ action: "undo_all" }, "toast.restored")}
        >
          {t("corrections.undoAll")}
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
