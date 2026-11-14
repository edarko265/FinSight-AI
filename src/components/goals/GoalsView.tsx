"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { VoucherLadder } from "@/components/goals/VoucherLadder";
import { GoalWizard, type GoalDraft } from "@/components/goals/GoalWizard";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { LoadError } from "@/components/ui/LoadError";
import { LoadingRegion, SkeletonCard } from "@/components/ui/Skeleton";
import { PendingLabel, Spinner } from "@/components/ui/Spinner";
import { useAsyncAction } from "@/components/ui/useAsyncAction";
import { Suggestions, Wizard, WizardField, WizardReview } from "@/components/ui/Wizard";
import { api, ApiError } from "@/lib/api-client";
import { isApiError } from "@/lib/async-action";
import type { VoucherLadder as VoucherLadderData } from "@/lib/contracts/rewards";
import { formatDay, formatMoney } from "@/lib/i18n/config";
import type { MessageKey } from "@/lib/i18n/translate";
import { InfoTip } from "@/components/ui/InfoTip";

interface GoalPlan {
  goal: { id: string; name: string; targetCents: number; months: number; monthlyCents: number };
  roomCents: number;
  fromCutsCents: number;
  fit: "fits" | "stretch" | "hard";
  savedCents: number;
  percent: number;
  monthsLeft: number;
  pace: "ahead" | "on_track" | "behind";
  setAsides: { id: string; cents: number; date: string }[];
}

interface Rewards {
  points: number;
  level: "starter" | "bronze" | "silver" | "gold";
  nextLevelAt: number | null;
  achievements: { id: string; title: string; body: string; points: number; earned: boolean }[];
  vouchers: VoucherLadderData;
}

interface GoalsPayload {
  goals: GoalPlan[];
  rewards: Rewards | null;
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

/** One goal with its progress. Owns the hook for its own "move to bin" action. */
function GoalCard({
  plan: { goal, fit, roomCents, savedCents, percent, monthsLeft, pace, setAsides },
  money,
  onAside,
  onEdit,
  onChanged,
}: {
  plan: GoalPlan;
  money: (cents: number) => string;
  onAside: () => void;
  onEdit: () => void;
  onChanged: () => void;
}): React.JSX.Element {
  const { t } = usePreferences();
  const { run, pending: removing } = useAsyncAction(
    () => api("/api/goals", { method: "DELETE", json: { id: goal.id } }),
    { successKey: "toast.movedToBin" },
  );

  async function removeGoal(): Promise<void> {
    const result = await run();
    if (result.ok) onChanged();
  }

  return (
    <article className="rounded-2xl border border-border bg-surface p-4">
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
      <p className="mt-2 flex items-center justify-between gap-2 text-sm text-muted">
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
        <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
          <span
            className={`rounded-full px-2.5 py-1 font-medium ${
              pace === "behind" ? "bg-warning-soft text-warning" : "bg-accent-soft text-accent"
            }`}
          >
            {t(`goals.pace.${pace}` as MessageKey)}
          </span>
          {percent >= 100 ? t("goals.reached") : t("goals.monthsLeft", { months: monthsLeft })}
        </p>
        {setAsides.length > 0 ? (
          <details className="mt-2">
            <summary className="cursor-pointer text-xs font-semibold text-accent">
              {t("goals.aside.history", { count: setAsides.length })}
            </summary>
            <ul className="mt-2 flex flex-col divide-y divide-border text-sm">
              {setAsides.map((item) => (
                <SetAsideRow key={item.id} item={item} money={money} onChanged={onChanged} />
              ))}
            </ul>
          </details>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm font-semibold">
        <button type="button" onClick={onAside} className="min-h-11 text-accent">
          {t("goals.aside.cta")}
        </button>
        <button type="button" onClick={onEdit} className="min-h-11 text-accent">
          {t("common.edit")}
        </button>
        <button
          type="button"
          aria-disabled={removing}
          onClick={() => void removeGoal()}
          className="min-h-11 text-muted aria-disabled:opacity-60"
        >
          {removing ? <PendingLabel>{t("common.removing")}</PendingLabel> : t("common.moveToBin")}
        </button>
      </div>
    </article>
  );
}

/** One set-aside in a goal's history, with its own "move to bin" action. */
function SetAsideRow({
  item,
  money,
  onChanged,
}: {
  item: { id: string; cents: number; date: string };
  money: (cents: number) => string;
  onChanged: () => void;
}): React.JSX.Element {
  const { t, locale } = usePreferences();
  const { run, pending } = useAsyncAction(
    () => api("/api/goals/set-aside", { method: "DELETE", json: { id: item.id } }),
    { successKey: "toast.movedToBin" },
  );

  return (
    <li className="flex items-center justify-between gap-3 py-1.5">
      <span className="tabular-nums">
        {money(item.cents)}
        <span className="text-muted"> · {formatDay(item.date, locale)}</span>
      </span>
      <button
        type="button"
        aria-disabled={pending}
        className="min-h-11 text-xs font-semibold text-muted aria-disabled:opacity-60"
        onClick={() => {
          void run().then((result) => {
            if (result.ok) onChanged();
          });
        }}
      >
        {pending ? <PendingLabel>{t("common.removing")}</PendingLabel> : t("common.moveToBin")}
      </button>
    </li>
  );
}

/** Goals set in conversation with the coach, what would help most, and rewards for real progress. */
export function GoalsView(): React.JSX.Element {
  const { t, locale } = usePreferences();
  const toast = useToast();
  // Tagged with the locale it was loaded for: a language change resets, a failed reload keeps it.
  const [loaded, setLoaded] = useState<{ locale: string; payload: GoalsPayload } | null>(null);
  const [failedLocale, setFailedLocale] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [tick, setTick] = useState(0);
  const retried = useRef(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const data = loaded?.locale === locale ? loaded.payload : null;
  const loadFailed = failedLocale === locale;
  const [editing, setEditing] = useState<GoalDraft | null>(null);
  const [saving, setSaving] = useState<{ id: string; name: string } | null>(null);
  const [euros, setEuros] = useState("");
  const [saveError, setSaveError] = useState<MessageKey | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<GoalsPayload>(`/api/goals?locale=${locale}`)
      .then((payload) => {
        if (cancelled) return;
        setLoaded({ locale, payload });
        setFailedLocale(null);
      })
      .catch(() => {
        if (!cancelled) setFailedLocale(locale);
      })
      .finally(() => {
        if (!cancelled) setRetrying(false);
      });
    return () => {
      cancelled = true;
    };
  }, [locale, tick]);

  function retry(): void {
    retried.current = true;
    setRetrying(true);
    setFailedLocale(null);
    setTick((value) => value + 1);
  }

  // The retry button is gone once the goals load, so move focus to the content.
  useEffect(() => {
    if (retried.current && data && !loadFailed) {
      retried.current = false;
      contentRef.current?.focus();
    }
  }, [data, loadFailed]);

  const reload = (): void => setTick((value) => value + 1);

  const safe = data?.safeToSave ?? 0;
  const amount = Number(euros.replace(",", "."));
  const amountValid = euros.trim() !== "" && Number.isFinite(amount) && amount >= 1;
  const withinSafe = amountValid && Math.round(amount * 100) <= safe;

  const { run: runSetAside } = useAsyncAction(
    (goalId: string, cents: number) =>
      api("/api/goals/set-aside", { method: "POST", json: { goalId, cents } }),
    { successKey: "toast.saved", errorKey: () => null },
  );

  async function confirmSetAside(): Promise<boolean> {
    if (!saving) return false;
    setSaveError(null);
    const result = await runSetAside(saving.id, Math.round(amount * 100));
    if (!result.ok) {
      // Shown inside the wizard instead of as a toast; a 401 is handled by the api client.
      if (!result.dropped && !isApiError(result.error, 401)) {
        setSaveError(
          result.error instanceof ApiError && result.error.code === "above_safe"
            ? "goals.aside.aboveSafe"
            : "toast.error",
        );
      }
      return false;
    }
    setSaving(null);
    setEuros("");
    reload();
    return true;
  }

  const rewards = data?.rewards;
  const money = (cents: number): string => formatMoney(cents, locale);
  const askLink = (question: MessageKey): string => `/chat?q=${encodeURIComponent(t(question))}`;

  return (
    <div ref={contentRef} tabIndex={-1} className="flex flex-col gap-5 px-4 py-4 outline-none">
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
        {loadFailed ? <LoadError onRetry={retry} /> : null}
        {retrying && data ? (
          <LoadingRegion
            labelKey="common.refreshing"
            className="flex items-center gap-2 text-sm text-muted"
          >
            <Spinner />
            <span aria-hidden="true">{t("common.refreshing")}</span>
          </LoadingRegion>
        ) : null}
        {!data && !loadFailed ? (
          <LoadingRegion className="flex flex-col gap-3">
            <SkeletonCard />
            <SkeletonCard />
          </LoadingRegion>
        ) : null}
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
        {data?.goals.map((plan) => (
          <GoalCard
            key={plan.goal.id}
            plan={plan}
            money={money}
            onAside={() => {
              setEuros("");
              setSaveError(null);
              setSaving({ id: plan.goal.id, name: plan.goal.name });
            }}
            onEdit={() =>
              setEditing({
                id: plan.goal.id,
                name: plan.goal.name,
                euros: String(plan.goal.targetCents / 100),
                months: String(plan.goal.months),
              })
            }
            onChanged={reload}
          />
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
                <p className="mt-2 text-sm opacity-80">
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

          <h3 className="text-sm font-semibold">{t("voucher.title")}</h3>
          <VoucherLadder
            onStale={() => setTick((value) => value + 1)}
            ladder={rewards.vouchers}
            onChange={(vouchers) =>
              setLoaded((current) =>
                current?.payload.rewards
                  ? {
                      ...current,
                      payload: {
                        ...current.payload,
                        rewards: { ...current.payload.rewards, vouchers },
                      },
                    }
                  : current,
              )
            }
          />
          <InfoTip>{t("rewards.note")}</InfoTip>
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
