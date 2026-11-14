"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { GoalWizard, type GoalDraft } from "@/components/goals/GoalWizard";
import { useOverview } from "@/components/providers/OverviewProvider";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { Suggestions, Wizard, WizardField, WizardReview } from "@/components/ui/Wizard";
import { api, ApiError } from "@/lib/api-client";
import { formatDay, formatMoney, formatMonth } from "@/lib/i18n/config";
import type { MessageKey } from "@/lib/i18n/translate";

interface GoalPlan {
  goal: {
    id: string;
    name: string;
    targetCents: number;
    months: number;
    monthlyCents: number;
    createdOn: string;
  };
  roomCents: number;
  fromCutsCents: number;
  fit: "fits" | "stretch" | "hard";
  savedCents: number;
  percent: number;
  monthsLeft: number;
  pace: "ahead" | "on_track" | "behind";
  setAsides: { id: string; cents: number; date: string }[];
  curve: { month: string; plannedCents: number; savedCents: number }[];
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
  /** What could be set aside now while the next month stays covered. */
  safeToSave: number;
  setAsideCents: number;
}

const FIT_TONE = {
  fits: "bg-accent-soft text-accent",
  stretch: "bg-accent-soft text-accent",
  hard: "bg-warning-soft text-warning",
} as const;

/**
 * Progress month by month: what the plan expected (dashed) against what was
 * actually set aside (solid). The numbers are in the list beside it.
 */
function GoalCurve({
  curve,
  target,
}: {
  curve: { month: string; plannedCents: number; savedCents: number }[];
  target: number;
}): React.JSX.Element {
  const { t, locale } = usePreferences();
  const width = 300;
  const height = 110;
  const top = Math.max(target, 1);
  const x = (index: number): number => 6 + (index / (curve.length - 1)) * (width - 12);
  const y = (cents: number): number => height - 18 - (Math.min(cents, top) / top) * (height - 30);
  const line = (key: "plannedCents" | "savedCents"): string =>
    curve.map((point, index) => `${index === 0 ? "M" : "L"}${x(index)},${y(point[key])}`).join(" ");
  const last = curve.at(-1);
  return (
    <figure className="mt-3">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label={t("goals.curve")}
      >
        <line
          x1={6}
          x2={width - 6}
          y1={y(target)}
          y2={y(target)}
          stroke="var(--border)"
          strokeDasharray="2 4"
        />
        <path
          d={line("plannedCents")}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={1.5}
          strokeDasharray="5 4"
        />
        <path d={line("savedCents")} fill="none" stroke="var(--chart-1)" strokeWidth={2.5} />
        {curve.map((point, index) => (
          <circle
            key={point.month}
            cx={x(index)}
            cy={y(point.savedCents)}
            r={3}
            fill="var(--chart-1)"
          >
            <title>{`${formatMonth(point.month, locale)}: ${formatMoney(point.savedCents, locale)}`}</title>
          </circle>
        ))}
        <text x={6} y={height - 3} fontSize={10} fill="var(--muted)">
          {formatMonth(curve[0]?.month ?? "", locale)}
        </text>
        <text x={width - 6} y={height - 3} fontSize={10} fill="var(--muted)" textAnchor="end">
          {formatMonth(last?.month ?? "", locale)}
        </text>
      </svg>
      <figcaption className="mt-1 text-xs text-muted">
        {t("goals.curve.caption", {
          saved: formatMoney(last?.savedCents ?? 0, locale),
          planned: formatMoney(last?.plannedCents ?? 0, locale),
        })}
      </figcaption>
    </figure>
  );
}

/** Goals set in conversation with the coach, what would help most, and rewards for real progress. */
export function GoalsView(): React.JSX.Element {
  const { t, locale } = usePreferences();
  const toast = useToast();
  const { overview } = useOverview();
  const asOf = overview?.asOf ?? "";
  const [data, setData] = useState<GoalsPayload | null>(null);
  const [tick, setTick] = useState(0);
  const [editing, setEditing] = useState<GoalDraft | null>(null);
  const [saving, setSaving] = useState<{ id: string; name: string; from: string } | null>(null);
  const [when, setWhen] = useState("");
  const [euros, setEuros] = useState("");
  const [saveError, setSaveError] = useState<MessageKey | null>(null);
  const [redeemed, setRedeemed] = useState<Record<string, string>>({});

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

  async function undoSetAside(id: string): Promise<void> {
    try {
      await api("/api/goals/set-aside", { method: "DELETE", json: { id } });
    } catch {
      toast.fail();
      return;
    }
    toast.notify("toast.movedToBin");
    setTick((value) => value + 1);
  }

  const safe = data?.safeToSave ?? 0;
  const amount = Number(euros.replace(",", "."));
  const amountValid = euros.trim() !== "" && Number.isFinite(amount) && amount >= 1;
  // Money recorded as set aside earlier is a fact about the past: only today's is tested.
  const withinSafe = amountValid && (when !== "" || Math.round(amount * 100) <= safe);

  async function confirmSetAside(): Promise<boolean> {
    if (!saving) return false;
    setSaveError(null);
    try {
      await api("/api/goals/set-aside", {
        method: "POST",
        json: { goalId: saving.id, cents: Math.round(amount * 100), date: when || undefined },
      });
    } catch (failure) {
      setSaveError(
        failure instanceof ApiError && failure.code === "above_safe"
          ? "goals.aside.aboveSafe"
          : "toast.error",
      );
      return false;
    }
    toast.notify("toast.saved");
    setSaving(null);
    setEuros("");
    setTick((value) => value + 1);
    return true;
  }

  // Rewards already redeemed this month, with the codes they gave.
  useEffect(() => {
    let cancelled = false;
    api<{ redemptions: { couponId: string; code: string; month: string }[] }>("/api/rewards")
      .then((payload) => {
        if (cancelled) return;
        const latest = payload.redemptions[0]?.month;
        setRedeemed(
          Object.fromEntries(
            payload.redemptions
              .filter((item) => item.month === latest)
              .map((item) => [item.couponId, item.code]),
          ),
        );
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [tick]);

  async function redeem(couponId: string): Promise<void> {
    try {
      const { redemption } = await api<{ redemption: { code: string } }>("/api/rewards", {
        method: "POST",
        json: { couponId },
      });
      setRedeemed((current) => ({ ...current, [couponId]: redemption.code }));
      toast.notify("toast.redeemed");
    } catch (failure) {
      if (failure instanceof ApiError && failure.code === "already") setTick((value) => value + 1);
      else toast.fail();
    }
  }

  const rewards = data?.rewards;
  const money = (cents: number): string => formatMoney(cents, locale);
  const askLink = (question: MessageKey): string => `/chat?q=${encodeURIComponent(t(question))}`;

  return (
    <div className="flex flex-col gap-5 px-4 py-4">
      <h1 className="text-xl font-semibold">{t("goals.title")}</h1>

      <Link
        href="/plans"
        className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-accent-soft px-4 py-3 text-sm"
      >
        <span>
          <span className="block font-semibold">{t("plans.title")}</span>
          <span className="block text-muted">{t("goals.plansLink")}</span>
        </span>
        <span className="shrink-0 font-semibold text-accent" aria-hidden="true">
          →
        </span>
      </Link>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">{t("goals.yours")}</h2>
        {data ? (
          <p className="rounded-2xl border border-border bg-surface px-4 py-3 text-sm">
            {t(safe > 0 ? "goals.aside.safe" : "goals.aside.none", { amount: money(safe) })}
            {data.setAsideCents > 0 ? (
              <span className="block text-muted">
                {t("goals.aside.total", { amount: money(data.setAsideCents) })}
              </span>
            ) : null}
          </p>
        ) : null}
        {data && data.goals.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted">
            {t("goals.empty")}
          </p>
        ) : null}
        {data?.goals.map(
          ({ goal, fit, roomCents, savedCents, percent, monthsLeft, pace, setAsides, curve }) => (
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
              <div className="mt-4 rounded-xl bg-background p-3">
                <p className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-semibold">{t("goals.progress")}</span>
                  <span className="tabular-nums">
                    {money(savedCents)} / {money(goal.targetCents)} · {percent} %
                  </span>
                </p>
                <div
                  className="mt-2 h-3 overflow-hidden rounded-full bg-border"
                  role="meter"
                  aria-label={t("goals.progress")}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={percent}
                >
                  <div
                    className="fs-grow-x h-full rounded-full bg-accent"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                  <span
                    className={`rounded-full px-2.5 py-1 font-medium ${
                      pace === "behind"
                        ? "bg-warning-soft text-warning"
                        : "bg-accent-soft text-accent"
                    }`}
                  >
                    {t(`goals.pace.${pace}` as MessageKey)}
                  </span>
                  {percent >= 100
                    ? t("goals.reached")
                    : t("goals.monthsLeft", { months: monthsLeft })}
                </p>
                {curve.length >= 2 ? <GoalCurve curve={curve} target={goal.targetCents} /> : null}
                {setAsides.length > 0 ? (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs font-semibold text-accent">
                      {t("goals.aside.history", { count: setAsides.length })}
                    </summary>
                    <ul className="mt-2 flex flex-col divide-y divide-border text-sm">
                      {setAsides.map((item) => (
                        <li
                          key={item.id}
                          className="flex items-center justify-between gap-3 py-1.5"
                        >
                          <span className="tabular-nums">
                            {money(item.cents)}
                            <span className="text-muted"> · {formatDay(item.date, locale)}</span>
                          </span>
                          <button
                            type="button"
                            className="text-xs font-semibold text-muted"
                            onClick={() => void undoSetAside(item.id)}
                          >
                            {t("common.moveToBin")}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm font-semibold">
                <button
                  type="button"
                  onClick={() => {
                    setEuros("");
                    setSaveError(null);
                    setWhen("");
                    setSaving({ id: goal.id, name: goal.name, from: goal.createdOn });
                  }}
                  className="text-accent"
                >
                  {t("goals.aside.cta")}
                </button>
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
          ),
        )}
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
                {redeemed[coupon.id] ? (
                  <p className="mt-2 rounded-xl bg-accent-soft px-3 py-2 text-sm">
                    {t("rewards.code")}{" "}
                    <span className="font-mono font-semibold tracking-widest">
                      {redeemed[coupon.id]}
                    </span>
                    <span className="block text-xs text-muted">{t("rewards.simulated")}</span>
                  </p>
                ) : coupon.unlocked ? (
                  <button
                    type="button"
                    onClick={() => void redeem(coupon.id)}
                    className="mt-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary"
                  >
                    {t("rewards.redeem")}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted">{t("rewards.note")}</p>
        </section>
      ) : null}
      <Wizard
        open={saving !== null}
        title={t("goals.aside.title", { goal: saving?.name ?? "" })}
        finishLabel={t("goals.aside.confirm")}
        error={saveError ? t(saveError) : null}
        onClose={() => setSaving(null)}
        onFinish={confirmSetAside}
        steps={[
          {
            title: t("goals.aside.step"),
            hint: t("goals.aside.stepHint", { amount: money(safe) }),
            valid: withinSafe,
            content: (
              <>
                <WizardField
                  label={t("goals.aside.amount")}
                  value={euros}
                  onChange={(event) => setEuros(event.target.value)}
                  inputMode="decimal"
                  placeholder={String(Math.floor(safe / 200))}
                  autoFocus
                />
                {safe >= 400 ? (
                  <Suggestions
                    label={t("wizard.suggestions")}
                    options={[0.25, 0.5, 1].map((share) => {
                      const whole = Math.floor((safe * share) / 100);
                      return { label: money(whole * 100), value: String(whole) };
                    })}
                    onPick={setEuros}
                  />
                ) : null}
                <label className="flex flex-col gap-1.5 text-sm font-medium">
                  {t("goals.aside.date")}
                  <input
                    type="date"
                    value={when}
                    min={saving?.from}
                    max={asOf}
                    onChange={(event) =>
                      setWhen(event.target.value === asOf ? "" : event.target.value)
                    }
                    className="rounded-xl border border-border bg-surface px-4 py-3 text-base font-normal"
                  />
                  <span className="text-xs font-normal text-muted">
                    {t("goals.aside.dateHint")}
                  </span>
                </label>
                {amountValid && !withinSafe ? (
                  <p className="rounded-xl bg-warning-soft px-3 py-2 text-sm text-warning">
                    {t("goals.aside.aboveSafe")}
                  </p>
                ) : null}
              </>
            ),
          },
          {
            title: t("wizard.review"),
            hint: t("goals.aside.reviewHint"),
            valid: withinSafe,
            content: (
              <WizardReview
                rows={[
                  { label: t("goals.aside.for"), value: saving?.name ?? "" },
                  {
                    label: t("goals.aside.amount"),
                    value: money(Math.round((amountValid ? amount : 0) * 100)),
                  },
                  {
                    label: t("goals.aside.left"),
                    value: money(Math.max(0, safe - Math.round((amountValid ? amount : 0) * 100))),
                  },
                ]}
              />
            ),
          },
        ]}
      />
    </div>
  );
}
