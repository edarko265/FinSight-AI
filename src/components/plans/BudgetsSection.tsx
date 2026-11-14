"use client";

import { useCallback, useEffect, useState } from "react";

import { usePreferences } from "@/components/providers/PreferencesProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { Suggestions, Wizard, WizardField, WizardReview } from "@/components/ui/Wizard";
import { api, ApiError } from "@/lib/api-client";
import { formatMoney } from "@/lib/i18n/config";
import type { MessageKey } from "@/lib/i18n/translate";

interface BudgetStatus {
  id: string;
  target: string;
  cents: number;
  spentCents: number;
  percent: number;
  level: "ok" | "close" | "over";
}

interface Payload {
  budgets: BudgetStatus[];
  targets: string[];
  typical: { category: string; monthlyCents: number }[];
}

/** Monthly limits per kind of spending: a yardstick the customer sets, with this month's progress. */
export function BudgetsSection(): React.JSX.Element {
  const { t, locale } = usePreferences();
  const toast = useToast();
  const [data, setData] = useState<Payload | null>(null);
  const [failed, setFailed] = useState(false);
  const [tick, setTick] = useState(0);
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState("Restaurants");
  const [euros, setEuros] = useState("");
  const [error, setError] = useState<MessageKey | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<Payload>("/api/budgets")
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
  const label = (key: string): string => t(`cat.${key}` as MessageKey);
  const amount = Number(euros.replace(",", "."));
  const valid = euros.trim() !== "" && Number.isFinite(amount) && amount >= 1 && amount <= 100_000;
  const usual = data?.typical.find((item) => item.category === target)?.monthlyCents ?? 0;

  async function save(): Promise<boolean> {
    setError(null);
    try {
      await api("/api/budgets", {
        method: "POST",
        json: { action: "set", target, cents: Math.round(amount * 100) },
      });
    } catch (failure) {
      setError(
        failure instanceof ApiError && failure.code === "too_many"
          ? "budgets.tooMany"
          : "toast.error",
      );
      return false;
    }
    toast.notify("toast.saved");
    setOpen(false);
    reload();
    return true;
  }

  async function remove(id: string): Promise<void> {
    try {
      await api("/api/budgets", { method: "POST", json: { action: "delete", id } });
      toast.notify("toast.movedToBin");
      reload();
    } catch {
      toast.fail();
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold">{t("budgets.title")}</h2>
      <p className="text-xs text-muted">{t("budgets.note")}</p>
      {failed ? <p className="text-sm text-warning">{t("admin.loadFailed")}</p> : null}
      {data && data.budgets.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted">
          {t("budgets.empty")}
        </p>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        {data?.budgets.map((budget) => (
          <article key={budget.id} className="rounded-2xl border border-border bg-surface p-4">
            <p className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-semibold">{label(budget.target)}</span>
              <span className="tabular-nums">
                {money(budget.spentCents)} / {money(budget.cents)}
              </span>
            </p>
            <div
              className="mt-2 h-3 overflow-hidden rounded-full bg-border"
              role="meter"
              aria-label={label(budget.target)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.min(100, budget.percent)}
            >
              <div
                className={`h-full rounded-full ${budget.level === "ok" ? "bg-accent" : "bg-warning"}`}
                style={{ width: `${Math.min(100, budget.percent)}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-muted">
              {t(`budgets.level.${budget.level}`, { percent: budget.percent })}
            </p>
            <div className="mt-2 flex gap-4 text-sm font-semibold">
              <button
                type="button"
                className="text-accent"
                onClick={() => {
                  setTarget(budget.target);
                  setEuros(String(budget.cents / 100));
                  setError(null);
                  setOpen(true);
                }}
              >
                {t("common.edit")}
              </button>
              <button type="button" className="text-muted" onClick={() => void remove(budget.id)}>
                {t("common.moveToBin")}
              </button>
            </div>
          </article>
        ))}
      </div>
      <button
        type="button"
        onClick={() => {
          setEuros("");
          setError(null);
          setOpen(true);
        }}
        className="self-start rounded-full border border-border bg-surface px-5 py-2.5 text-sm font-semibold"
      >
        {t("budgets.add")}
      </button>

      <Wizard
        open={open}
        title={t("budgets.add")}
        finishLabel={t("common.save")}
        error={error ? t(error) : null}
        onClose={() => setOpen(false)}
        onFinish={save}
        steps={[
          {
            title: t("budgets.step.what"),
            hint: t("budgets.step.whatHint"),
            valid: true,
            content: (
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                {t("budgets.step.what")}
                <select
                  value={target}
                  onChange={(event) => setTarget(event.target.value)}
                  className="rounded-xl border border-border bg-surface px-4 py-3 text-base font-normal"
                >
                  {(data?.targets ?? []).map((key) => (
                    <option key={key} value={key}>
                      {label(key)}
                    </option>
                  ))}
                </select>
              </label>
            ),
          },
          {
            title: t("budgets.step.amount"),
            hint:
              usual > 0
                ? t("budgets.step.amountHint", { usual: money(usual) })
                : t("budgets.step.amountHintNone"),
            valid,
            content: (
              <>
                <WizardField
                  label={t("budgets.amount")}
                  value={euros}
                  onChange={(event) => setEuros(event.target.value)}
                  inputMode="decimal"
                  autoFocus
                />
                {usual >= 1000 ? (
                  <Suggestions
                    label={t("wizard.suggestions")}
                    options={[1, 0.9, 0.75].map((share) => {
                      const whole = Math.round((usual * share) / 500) * 5;
                      return { label: money(whole * 100), value: String(whole) };
                    })}
                    onPick={setEuros}
                  />
                ) : null}
              </>
            ),
          },
          {
            title: t("wizard.review"),
            hint: t("budgets.reviewHint"),
            valid,
            content: (
              <WizardReview
                rows={[
                  { label: t("budgets.step.what"), value: label(target) },
                  {
                    label: t("budgets.amount"),
                    value: money(Math.round((valid ? amount : 0) * 100)),
                  },
                ]}
              />
            ),
          },
        ]}
      />
    </section>
  );
}
