"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useChatDock } from "@/components/chat/ChatDockProvider";
import { useOverview } from "@/components/providers/OverviewProvider";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import { MicIcon, PhoneIcon } from "@/components/ui/icons";
import { api } from "@/lib/api-client";
import type { ActionWidget } from "@/lib/contracts/chart";
import { formatMoney } from "@/lib/i18n/config";

const primary =
  "flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary";

/** Ask the coach from the dashboard: type a question, or tap the microphone and say it. */
function AskWidget(): React.JSX.Element {
  const { t } = usePreferences();
  const { me } = useOverview();
  const dock = useChatDock();
  const [question, setQuestion] = useState("");
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (!question.trim()) return;
        dock.open({ question: question.trim() });
        setQuestion("");
      }}
    >
      <input
        value={question}
        onChange={(event) => setQuestion(event.target.value)}
        placeholder={t("chat.placeholder")}
        aria-label={t("chat.placeholder")}
        maxLength={400}
        className="min-w-0 flex-1 rounded-full border border-border bg-background px-4 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
      />
      {me?.voiceEnabled ? (
        <button
          type="button"
          onClick={() => dock.open({ start: "listen" })}
          aria-label={t("widget.ask.speak")}
          title={t("widget.ask.speak")}
          className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border text-accent"
        >
          <MicIcon className="size-5" />
        </button>
      ) : null}
      <button
        type="submit"
        disabled={!question.trim()}
        className="shrink-0 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary disabled:opacity-50"
      >
        {t("chat.send")}
      </button>
    </form>
  );
}

/** One tap to a live voice call with the coach. Says why when a call is not possible. */
function CallWidget(): React.JSX.Element {
  const { t } = usePreferences();
  const dock = useChatDock();
  const { me } = useOverview();
  if (me && !(me.voiceAgentEnabled && me.aiConsent)) {
    return (
      <p className="text-sm text-muted">
        {t(me.voiceAgentEnabled ? "widget.call.needsConsent" : "widget.call.off")}{" "}
        {me.voiceAgentEnabled ? (
          <Link href="/settings" className="font-semibold text-accent">
            {t("nav.settings")}
          </Link>
        ) : null}
      </p>
    );
  }
  return (
    <button type="button" onClick={() => dock.open({ start: "call" })} className={primary}>
      <PhoneIcon className="size-4" />
      {t("widget.call.start")}
    </button>
  );
}

interface GoalRow {
  goal: { id: string; name: string; targetCents: number; monthlyCents: number };
  roomCents: number;
  fit: "fits" | "stretch" | "hard";
}

/** The customer's goals at a glance: what each needs a month, and whether the usual month covers it. */
function GoalsWidget(): React.JSX.Element {
  const { t, locale } = usePreferences();
  const [goals, setGoals] = useState<GoalRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    api<{ goals: GoalRow[] }>(`/api/goals?locale=${locale}`)
      .then((data) => {
        if (!cancelled) setGoals(data.goals);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [locale]);
  if (failed) return <p className="text-sm text-warning">{t("admin.loadFailed")}</p>;
  if (!goals) return <p className="text-sm text-muted">…</p>;
  return (
    <div className="flex flex-col gap-3">
      {goals.length === 0 ? <p className="text-sm text-muted">{t("goals.empty")}</p> : null}
      <ul className="flex flex-col gap-3">
        {goals.slice(0, 4).map(({ goal, roomCents, fit }) => {
          const covered = Math.min(
            100,
            Math.round((roomCents / Math.max(1, goal.monthlyCents)) * 100),
          );
          return (
            <li key={goal.id} className="flex flex-col gap-1 text-sm">
              <span className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate font-medium">{goal.name}</span>
                <span className="shrink-0 text-muted tabular-nums">
                  {formatMoney(goal.monthlyCents, locale)} / {t("widget.goals.month")}
                </span>
              </span>
              <span
                className="h-2 overflow-hidden rounded-full bg-border"
                role="meter"
                aria-label={goal.name}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.max(0, covered)}
              >
                <span
                  className={`block h-full rounded-full ${fit === "hard" ? "bg-warning" : "bg-accent"}`}
                  style={{ width: `${Math.max(0, covered)}%` }}
                />
              </span>
            </li>
          );
        })}
      </ul>
      <Link href="/goals" className="text-sm font-semibold text-accent">
        {t("nav.goals")} →
      </Link>
    </div>
  );
}

interface InsightRow {
  id: string;
  severity: "warning" | "info" | "good";
  title: string;
  read: boolean;
}

/** The newest things that need attention. */
function InsightsWidget(): React.JSX.Element {
  const { t, locale } = usePreferences();
  const [insights, setInsights] = useState<InsightRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    api<{ insights: InsightRow[] }>(`/api/insights?locale=${locale}`)
      .then((data) => {
        if (!cancelled) setInsights(data.insights);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [locale]);
  if (failed) return <p className="text-sm text-warning">{t("admin.loadFailed")}</p>;
  if (!insights) return <p className="text-sm text-muted">…</p>;
  return (
    <div className="flex flex-col gap-3">
      {insights.length === 0 ? (
        <p className="text-sm text-muted">{t("widget.insights.none")}</p>
      ) : null}
      <ul className="flex flex-col gap-2 text-sm">
        {insights.slice(0, 4).map((insight) => (
          <li key={insight.id} className="flex items-start gap-2">
            <span
              className={`mt-1.5 size-2 shrink-0 rounded-full ${
                insight.severity === "warning"
                  ? "bg-warning"
                  : insight.read
                    ? "bg-border"
                    : "bg-accent"
              }`}
              aria-hidden="true"
            />
            <span className={insight.read ? "text-muted" : "font-medium"}>{insight.title}</span>
          </li>
        ))}
      </ul>
      <Link href="/insights" className="text-sm font-semibold text-accent">
        {t("insights.title")} →
      </Link>
    </div>
  );
}

/** What each action widget shows inside its card. */
export function ActionWidgetBody({
  action,
  onAfford,
}: {
  action: ActionWidget;
  onAfford: () => void;
}): React.JSX.Element {
  const { t } = usePreferences();
  switch (action) {
    case "ask":
      return <AskWidget />;
    case "call":
      return <CallWidget />;
    case "afford":
      return (
        <button type="button" onClick={onAfford} className={primary}>
          {t("widget.afford.start")}
        </button>
      );
    case "story":
      return (
        <Link href="/story" className={primary}>
          <span aria-hidden="true">▶</span>
          {t("widget.story.start")}
        </Link>
      );
    case "goals":
      return <GoalsWidget />;
    case "insights":
      return <InsightsWidget />;
  }
}
