"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { BudgetsSection } from "@/components/plans/BudgetsSection";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import { useToast } from "@/components/providers/ToastProvider";
import {
  Suggestions,
  Wizard,
  WizardChoices,
  WizardField,
  WizardReview,
} from "@/components/ui/Wizard";
import { api, ApiError } from "@/lib/api-client";
import { formatMoney } from "@/lib/i18n/config";
import type { MessageKey } from "@/lib/i18n/translate";

const SLICES = ["bills", "essentials", "everyday", "saving", "investing"] as const;
type SliceKey = (typeof SLICES)[number];
type Split = Record<SliceKey, number>;
const COLOURS: Record<SliceKey, string> = {
  bills: "var(--chart-2)",
  essentials: "var(--chart-3)",
  everyday: "var(--chart-4)",
  saving: "var(--chart-1)",
  investing: "var(--chart-5)",
};

interface Plan {
  id: string;
  name: string;
  split: Split;
  goals: { label: string; percent: number }[];
  origin: "own" | "template" | "copied";
  shareCode?: string;
  shareListed?: boolean;
  tracked?: boolean;
  forMe: Split;
}

interface PublicPlan {
  code: string;
  name: string;
  split: Split;
  goals: { label: string; percent: number }[];
  copies: number;
  mine?: boolean;
}

interface Payload {
  sharing: boolean;
  actual: { incomeCents: number; cents: Split; percent: Split };
  goals: { label: string; percent: number }[];
  templates: Record<"balanced" | "saver" | "careful", Split>;
  plans: Plan[];
  listed: PublicPlan[];
}

interface Preview {
  plan: PublicPlan;
  forMe: Split;
}

type Start = "month" | "balanced" | "saver" | "careful";
const total = (split: Split): number => SLICES.reduce((sum, key) => sum + split[key], 0);

/**
 * One split drawn as a stacked bar with a row per slice. `amounts` are the
 * viewer's own euros for those percentages; `compare` adds the difference
 * from how their month is split today.
 */
function SplitView({
  split,
  amounts,
  compare,
}: {
  split: Split;
  amounts?: Split;
  compare?: Split;
}): React.JSX.Element {
  const { t, locale } = usePreferences();
  return (
    <div className="flex flex-col gap-3">
      <div
        className="flex h-4 overflow-hidden rounded-full bg-border"
        role="img"
        aria-label={SLICES.map((key) => `${t(`plan.slice.${key}`)} ${split[key]} %`).join(", ")}
      >
        {SLICES.map((key) =>
          split[key] > 0 ? (
            <span key={key} style={{ width: `${split[key]}%`, background: COLOURS[key] }} />
          ) : null,
        )}
      </div>
      <ul className="flex flex-col gap-1.5 text-sm">
        {SLICES.map((key) => {
          const diff = compare ? split[key] - compare[key] : 0;
          return (
            <li key={key} className="flex items-baseline justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: COLOURS[key] }}
                  aria-hidden="true"
                />
                <span className="truncate">{t(`plan.slice.${key}`)}</span>
              </span>
              <span className="shrink-0 text-right tabular-nums">
                <span className="font-semibold">{split[key]} %</span>
                {amounts ? (
                  <span className="text-muted"> · {formatMoney(amounts[key], locale)}</span>
                ) : null}
                {compare && diff !== 0 ? (
                  <span className="text-muted">
                    {" "}
                    ({diff > 0 ? "+" : "−"}
                    {Math.abs(diff)})
                  </span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Plans: the customer's own splits, sharing them as percentages, and copying other people's. */
export function PlansView(): React.JSX.Element {
  const { t, locale } = usePreferences();
  const toast = useToast();
  const [data, setData] = useState<Payload | null>(null);
  const [failed, setFailed] = useState(false);
  const [tick, setTick] = useState(0);

  // Make or edit
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [start, setStart] = useState<Start>("month");
  const [name, setName] = useState("");
  const [split, setSplit] = useState<Split | null>(null);
  const [formError, setFormError] = useState<MessageKey | null>(null);

  // Share
  const [sharing, setSharing] = useState<Plan | null>(null);
  const [listed, setListed] = useState<"friends" | "public">("friends");
  const [goalNames, setGoalNames] = useState<"hide" | "show">("hide");

  // Copy by code
  const [codeOpen, setCodeOpen] = useState(false);
  const [code, setCode] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [codeError, setCodeError] = useState<MessageKey | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<Payload>(`/api/plans?locale=${locale}`)
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
  }, [locale, tick]);

  // A link a friend sent opens straight on their plan.
  useEffect(() => {
    const shared = new URLSearchParams(window.location.search).get("code");
    if (!shared) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of the address the page was opened with
    setCode(shared.toUpperCase().slice(0, 8));
    setCodeOpen(true);
  }, []);

  // Looks the code up as soon as it is complete.
  const cleanCode = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
  useEffect(() => {
    if (!codeOpen || cleanCode.length !== 8) return;
    let cancelled = false;
    api<Preview>(`/api/plans?code=${cleanCode}`)
      .then((result) => {
        if (cancelled) return;
        setPreview(result);
        setCodeError(null);
      })
      .catch((failure: unknown) => {
        if (cancelled) return;
        setPreview(null);
        setCodeError(
          failure instanceof ApiError && failure.status === 404
            ? "plans.code.notFound"
            : "toast.error",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [codeOpen, cleanCode]);

  const reload = useCallback(() => setTick((value) => value + 1), []);
  const money = (cents: number): string => formatMoney(cents, locale);

  function openMake(): void {
    setEditingId(null);
    setStart("month");
    setName("");
    setSplit(data?.actual.percent ?? null);
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(plan: Plan): void {
    setEditingId(plan.id);
    setName(plan.name);
    setSplit(plan.split);
    setFormError(null);
    setFormOpen(true);
  }

  function pickStart(value: Start): void {
    setStart(value);
    if (data) setSplit(value === "month" ? data.actual.percent : data.templates[value]);
  }

  async function savePlan(): Promise<boolean> {
    if (!split) return false;
    setFormError(null);
    try {
      await api("/api/plans", {
        method: "POST",
        json: editingId
          ? { action: "update", id: editingId, name: name.trim(), split }
          : {
              action: "create",
              name: name.trim(),
              split,
              origin: start === "month" ? "own" : "template",
            },
      });
    } catch (failure) {
      const reason = failure instanceof ApiError ? failure.code : "";
      setFormError(
        reason === "name_has_amount"
          ? "plans.error.name_has_amount"
          : reason === "too_many"
            ? "plans.error.too_many"
            : "toast.error",
      );
      return false;
    }
    toast.notify(editingId ? "toast.updated" : "toast.saved");
    setFormOpen(false);
    reload();
    return true;
  }

  async function act(payload: Record<string, unknown>, message: MessageKey): Promise<boolean> {
    try {
      await api("/api/plans", { method: "POST", json: payload });
    } catch {
      toast.fail();
      return false;
    }
    toast.notify(message);
    reload();
    return true;
  }

  async function share(): Promise<boolean> {
    if (!sharing) return false;
    const done = await act(
      {
        action: "share",
        id: sharing.id,
        listed: listed === "public",
        showGoalNames: goalNames === "show",
      },
      "toast.planShared",
    );
    if (done) setSharing(null);
    return done;
  }

  async function copy(): Promise<boolean> {
    try {
      await api("/api/plans", { method: "POST", json: { action: "copy", code: cleanCode } });
    } catch (failure) {
      const reason = failure instanceof ApiError ? failure.code : "";
      setCodeError(reason === "too_many" ? "plans.error.too_many" : "toast.error");
      return false;
    }
    toast.notify("toast.planCopied");
    closeCode();
    reload();
    return true;
  }

  function closeCode(): void {
    setCodeOpen(false);
    setCode("");
    setPreview(null);
    setCodeError(null);
  }

  async function copyLink(shareCode: string): Promise<void> {
    const link = `${window.location.origin}/plans?code=${shareCode}`;
    try {
      if (navigator.share) await navigator.share({ title: t("plans.title"), url: link });
      else {
        await navigator.clipboard.writeText(link);
        toast.notify("toast.linkCopied");
      }
    } catch {
      // The share sheet was dismissed, or the clipboard is not available: the code is on screen.
    }
  }

  const sum = split ? total(split) : 0;
  const nudge = (key: SliceKey, by: number): void => {
    if (split) setSplit({ ...split, [key]: Math.min(100, Math.max(0, split[key] + by)) });
  };
  const button =
    "rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary disabled:opacity-60";
  const quiet = "rounded-full border border-border bg-surface px-5 py-2.5 text-sm font-semibold";

  return (
    <div className="flex flex-col gap-5 px-4 py-4">
      <div>
        <h1 className="text-xl font-semibold">{t("plans.title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("plans.intro")}</p>
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
          <section className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
            <h2 className="text-base font-semibold">{t("plans.today")}</h2>
            <SplitView split={data.actual.percent} amounts={data.actual.cents} />
            <p className="text-xs text-muted">{t("plans.today.note")}</p>
          </section>

          <div className="flex flex-wrap gap-3">
            <button type="button" className={button} onClick={openMake}>
              {t("plans.make")}
            </button>
            {data.sharing ? (
              <button type="button" className={quiet} onClick={() => setCodeOpen(true)}>
                {t("plans.addCode")}
              </button>
            ) : null}
            <Link href={`/chat?q=${encodeURIComponent(t("plans.ask"))}`} className={quiet}>
              {t("plans.askCoach")}
            </Link>
          </div>

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold">{t("plans.yours")}</h2>
            {data.plans.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted">
                {t("plans.empty")}
              </p>
            ) : null}
            <div className="grid gap-3 md:grid-cols-2">
              {data.plans.map((plan) => (
                <article
                  key={plan.id}
                  className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4"
                >
                  <div>
                    <h3 className="text-base font-semibold">{plan.name}</h3>
                    <p className="text-xs text-muted">
                      {plan.tracked ? `${t("plans.following")} · ` : ""}
                      {t(`plans.origin.${plan.origin}`)}
                      {plan.shareCode
                        ? ` · ${t(plan.shareListed ? "plans.shared.listed" : "plans.shared.code")}`
                        : ""}
                    </p>
                  </div>
                  <SplitView
                    split={plan.split}
                    amounts={plan.forMe}
                    compare={data.actual.percent}
                  />
                  <p className="text-xs text-muted">{t("plans.forYou.note")}</p>
                  {plan.goals.length > 0 ? (
                    <p className="text-xs text-muted">
                      {t("plans.goals")}:{" "}
                      {plan.goals.map((goal) => `${goal.label} ${goal.percent} %`).join(" · ")}
                    </p>
                  ) : null}
                  {plan.shareCode ? (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-accent-soft px-3 py-2 text-sm">
                      <span>
                        {t("plans.code")}{" "}
                        <span className="font-mono font-semibold tracking-widest">
                          {plan.shareCode}
                        </span>
                      </span>
                      <button
                        type="button"
                        className="font-semibold text-accent"
                        onClick={() => void copyLink(plan.shareCode ?? "")}
                      >
                        {t("plans.sendLink")}
                      </button>
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm font-semibold">
                    <button type="button" className="text-accent" onClick={() => openEdit(plan)}>
                      {t("common.edit")}
                    </button>
                    <button
                      type="button"
                      aria-pressed={Boolean(plan.tracked)}
                      className={plan.tracked ? "text-muted" : "text-accent"}
                      onClick={() =>
                        void act(
                          { action: "track", id: plan.tracked ? null : plan.id },
                          plan.tracked ? "toast.updated" : "toast.planFollowed",
                        )
                      }
                    >
                      {t(plan.tracked ? "plans.unfollow" : "plans.follow")}
                    </button>
                    {data.sharing && !plan.shareCode ? (
                      <button
                        type="button"
                        className="text-accent"
                        onClick={() => {
                          setListed("friends");
                          setGoalNames("hide");
                          setSharing(plan);
                        }}
                      >
                        {t("plans.share")}
                      </button>
                    ) : null}
                    {plan.shareCode ? (
                      <button
                        type="button"
                        className="text-muted"
                        onClick={() =>
                          void act({ action: "unshare", id: plan.id }, "toast.planUnshared")
                        }
                      >
                        {t("plans.stopSharing")}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="text-muted"
                      onClick={() =>
                        void act({ action: "delete", id: plan.id }, "toast.movedToBin")
                      }
                    >
                      {t("common.moveToBin")}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <BudgetsSection />

          {data.sharing ? (
            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold">{t("plans.popular")}</h2>
              <p className="text-xs text-muted">{t("plans.popular.note")}</p>
              {data.listed.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted">
                  {t("plans.popular.empty")}
                </p>
              ) : null}
              <div className="grid gap-3 md:grid-cols-2">
                {data.listed.map((plan) => (
                  <article
                    key={plan.code}
                    className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4"
                  >
                    <div>
                      <h3 className="text-base font-semibold">{plan.name}</h3>
                      <p className="text-xs text-muted">
                        {t("plans.copies", { count: plan.copies })}
                        {plan.mine ? ` · ${t("plans.mine")}` : ""}
                      </p>
                    </div>
                    <SplitView split={plan.split} />
                    {plan.mine ? null : (
                      <button
                        type="button"
                        className={`${quiet} self-start`}
                        onClick={() => {
                          setCode(plan.code);
                          setCodeOpen(true);
                        }}
                      >
                        {t("plans.tryIt")}
                      </button>
                    )}
                  </article>
                ))}
              </div>
            </section>
          ) : (
            <p className="text-xs text-muted">{t("plans.sharingOff")}</p>
          )}
        </>
      ) : failed ? null : (
        <p className="py-10 text-center text-sm text-muted" role="status">
          …
        </p>
      )}

      {/* Make or edit a plan */}
      <Wizard
        open={formOpen}
        title={t(editingId ? "plans.editTitle" : "plans.make")}
        finishLabel={t("common.save")}
        error={formError ? t(formError) : null}
        onClose={() => setFormOpen(false)}
        onFinish={savePlan}
        steps={[
          ...(editingId
            ? []
            : [
                {
                  title: t("plans.step.start"),
                  hint: t("plans.step.startHint"),
                  valid: true,
                  content: (
                    <WizardChoices
                      name="plan-start"
                      value={start}
                      onChange={pickStart}
                      options={(["month", "balanced", "saver", "careful"] as const).map(
                        (value) => ({
                          value,
                          label: t(`plans.start.${value}`),
                          note: t(`plans.start.${value}.note`),
                        }),
                      )}
                    />
                  ),
                },
              ]),
          {
            title: t("plans.step.name"),
            hint: t("plans.step.nameHint"),
            valid: name.trim().length > 0,
            content: (
              <>
                <WizardField
                  label={t("plans.step.name")}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={t("plans.name.suggest.1")}
                  maxLength={60}
                  autoFocus
                />
                <Suggestions
                  label={t("wizard.suggestions")}
                  options={(["1", "2", "3"] as const).map((n) => ({
                    label: t(`plans.name.suggest.${n}`),
                    value: t(`plans.name.suggest.${n}`),
                  }))}
                  onPick={setName}
                />
              </>
            ),
          },
          {
            title: t("plans.step.split"),
            hint: t("plans.step.splitHint"),
            valid: sum === 100,
            content: split ? (
              <div className="flex flex-col gap-3">
                {SLICES.map((key) => (
                  <div key={key} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex min-w-0 items-center gap-2 font-medium">
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ background: COLOURS[key] }}
                          aria-hidden="true"
                        />
                        <span className="truncate">{t(`plan.slice.${key}`)}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        <button
                          type="button"
                          aria-label={`${t(`plan.slice.${key}`)} −1`}
                          className="size-9 rounded-full border border-border text-lg"
                          onClick={() => nudge(key, -1)}
                        >
                          −
                        </button>
                        <span className="w-12 text-center font-semibold tabular-nums">
                          {split[key]} %
                        </span>
                        <button
                          type="button"
                          aria-label={`${t(`plan.slice.${key}`)} +1`}
                          className="size-9 rounded-full border border-border text-lg"
                          onClick={() => nudge(key, 1)}
                        >
                          +
                        </button>
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={split[key]}
                      aria-label={t(`plan.slice.${key}`)}
                      onChange={(event) =>
                        setSplit({ ...split, [key]: Number(event.target.value) })
                      }
                      className="w-full accent-[var(--accent)]"
                    />
                    {data ? (
                      <p className="text-xs text-muted">
                        {t("plans.forYou", {
                          amount: money(Math.round((data.actual.incomeCents * split[key]) / 100)),
                        })}
                      </p>
                    ) : null}
                  </div>
                ))}
                <p
                  role="status"
                  className={`rounded-xl px-3 py-2 text-sm font-semibold ${
                    sum === 100 ? "bg-accent-soft text-accent" : "bg-warning-soft text-warning"
                  }`}
                >
                  {sum === 100
                    ? t("plans.total.ok")
                    : sum < 100
                      ? t("plans.total.left", { left: 100 - sum })
                      : t("plans.total.over", { over: sum - 100 })}
                </p>
                {sum !== 100 ? (
                  <Suggestions
                    label={t("wizard.suggestions")}
                    options={[{ label: t("plans.balance"), value: "saving" }]}
                    onPick={() =>
                      setSplit({
                        ...split,
                        saving: Math.min(100, Math.max(0, split.saving + (100 - sum))),
                      })
                    }
                  />
                ) : null}
              </div>
            ) : null,
          },
          {
            title: t("wizard.review"),
            hint: t("wizard.reviewHint"),
            valid: sum === 100,
            content: split ? (
              <WizardReview
                rows={[
                  { label: t("plans.step.name"), value: name.trim() },
                  ...SLICES.map((key) => ({
                    label: t(`plan.slice.${key}`),
                    value: `${split[key]} %`,
                  })),
                ]}
              />
            ) : null,
          },
        ]}
      />

      {/* Share a plan */}
      <Wizard
        open={sharing !== null}
        title={t("plans.share")}
        finishLabel={t("plans.share.confirm")}
        onClose={() => setSharing(null)}
        onFinish={share}
        steps={[
          {
            title: t("plans.share.step.who"),
            hint: t("plans.share.step.whoHint"),
            valid: true,
            content: (
              <WizardChoices
                name="plan-share-who"
                value={listed}
                onChange={setListed}
                options={(["friends", "public"] as const).map((value) => ({
                  value,
                  label: t(`plans.share.${value}`),
                  note: t(`plans.share.${value}.note`),
                }))}
              />
            ),
          },
          ...(sharing && sharing.goals.length > 0
            ? [
                {
                  title: t("plans.share.step.goals"),
                  hint: t("plans.share.step.goalsHint"),
                  valid: true,
                  content: (
                    <WizardChoices
                      name="plan-share-goals"
                      value={goalNames}
                      onChange={setGoalNames}
                      options={(["hide", "show"] as const).map((value) => ({
                        value,
                        label: t(`plans.share.goals.${value}`),
                        note: t(`plans.share.goals.${value}.note`),
                      }))}
                    />
                  ),
                },
              ]
            : []),
          {
            title: t("plans.share.step.review"),
            hint: t("plans.share.step.reviewHint"),
            valid: true,
            content: sharing ? (
              <div className="flex flex-col gap-3">
                <div className="rounded-2xl border border-border p-4">
                  <p className="mb-3 text-base font-semibold">{sharing.name}</p>
                  <SplitView split={sharing.split} />
                  {sharing.goals.length > 0 ? (
                    <p className="mt-3 text-xs text-muted">
                      {t("plans.goals")}:{" "}
                      {sharing.goals
                        .map(
                          (goal, index) =>
                            `${goalNames === "show" ? goal.label : `#${index + 1}`} ${goal.percent} %`,
                        )
                        .join(" · ")}
                    </p>
                  ) : null}
                </div>
                <p className="rounded-xl bg-accent-soft px-3 py-2 text-sm">
                  {t("plans.share.never")}
                </p>
              </div>
            ) : null,
          },
        ]}
      />

      {/* Add a plan someone shared */}
      <Wizard
        open={codeOpen}
        title={t("plans.addCode")}
        finishLabel={t("plans.code.add")}
        error={codeError ? t(codeError) : null}
        onClose={closeCode}
        onFinish={copy}
        steps={[
          {
            title: t("plans.code.step"),
            hint: t("plans.code.hint"),
            valid: preview !== null && preview.plan.code === cleanCode,
            content: (
              <WizardField
                label={t("plans.code")}
                value={code}
                onChange={(event) => {
                  setCode(event.target.value.toUpperCase().slice(0, 9));
                  setPreview(null);
                  setCodeError(null);
                }}
                placeholder="K7M2QX9P"
                autoCapitalize="characters"
                autoComplete="off"
                maxLength={9}
                autoFocus
              />
            ),
          },
          {
            title: preview?.plan.name ?? "…",
            hint: t("plans.code.previewHint"),
            valid: preview !== null,
            content:
              preview && data ? (
                <div className="flex flex-col gap-3">
                  <SplitView
                    split={preview.plan.split}
                    amounts={preview.forMe}
                    compare={data.actual.percent}
                  />
                  <p className="text-xs text-muted">{t("plans.forYou.note")}</p>
                </div>
              ) : null,
          },
        ]}
      />
    </div>
  );
}
