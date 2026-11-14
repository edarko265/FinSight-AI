"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { PlansView } from "@/components/plans/PlansView";
import { VoucherLadder } from "@/components/goals/VoucherLadder";
import { GoalWizard, type GoalDraft } from "@/components/goals/GoalWizard";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import { useOverview } from "@/components/providers/OverviewProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { LoadError } from "@/components/ui/LoadError";
import { LoadingRegion, SkeletonCard } from "@/components/ui/Skeleton";
import { Spinner } from "@/components/ui/Spinner";
import { useAsyncAction } from "@/components/ui/useAsyncAction";
import { Suggestions, Wizard, WizardField, WizardReview } from "@/components/ui/Wizard";
import { api, ApiError } from "@/lib/api-client";
import { isApiError } from "@/lib/async-action";
import type { VoucherLadder as VoucherLadderData } from "@/lib/contracts/rewards";
import { formatDay, formatMoney } from "@/lib/i18n/config";
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

type IconName =
  "plus" | "edit" | "trash" | "clock" | "chat" | "coin" | "trophy" | "check" | "bulb" | "chevron";

const ICON_PATHS: Record<IconName, string> = {
  plus: "M12 5v14M5 12h14",
  edit: "M4 20h4L19 9l-4-4L4 16v4zM13 7l4 4",
  trash: "M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13",
  clock: "M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z",
  chat: "M4 5h16v11H9l-5 4V5z",
  coin: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v10M9.5 9.5C9.5 8.7 10.6 8 12 8s2.5.7 2.5 1.5S13.4 11 12 11s-2.5.7-2.5 1.5S10.6 14 12 14s2.5-.7 2.5-1.5",
  trophy: "M8 4h8v6a4 4 0 0 1-8 0V4zM8 6H4v1a3 3 0 0 0 4 3M16 6h4v1a3 3 0 0 1-4 3M12 14v4M8 20h8",
  check: "M5 12l5 5 9-10",
  bulb: "M9 18h6M10 21h4M12 3a6 6 0 0 0-3 11v2h6v-2a6 6 0 0 0-3-11z",
  chevron: "M9 6l6 6-6 6",
};

function Icon({
  name,
  className = "size-6",
}: {
  name: IconName;
  className?: string;
}): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}

/** Round icon-only action; the label is for assistive tech and the hover tooltip. */
function IconButton({
  icon,
  label,
  onClick,
  tone = "bg-background text-accent",
  disabled,
  size = "size-12",
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
  tone?: string;
  disabled?: boolean;
  size?: string;
}): React.JSX.Element {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-disabled={disabled}
      onClick={onClick}
      className={`flex ${size} items-center justify-center rounded-full aria-disabled:opacity-60 ${tone}`}
    >
      <Icon name={icon} />
    </button>
  );
}

/** A circular progress gauge with the percentage in the middle. */
function ProgressRing({
  percent,
  label,
  behind,
}: {
  percent: number;
  label: string;
  behind: boolean;
}): React.JSX.Element {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const shown = Math.min(100, percent);
  return (
    <div
      className="relative size-[4.5rem] shrink-0"
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={shown}
    >
      <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden="true">
        <circle cx="50" cy="50" r={radius} fill="none" strokeWidth="10" className="stroke-border" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          className={behind ? "stroke-warning" : "stroke-accent"}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - shown / 100)}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-lg font-semibold tabular-nums">
        {percent}
        <span className="text-xs">%</span>
      </span>
    </div>
  );
}

/** One goal with its progress. Owns the hook for its own "move to bin" action. */
function GoalCard({
  plan: { goal, fit, savedCents, percent, monthsLeft, pace, setAsides },
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
    <article className="rounded-3xl border border-border bg-surface p-4">
      <div className="flex items-center gap-4">
        <ProgressRing percent={percent} label={t("goals.progress")} behind={pace === "behind"} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold leading-tight">{goal.name}</h3>
          <p className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5 tabular-nums">
            <span className="text-2xl font-semibold">{money(savedCents)}</span>
            <span className="text-muted">/ {money(goal.targetCents)}</span>
          </p>
        </div>
        <IconButton
          icon="plus"
          label={t("goals.aside.cta")}
          onClick={onAside}
          tone="bg-accent text-on-primary"
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm font-semibold">
        <span
          className={`rounded-full px-3 py-1.5 ${
            pace === "behind" || fit === "hard"
              ? "bg-warning-soft text-warning"
              : "bg-accent-soft text-accent"
          }`}
          title={t(`goals.fit.${fit}` as MessageKey)}
        >
          {percent >= 100 ? t("goals.reached") : t(`goals.pace.${pace}` as MessageKey)}
        </span>
        {percent < 100 ? (
          <span className="flex items-center gap-1.5 rounded-full bg-background px-3 py-1.5 tabular-nums text-muted">
            <Icon name="clock" className="size-4" />
            {t("goals.monthsShort", { months: monthsLeft })}
          </span>
        ) : null}
        <div className="ml-auto flex gap-1">
          <IconButton icon="edit" label={t("common.edit")} onClick={onEdit} size="size-11" />
          <IconButton
            icon="trash"
            label={t("common.moveToBin")}
            onClick={() => void removeGoal()}
            tone="bg-background text-muted"
            disabled={removing}
            size="size-11"
          />
        </div>
      </div>
      {setAsides.length > 0 ? (
        <details className="mt-1">
          <summary
            className="flex min-h-11 cursor-pointer items-center gap-2 font-semibold text-accent"
            aria-label={t("goals.aside.history", { count: setAsides.length })}
          >
            <Icon name="coin" className="size-5" />
            <span className="tabular-nums">{setAsides.length}</span>
            <Icon name="chevron" className="size-4" />
          </summary>
          <ul className="flex flex-col divide-y divide-border">
            {setAsides.map((item) => (
              <SetAsideRow key={item.id} item={item} money={money} onChanged={onChanged} />
            ))}
          </ul>
        </details>
      ) : null}
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
      <IconButton
        icon="trash"
        label={t("common.moveToBin")}
        tone="bg-transparent text-muted"
        disabled={pending}
        onClick={() => {
          void run().then((result) => {
            if (result.ok) onChanged();
          });
        }}
      />
    </li>
  );
}

/** Goals set in conversation with the coach, what would help most, and rewards for real progress. */
export function GoalsView(): React.JSX.Element {
  const { t, locale } = usePreferences();
  const { overview } = useOverview();
  const asOf = overview?.asOf ?? "";
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
  const [saving, setSaving] = useState<{ id: string; name: string; from: string } | null>(null);
  const [when, setWhen] = useState("");
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
  // Money recorded as set aside earlier is a fact about the past: only today's is tested.
  const withinSafe = amountValid && (when !== "" || Math.round(amount * 100) <= safe);

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

      <section className="flex flex-col gap-4">
        <h2 className="sr-only">{t("goals.yours")}</h2>
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
        {data && data.goals.length > 0 ? (
          <div
            className="flex items-center gap-4 rounded-3xl bg-accent-soft p-5 text-accent"
            title={t(safe > 0 ? "goals.aside.safe" : "goals.aside.none", { amount: money(safe) })}
          >
            <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-accent text-on-primary">
              <Icon name="coin" className="size-8" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{t("goals.safeShort")}</span>
              <span className="block text-3xl font-semibold tabular-nums">{money(safe)}</span>
            </span>
            <span className="sr-only">
              {t(safe > 0 ? "goals.aside.safe" : "goals.aside.none", { amount: money(safe) })}
            </span>
            {data.setAsideCents > 0 ? (
              <span className="ml-auto text-right">
                <span className="block text-sm font-semibold opacity-80">
                  {t("goals.savedShort")}
                </span>
                <span className="block text-xl font-semibold tabular-nums">
                  {money(data.setAsideCents)}
                </span>
                <span className="sr-only">
                  {t("goals.aside.total", { amount: money(data.setAsideCents) })}
                </span>
              </span>
            ) : null}
          </div>
        ) : null}
        {data?.goals.map((plan) => (
          <GoalCard
            key={plan.goal.id}
            plan={plan}
            money={money}
            onAside={() => {
              setEuros("");
              setSaveError(null);
              setSaving({ id: plan.goal.id, name: plan.goal.name, from: plan.goal.createdOn });
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
        {data && data.goals.length === 0 ? <p className="sr-only">{t("goals.empty")}</p> : null}
        <div className="flex gap-3">
          <button
            type="button"
            title={t("goals.add")}
            aria-label={t("goals.add")}
            onClick={() => setEditing({ name: "", euros: "", months: "" })}
            className="flex min-h-16 flex-1 items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-border px-3 text-center text-sm font-semibold text-accent"
          >
            <Icon name="plus" className="size-6 shrink-0" />
            {t("goals.add")}
          </button>
          <Link
            href={askLink("chat.suggest.goal")}
            title={t("goals.tell")}
            aria-label={t("goals.tell")}
            className="flex min-h-16 flex-1 items-center justify-center gap-2 rounded-3xl bg-primary px-3 text-center text-sm font-semibold text-on-primary"
          >
            <Icon name="chat" className="size-6 shrink-0" />
            {t("goals.tell")}
          </Link>
        </div>
      </section>

      {rewards ? (
        <section className="flex flex-col gap-4">
          <h2 className="sr-only">{t("rewards.title")}</h2>
          <div
            className="rounded-3xl bg-brand p-5 text-on-brand"
            title={t(`rewards.level.${rewards.level}` as MessageKey)}
          >
            <div className="flex items-center gap-3">
              <Icon name="trophy" className="size-9" />
              <span>
                <span className="block text-sm font-semibold opacity-80">
                  {t(`rewards.level.${rewards.level}` as MessageKey)}
                </span>
                <span className="block text-3xl font-semibold tabular-nums">
                  {t("rewards.points", { points: rewards.points })}
                </span>
              </span>
              <span className="sr-only">
                {t(`rewards.level.${rewards.level}` as MessageKey)},{" "}
                {t("rewards.points", { points: rewards.points })}
              </span>
            </div>
            {rewards.nextLevelAt !== null ? (
              <div
                className="mt-4 h-3 overflow-hidden rounded-full bg-white/20"
                role="meter"
                aria-label={t("rewards.next", { points: rewards.nextLevelAt - rewards.points })}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round((rewards.points / rewards.nextLevelAt) * 100)}
              >
                <div
                  className="h-full rounded-full bg-primary"
                  style={{
                    width: `${Math.min(100, Math.round((rewards.points / rewards.nextLevelAt) * 100))}%`,
                  }}
                />
              </div>
            ) : null}
          </div>

          <ul className="grid grid-cols-2 gap-2">
            {rewards.achievements.map((item) => (
              <li
                key={item.id}
                title={item.body}
                className={`flex items-center gap-3 rounded-2xl p-3 ${
                  item.earned ? "bg-accent text-on-primary" : "bg-surface text-muted opacity-70"
                }`}
              >
                <Icon name={item.earned ? "trophy" : "check"} className="size-7 shrink-0" />
                <span className="min-w-0 text-sm font-semibold leading-tight">
                  <span className="line-clamp-2">{item.title}</span>
                  <span className="tabular-nums opacity-80">+{item.points}</span>
                </span>
                <span className="sr-only">
                  {t(item.earned ? "rewards.earned" : "rewards.notYet")}
                </span>
              </li>
            ))}
          </ul>

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
        </section>
      ) : null}
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
          <h2 className="sr-only">{t("advice.title")}</h2>
          <ul className="flex flex-col gap-2">
            {data.recommendations.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4"
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                  <Icon name="bulb" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold">{item.title}</h3>
                  <p className="line-clamp-2 text-sm text-muted">{item.body}</p>
                </div>
                {item.monthlyValueCents > 0 ? (
                  <span className="shrink-0 rounded-full bg-accent-soft px-3 py-1.5 font-semibold text-accent tabular-nums">
                    +{money(item.monthlyValueCents)}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <PlansView />

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
