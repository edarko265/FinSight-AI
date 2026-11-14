"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { GoalWizard, type GoalDraft } from "@/components/goals/GoalWizard";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { api } from "@/lib/api-client";
import { formatMoney } from "@/lib/i18n/config";
import type { MessageKey } from "@/lib/i18n/translate";

interface GoalPlan {
  goal: { id: string; name: string; targetCents: number; months: number; monthlyCents: number };
  roomCents: number;
  fromCutsCents: number;
  fit: "fits" | "stretch" | "hard";
}

interface Rewards {
  points: number;
  level: "starter" | "bronze" | "silver" | "gold";
  nextLevelAt: number | null;
  achievements: { id: string; title: string; body: string; points: number; earned: boolean }[];
  coupons: { id: string; title: string; body: string; unlockAt: number; unlocked: boolean }[];
}

interface GoalsPayload {
  goals: GoalPlan[];
  rewards: Rewards;
  recommendations: { id: string; title: string; body: string; monthlyValueCents: number }[];
}

const FIT_TONE = {
  fits: "bg-accent-soft text-accent",
  stretch: "bg-accent-soft text-accent",
  hard: "bg-warning-soft text-warning",
} as const;

/** Goals set in conversation with the coach, what would help most, and rewards for real progress. */
export function GoalsView(): React.JSX.Element {
  const { t, locale } = usePreferences();
  const toast = useToast();
  const [data, setData] = useState<GoalsPayload | null>(null);
  const [tick, setTick] = useState(0);
  const [editing, setEditing] = useState<GoalDraft | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<GoalsPayload>(`/api/goals?locale=${locale}`)
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [locale, tick]);

  async function remove(id: string): Promise<void> {
    await api("/api/goals", { method: "DELETE", json: { id } }).catch(() => undefined);
    toast.notify("toast.movedToBin");
    setTick((value) => value + 1);
  }

  const rewards = data?.rewards;
  const money = (cents: number): string => formatMoney(cents, locale);
  const askLink = (question: MessageKey): string => `/chat?q=${encodeURIComponent(t(question))}`;

  return (
    <div className="flex flex-col gap-5 px-4 py-4">
      <h1 className="text-xl font-semibold">{t("goals.title")}</h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">{t("goals.yours")}</h2>
        {data && data.goals.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted">
            {t("goals.empty")}
          </p>
        ) : null}
        {data?.goals.map(({ goal, fit, roomCents }) => (
          <article key={goal.id} className="rounded-2xl border border-border bg-surface p-4">
            <h3 className="text-base font-semibold">{goal.name}</h3>
            <p className="text-2xl font-semibold tabular-nums">{money(goal.targetCents)}</p>
            <p className="mt-1 text-sm text-muted">
              {t("goals.perMonth", { monthly: money(goal.monthlyCents), months: goal.months })}
            </p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-border" aria-hidden="true">
              <div
                className="h-full rounded-full bg-accent"
                style={{
                  width: `${Math.min(100, Math.round((roomCents / Math.max(1, goal.monthlyCents)) * 100))}%`,
                }}
              />
            </div>
            <p className="mt-2 flex items-center justify-between gap-2 text-xs text-muted">
              <span>
                {t("goal.row.room")}: {money(roomCents)}
              </span>
              <span className={`rounded-full px-2.5 py-1 font-medium ${FIT_TONE[fit]}`}>
                {t(`goals.fit.${fit}` as MessageKey)}
              </span>
            </p>
            <div className="mt-3 flex gap-4 text-sm font-semibold">
              <button
                type="button"
                onClick={() =>
                  setEditing({
                    id: goal.id,
                    name: goal.name,
                    euros: String(goal.targetCents / 100),
                    months: String(goal.months),
                  })
                }
                className="text-accent"
              >
                {t("common.edit")}
              </button>
              <button type="button" onClick={() => void remove(goal.id)} className="text-muted">
                {t("common.moveToBin")}
              </button>
            </div>
          </article>
        ))}
        <Link
          href={askLink("chat.suggest.goal")}
          className="rounded-full bg-primary px-5 py-3 text-center text-sm font-semibold text-on-primary"
        >
          {t("goals.tell")}
        </Link>
        <button
          type="button"
          onClick={() => setEditing({ name: "", euros: "", months: "" })}
          className="rounded-full border border-border px-5 py-3 text-center text-sm font-semibold"
        >
          {t("goals.add")}
        </button>
        <Link href="/trash" className="text-center text-sm font-medium text-accent">
          {t("trash.open")}
        </Link>
      </section>

      <GoalWizard
        draft={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          toast.notify("toast.saved");
          setTick((value) => value + 1);
        }}
      />

      {data && data.recommendations.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">{t("advice.title")}</h2>
          <ul className="flex flex-col gap-2">
            {data.recommendations.map((item) => (
              <li key={item.id} className="rounded-2xl border border-border bg-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-sm font-semibold">{item.title}</h3>
                  {item.monthlyValueCents > 0 ? (
                    <span className="shrink-0 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent tabular-nums">
                      +{money(item.monthlyValueCents)}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-muted">{item.body}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {rewards ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">{t("rewards.title")}</h2>
          <div className="rounded-2xl bg-brand p-5 text-on-brand">
            <p className="text-sm opacity-80">
              {t(`rewards.level.${rewards.level}` as MessageKey)}
            </p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">
              {t("rewards.points", { points: rewards.points })}
            </p>
            {rewards.nextLevelAt !== null ? (
              <>
                <div
                  className="mt-3 h-2 overflow-hidden rounded-full bg-white/20"
                  aria-hidden="true"
                >
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{
                      width: `${Math.round((rewards.points / rewards.nextLevelAt) * 100)}%`,
                    }}
                  />
                </div>
                <p className="mt-2 text-xs opacity-80">
                  {t("rewards.next", { points: rewards.nextLevelAt - rewards.points })}
                </p>
              </>
            ) : null}
          </div>

          <ul className="flex flex-col gap-2">
            {rewards.achievements.map((item) => (
              <li
                key={item.id}
                className={`flex items-start justify-between gap-3 rounded-2xl border p-4 ${
                  item.earned
                    ? "border-accent bg-accent-soft"
                    : "border-border bg-surface opacity-70"
                }`}
              >
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold">{item.title}</h3>
                  <p className="mt-0.5 text-sm text-muted">{item.body}</p>
                </div>
                <span className="shrink-0 text-right text-xs font-semibold">
                  <span className="block tabular-nums">+{item.points}</span>
                  <span className={item.earned ? "text-accent" : "text-muted"}>
                    {t(item.earned ? "rewards.earned" : "rewards.notYet")}
                  </span>
                </span>
              </li>
            ))}
          </ul>

          <h3 className="text-sm font-semibold">{t("rewards.coupons")}</h3>
          <ul className="flex flex-col gap-2">
            {rewards.coupons.map((coupon) => (
              <li
                key={coupon.id}
                className={`rounded-2xl border border-dashed p-4 ${
                  coupon.unlocked
                    ? "border-accent bg-surface"
                    : "border-border bg-surface opacity-60"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <h4 className="text-sm font-semibold">{coupon.title}</h4>
                  <span
                    className={`shrink-0 text-xs font-semibold ${coupon.unlocked ? "text-accent" : "text-muted"}`}
                  >
                    {coupon.unlocked
                      ? t("rewards.unlocked")
                      : t("rewards.locked", { points: coupon.unlockAt })}
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-muted">{coupon.body}</p>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted">{t("rewards.note")}</p>
        </section>
      ) : null}
    </div>
  );
}
