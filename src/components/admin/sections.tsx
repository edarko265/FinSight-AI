"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AdminControls } from "@/components/admin/AdminControls";
import { AdminTrash } from "@/components/admin/AdminTrash";
import { SharedPlans } from "@/components/admin/SharedPlans";
import { Team } from "@/components/admin/Team";
import { Training } from "@/components/admin/Training";
import { isManager, useAdminData, type AdminData } from "@/components/admin/AdminShell";
import { AdvisorQueue } from "@/components/admin/AdvisorQueue";
import { Announcements } from "@/components/admin/Announcements";
import { Bars, DailyChart, Meter, Panel, Ring, Stat } from "@/components/admin/parts";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { formatDay, formatMoney, isLocale, LOCALE_INFO } from "@/lib/i18n/config";
import { hasMessage, type MessageKey } from "@/lib/i18n/translate";

/** Helpers every section needs, plus the loaded figures (the shell only renders sections once they exist). */
function useAdmin(): {
  data: AdminData;
  number: (value: number) => string;
  percent: (part: number, whole: number) => number;
  topic: (name: string) => string;
} {
  const { t, locale } = usePreferences();
  const { data } = useAdminData();
  if (!data) throw new Error("Admin sections render only after the figures have loaded");
  return {
    data,
    number: (value) => new Intl.NumberFormat(LOCALE_INFO[locale].intl).format(value),
    percent: (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : 0),
    topic: (name) => {
      const key = `admin.topic.${name}`;
      return hasMessage(key) ? t(key) : name;
    },
  };
}

const language = (code: string): string =>
  isLocale(code) ? `${LOCALE_INFO[code].flag} ${LOCALE_INFO[code].label}` : code;

function modeParts(
  data: AdminData,
  t: (key: MessageKey) => string,
): { label: string; count: number }[] {
  const count = (mode: string): number =>
    data.usage.byMode.find((row) => row.mode === mode)?.count ?? 0;
  return [
    { label: t("admin.chart.mode.ai"), count: count("ai") },
    { label: t("admin.chart.mode.basic"), count: count("basic") },
    { label: t("admin.chart.mode.team"), count: count("team") },
  ].filter((part) => part.count > 0);
}

const themeLabel = (t: (key: MessageKey) => string, theme: string): string =>
  hasMessage(`admin.theme.${theme}`) ? t(`admin.theme.${theme}` as MessageKey) : theme;

/**
 * The front page: what needs someone today, then the headline numbers. Every
 * number and every row opens the page where something can be done about it.
 */
export function OverviewSection(): React.JSX.Element {
  const { t } = usePreferences();
  const { data, number, percent, topic } = useAdmin();
  const { usage, workload, ai, settings, me } = data;
  const manager = isManager(me.role);
  const total = usage.totalQuestions;
  const aiAnswers = usage.byMode.find((row) => row.mode === "ai")?.count ?? 0;
  const limit = settings.aiDailyRequestLimit;
  const topGap = usage.unansweredThemes[0];

  const attention: { text: string; href: string; action: string }[] = [];
  if (workload.needsReply > 0) {
    attention.push({
      text: t("admin.attention.replies", { count: workload.needsReply }),
      href: "/admin/advisers",
      action: t("admin.attention.replies.action"),
    });
  }
  if (topGap) {
    attention.push({
      text: t("admin.attention.gap", { theme: themeLabel(t, topGap.topic), count: topGap.count }),
      href: "/admin/training",
      action: t("admin.attention.gap.action"),
    });
  }
  if (manager && limit > 0 && ai.requestsToday >= limit * 0.8) {
    attention.push({
      text: t("admin.attention.limit", { used: ai.requestsToday, limit }),
      href: "/admin/controls",
      action: t("admin.attention.limit.action"),
    });
  }
  if (usage.groundingCorrections > 0 && manager) {
    attention.push({
      text: t("admin.attention.grounding", { count: usage.groundingCorrections }),
      href: "/admin/ai",
      action: t("admin.open"),
    });
  }

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("admin.nav.overview")}</h1>
        <p className="mt-1 text-sm text-muted">{t("admin.overview.intro")}</p>
      </div>
      <Panel title={t("admin.attention")}>
        {attention.length === 0 ? (
          <p className="text-sm text-muted">{t("admin.attention.none")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border text-sm">
            {attention.map((item) => (
              <li key={item.href + item.text}>
                <Link
                  href={item.href}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <span>{item.text}</span>
                  <span className="font-semibold text-accent">{item.action} →</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          label={t("admin.questions")}
          value={number(total)}
          note={t("admin.note.perDay", {
            count: number(Math.round((total / data.days) * 10) / 10),
          })}
          href="/admin/usage"
        />
        <Stat
          label={t("admin.unanswered")}
          value={`${percent(usage.unanswered, total)} %`}
          note={t("admin.note.of", { part: number(usage.unanswered), whole: number(total) })}
          href="/admin/training"
        />
        <Stat
          label={t("admin.workload.needsReply")}
          value={number(workload.needsReply)}
          note={t("admin.note.open", { count: number(workload.open) })}
          tone={workload.needsReply > 0 ? "warning" : undefined}
          href="/admin/advisers"
        />
        <Stat
          label={t("admin.aiShare")}
          value={`${percent(aiAnswers, total)} %`}
          note={t("admin.note.of", { part: number(aiAnswers), whole: number(total) })}
          href={manager ? "/admin/ai" : "/admin/usage"}
        />
      </div>
      <Panel title={t("admin.chart.daily")} href="/admin/usage">
        <DailyChart points={usage.daily} unit={t("admin.questions.unit")} span={data.days} />
      </Panel>
      <div className="grid gap-5 md:grid-cols-2">
        <Panel title={t("admin.usage")} href="/admin/usage">
          <Bars
            rows={usage.byTopic.slice(0, 6).map((row) => ({
              label: topic(row.topic),
              count: row.count,
              href: "/admin/usage",
            }))}
          />
        </Panel>
        <Panel title={t("admin.themes")} href="/admin/training">
          <Bars
            rows={usage.unansweredThemes.slice(0, 6).map((row) => ({
              label: themeLabel(t, row.topic),
              count: row.count,
              href: "/admin/training",
            }))}
          />
        </Panel>
      </div>
    </>
  );
}

function Suggestions(): React.JSX.Element {
  const { t } = usePreferences();
  const { data, percent, topic } = useAdmin();
  const { usage } = data;
  const total = usage.totalQuestions;
  const top = usage.byTopic.find((row) => row.topic !== "none");
  if (total === 0) return <p className="text-sm text-muted">{t("admin.usage.empty")}</p>;
  return (
    <ul className="flex flex-col gap-2 text-sm">
      {top ? (
        <li>
          {t("admin.value.top", { topic: topic(top.topic), percent: percent(top.count, total) })}
        </li>
      ) : null}
      <li>{t("admin.value.unanswered", { percent: percent(usage.unanswered, total) })}</li>
      <li>
        {t("admin.value.consent", {
          accepted: usage.consentAccepted,
          withdrawn: usage.consentWithdrawn,
        })}
      </li>
    </ul>
  );
}

/** Turns rows into a CSV file the browser saves. Aggregates only, like everything on these pages. */
function downloadCsv(name: string, header: string[], rows: (string | number)[][]): void {
  const cell = (value: string | number): string => `"${String(value).replaceAll('"', '""')}"`;
  const text = [header, ...rows].map((row) => row.map(cell).join(",")).join("\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  link.download = name;
  link.click();
  URL.revokeObjectURL(link.href);
}

/** What customers ask about, in which language, and how they use the app. */
export function UsageSection(): React.JSX.Element {
  const { t } = usePreferences();
  const { data, number, percent, topic } = useAdmin();
  const { usage } = data;
  const total = usage.totalQuestions;
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">{t("admin.nav.usage")}</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          label={t("admin.questions")}
          value={number(total)}
          note={t("admin.note.perDay", {
            count: number(Math.round((total / data.days) * 10) / 10),
          })}
        />
        <Stat
          label={t("admin.consent")}
          value={number(usage.consentAccepted)}
          note={t("admin.note.withdrawn", { count: number(usage.consentWithdrawn) })}
        />
        <Stat label={t("admin.goals")} value={number(usage.goalsSet)} />
        <Stat label={t("admin.voice")} value={number(usage.voiceUses)} />
        <Stat label={t("admin.widgets")} value={number(usage.widgetsPinned)} />
        <Stat
          label={t("admin.advisor.stat")}
          value={number(usage.advisorRequests)}
          href="/admin/advisers"
        />
        <Stat
          label={t("admin.unanswered")}
          value={`${percent(usage.unanswered, total)} %`}
          note={t("admin.note.of", { part: number(usage.unanswered), whole: number(total) })}
          href="/admin/training"
        />
      </div>
      <Panel
        title={t("admin.chart.daily")}
        action={
          <button
            type="button"
            className="text-sm font-semibold text-accent"
            onClick={() =>
              downloadCsv(
                "finsight-questions-per-day.csv",
                ["day", "questions"],
                usage.daily.map((row) => [row.day.slice(0, 10), row.count]),
              )
            }
          >
            {t("admin.download")}
          </button>
        }
      >
        <DailyChart points={usage.daily} unit={t("admin.questions.unit")} span={data.days} />
      </Panel>
      <div className="grid gap-5 md:grid-cols-2">
        <Panel
          title={t("admin.usage")}
          action={
            <button
              type="button"
              className="text-sm font-semibold text-accent"
              onClick={() =>
                downloadCsv(
                  "finsight-questions-by-topic.csv",
                  ["topic", "questions"],
                  usage.byTopic.map((row) => [topic(row.topic), row.count]),
                )
              }
            >
              {t("admin.download")}
            </button>
          }
        >
          {total === 0 ? (
            <p className="text-sm text-muted">{t("admin.usage.empty")}</p>
          ) : (
            <Bars
              rows={usage.byTopic.map((row) => ({ label: topic(row.topic), count: row.count }))}
            />
          )}
        </Panel>
        <div className="flex flex-col gap-5">
          <Panel title={t("admin.byLanguage")}>
            <Ring
              unit={t("admin.questions.unit")}
              parts={usage.byLocale.map((row) => ({
                label: language(row.locale),
                count: row.count,
              }))}
            />
          </Panel>
          <Panel title={t("admin.value")}>
            <Suggestions />
          </Panel>
        </div>
      </div>
    </>
  );
}

/** What the AI costs and how it behaves. */
export function AiSection(): React.JSX.Element {
  const { t } = usePreferences();
  const { data, number } = useAdmin();
  const { ai, usage, system, settings } = data;
  const tokens = ai.last30.inputTokens + ai.last30.outputTokens;
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">{t("admin.aiUsage")}</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          label={`${t("admin.aiUsage.requests")} · ${t("admin.aiUsage.today")}`}
          value={number(ai.today.requests)}
          note={
            settings.aiDailyRequestLimit > 0
              ? t("admin.note.limit", { limit: number(settings.aiDailyRequestLimit) })
              : t("admin.note.noLimit")
          }
          href="/admin/controls"
        />
        <Stat
          label={`${t("admin.aiUsage.requests")} · ${t("admin.aiUsage.month")}`}
          value={number(ai.last30.requests)}
          note={t("admin.note.tokens", { count: number(tokens) })}
        />
        <Stat
          label={t("admin.grounding")}
          value={number(usage.groundingCorrections)}
          tone={usage.groundingCorrections > 0 ? "warning" : undefined}
        />
        <Stat
          label={t("admin.ai")}
          value={system.ai.enabled ? (system.ai.model ?? "—") : t("admin.ai.off")}
          href="/admin/controls"
        />
      </div>
      {settings.aiDailyRequestLimit > 0 ? (
        <Panel title={t("admin.limit")} href="/admin/controls">
          <Meter
            used={ai.requestsToday}
            limit={settings.aiDailyRequestLimit}
            label={t("admin.limit.today")}
          />
        </Panel>
      ) : null}
      <Panel title={t("admin.chart.aiDaily")}>
        <DailyChart
          points={ai.daily.map((row) => ({ day: row.day, count: row.requests }))}
          unit={t("admin.aiUsage.requests")}
          span={data.days}
        />
      </Panel>
      <div className="grid gap-5 md:grid-cols-2">
        <Panel title={t("admin.aiUsage")}>
          {ai.last30.requests === 0 ? (
            <p className="text-sm text-muted">{t("admin.aiUsage.empty")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted">
                    <th className="py-1 font-medium" />
                    <th className="py-1 text-right font-medium">{t("admin.aiUsage.requests")}</th>
                    <th className="py-1 text-right font-medium">{t("admin.aiUsage.input")}</th>
                    <th className="py-1 text-right font-medium">{t("admin.aiUsage.output")}</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {[
                    { label: t("admin.aiUsage.today"), ...ai.today },
                    { label: t("admin.aiUsage.month"), ...ai.last30 },
                    ...ai.byModel.map((row) => ({ label: row.model, ...row })),
                  ].map((row) => (
                    <tr key={row.label} className="border-t border-border">
                      <td className="py-1.5">{row.label}</td>
                      <td className="py-1.5 text-right">{number(row.requests)}</td>
                      <td className="py-1.5 text-right">{number(row.inputTokens)}</td>
                      <td className="py-1.5 text-right">{number(row.outputTokens)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-muted">{t("admin.aiUsage.note")}</p>
        </Panel>
        <Panel title={t("admin.chart.mode")}>
          <Ring unit={t("admin.questions.unit")} parts={modeParts(data, t)} />
          <p className="text-xs text-muted">{t("admin.chart.mode.note")}</p>
        </Panel>
      </div>
      <Panel title={t("admin.how")}>
        <HowItWorks />
      </Panel>
    </>
  );
}

const HOW: MessageKey[] = [
  "admin.how.1",
  "admin.how.2",
  "admin.how.3",
  "admin.how.4",
  "admin.how.5",
];

function HowItWorks(): React.JSX.Element {
  const { t } = usePreferences();
  return (
    <ol className="flex flex-col gap-2.5 text-sm">
      {HOW.map((key, index) => (
        <li key={key} className="flex gap-3">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-semibold text-on-brand">
            {index + 1}
          </span>
          <span>{t(key)}</span>
        </li>
      ))}
    </ol>
  );
}

/** The adviser queue and how the team is keeping up. */
export function AdvisersSection(): React.JSX.Element {
  const { t, locale } = usePreferences();
  const { data, number } = useAdmin();
  const { workload } = data;
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">{t("admin.nav.advisers")}</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={t("admin.workload.open")} value={number(workload.open)} />
        <Stat label={t("admin.workload.needsReply")} value={number(workload.needsReply)} />
        <Stat label={t("admin.workload.closed")} value={number(workload.closed)} />
        <Stat
          label={t("admin.payments")}
          value={formatMoney(data.payments.cents, locale)}
          note={t(data.payments.simulated ? "admin.payments.simulated" : "admin.payments.count", {
            count: data.payments.count,
          })}
        />
        <Stat
          label={t("admin.workload.firstReply")}
          value={
            workload.averageFirstReplyMinutes === null
              ? "—"
              : t("admin.workload.minutes", { minutes: workload.averageFirstReplyMinutes })
          }
        />
      </div>
      <Panel title={t("admin.advisor")}>
        <AdvisorQueue />
      </Panel>
      <div className="grid gap-5 md:grid-cols-2">
        <Panel title={t("advisor.topic")}>
          <Ring
            unit={t("admin.requests.unit")}
            parts={workload.byTopic.map((row) => ({
              label: t(`advisor.topic.${row.topic}` as MessageKey),
              count: row.count,
            }))}
          />
        </Panel>
        <Panel title={t("admin.fee")}>
          <Ring
            unit={t("admin.requests.unit")}
            parts={[
              { label: t("admin.workload.free"), count: workload.free },
              { label: t("admin.workload.paid"), count: workload.paid },
            ]}
          />
        </Panel>
      </div>
    </>
  );
}

export function AnnouncementsSection(): React.JSX.Element {
  const { t } = usePreferences();
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">{t("admin.nav.announcements")}</h1>
      <Panel title={t("admin.announcements")}>
        <Announcements />
      </Panel>
    </>
  );
}

/** Device notifications: who has them on, and sending the reminders by hand. */
export function NotificationsSection(): React.JSX.Element {
  const { t } = usePreferences();
  const toast = useToast();
  const { reload } = useAdminData();
  const { number } = useAdmin();
  const [customers, setCustomers] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ sent: number; customers: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/reminders", { credentials: "same-origin" })
      .then((response) =>
        response.ok ? (response.json() as Promise<{ customers: number }>) : null,
      )
      .then((payload) => {
        if (!cancelled && payload) setCustomers(payload.customers);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  async function send(): Promise<void> {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/reminders", {
        method: "POST",
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error("failed");
      const payload = (await response.json()) as { sent: number; customers: number };
      setResult(payload);
      setCustomers(payload.customers);
      toast.notify("toast.sent");
      reload();
    } catch {
      toast.fail();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">{t("admin.nav.notifications")}</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={t("notify.title")} value={customers === null ? "…" : number(customers)} />
      </div>
      <Panel title={t("admin.nav.notifications")}>
        <p className="text-sm">
          {customers === null ? "…" : t("admin.notifications.devices", { count: customers })}
        </p>
        <p className="text-sm text-muted">{t("admin.notifications.note")}</p>
        <p className="text-sm text-muted">{t("admin.notifications.announce")}</p>
        <button
          type="button"
          disabled={busy}
          onClick={() => void send()}
          className="self-start rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary disabled:opacity-60"
        >
          {t(busy ? "admin.notifications.sending" : "admin.notifications.send")}
        </button>
        {result ? (
          <p role="status" className="rounded-xl bg-accent-soft px-3 py-2 text-sm">
            {t("admin.notifications.result", result)}
          </p>
        ) : null}
      </Panel>
    </>
  );
}

export function ControlsSection(): React.JSX.Element {
  const { t } = usePreferences();
  const { reload, patch } = useAdminData();
  const { data } = useAdmin();
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">{t("admin.nav.controls")}</h1>
      <Panel title={t("admin.controls")}>
        <AdminControls
          settings={data.settings}
          requestsToday={data.ai.requestsToday}
          model={data.system.ai.enabled ? data.system.ai.model : null}
          providers={data.system.ai.available}
          onSaved={(settings) => {
            patch({ settings });
            reload();
          }}
        />
      </Panel>
    </>
  );
}

/** What is loaded, how it is protected, and what staff have done. */
export function SystemSection(): React.JSX.Element {
  const { t, locale } = usePreferences();
  const { data, number } = useAdmin();
  const { system, audit } = data;
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">{t("admin.nav.system")}</h1>
      <div className="grid gap-5 md:grid-cols-2">
        <Panel title={t("admin.system")}>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted">{t("admin.customers")}</dt>
            <dd className="tabular-nums">{number(system.customers)}</dd>
            <dt className="text-muted">{t("admin.transactions")}</dt>
            <dd className="tabular-nums">{number(system.transactions)}</dd>
            <dt className="text-muted">{t("admin.dataDate")}</dt>
            <dd>{formatDay(system.asOf, locale)}</dd>
            <dt className="text-muted">{t("admin.encryption")}</dt>
            <dd>{t("admin.encryption.value", system.encryption)}</dd>
            <dt className="text-muted">{t("admin.database")}</dt>
            <dd>{t(`admin.database.${system.database}` as MessageKey)}</dd>
            <dt className="text-muted">{t("admin.ai")}</dt>
            <dd>{system.ai.enabled ? system.ai.model : t("admin.ai.off")}</dd>
            <dt className="text-muted">{t("admin.voiceStatus")}</dt>
            <dd>{t(system.voice ? "admin.on" : "admin.off")}</dd>
            <dt className="text-muted">{t("admin.benchmarks")}</dt>
            <dd className="tabular-nums">{number(system.benchmarkGroups)}</dd>
            <dt className="text-muted">{t("admin.sessions")}</dt>
            <dd className="tabular-nums">{number(system.activeSessions)}</dd>
            <dt className="text-muted">{t("admin.checksum")}</dt>
            <dd className="truncate font-mono text-xs">{system.sourceChecksum?.slice(0, 16)}…</dd>
          </dl>
        </Panel>
        <Panel title={t("admin.spendingByAge")}>
          <Bars
            share={false}
            rows={system.spendingByAge.map((row) => ({
              label: `${row.ageBand} (${number(row.groupSize)})`,
              count: row.medianCents,
              note: formatMoney(row.medianCents, locale),
            }))}
          />
          <p className="text-xs text-muted">{t("admin.spendingByAge.note")}</p>
        </Panel>
      </div>
      <Panel title={t("admin.audit")}>
        {audit.length === 0 ? (
          <p className="text-sm text-muted">{t("admin.audit.empty")}</p>
        ) : (
          <ul className="flex max-h-96 flex-col divide-y divide-border overflow-y-auto text-sm">
            {audit.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-baseline justify-between gap-x-4 py-2"
              >
                <span>
                  {hasMessage(`admin.audit.${entry.action}`)
                    ? t(`admin.audit.${entry.action}` as MessageKey)
                    : entry.action}
                  {entry.detail ? <span className="text-muted"> · {entry.detail}</span> : null}
                  {entry.actor ? (
                    <span className="text-muted">
                      {" · "}
                      {entry.actor === "owner" ? t("admin.role.owner") : entry.actor}
                    </span>
                  ) : null}
                </span>
                <time className="text-xs text-muted tabular-nums">
                  {new Intl.DateTimeFormat(LOCALE_INFO[locale].intl, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(entry.at))}
                </time>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}

export function TrainingSection(): React.JSX.Element {
  const { t } = usePreferences();
  const { data } = useAdmin();
  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("admin.nav.training")}</h1>
        <p className="mt-1 text-sm text-muted">{t("admin.training.intro")}</p>
      </div>
      <Training gaps={data.usage.unansweredThemes} />
    </>
  );
}

export function TeamSection(): React.JSX.Element {
  const { t } = usePreferences();
  const { data } = useAdmin();
  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("admin.nav.team")}</h1>
        <p className="mt-1 text-sm text-muted">{t("admin.team.intro")}</p>
      </div>
      <Team myId={data.me.id} />
    </>
  );
}

export function TrashSection(): React.JSX.Element {
  const { t } = usePreferences();
  const { data } = useAdmin();
  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("admin.nav.trash")}</h1>
        <p className="mt-1 text-sm text-muted">{t("admin.trash.intro")}</p>
      </div>
      <AdminTrash manager={isManager(data.me.role)} />
    </>
  );
}

export function PlansSection(): React.JSX.Element {
  const { t } = usePreferences();
  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("admin.nav.plans")}</h1>
        <p className="mt-1 text-sm text-muted">{t("admin.plans.intro")}</p>
      </div>
      <SharedPlans />
    </>
  );
}
