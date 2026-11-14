"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AdminControls, type AppSettings } from "@/components/admin/AdminControls";
import { AdvisorQueue } from "@/components/admin/AdvisorQueue";
import { Announcements } from "@/components/admin/Announcements";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import { LanguagePicker } from "@/components/settings/LanguagePicker";
import { Logo } from "@/components/ui/icons";
import { formatDay, formatMoney, isLocale, LOCALE_INFO } from "@/lib/i18n/config";
import { hasMessage, type MessageKey } from "@/lib/i18n/translate";

interface AdminPayload {
  system: {
    customers: number;
    transactions: number;
    ingestedAt: string | null;
    sourceChecksum: string | null;
    benchmarkGroups: number;
    activeSessions: number;
    asOf: string;
    database: "postgres" | "embedded";
    encryption: { algorithm: string; keyId: string };
    ai: { enabled: boolean; model: string | null };
    voice: boolean;
    spendingByAge: { ageBand: string; groupSize: number; medianCents: number }[];
  };
  usage: {
    totalQuestions: number;
    byTopic: { topic: string; count: number }[];
    byLocale: { locale: string; count: number }[];
    byMode: { mode: string; count: number }[];
    unanswered: number;
    consentAccepted: number;
    consentWithdrawn: number;
    goalsSet: number;
    voiceUses: number;
    widgetsPinned: number;
    advisorRequests: number;
    unansweredThemes: { topic: string; count: number }[];
  };
  ai: {
    requestsToday: number;
    today: { requests: number; inputTokens: number; outputTokens: number };
    last30: { requests: number; inputTokens: number; outputTokens: number };
    byModel: { model: string; requests: number; inputTokens: number; outputTokens: number }[];
  };
  workload: {
    open: number;
    needsReply: number;
    closed: number;
    byTopic: { topic: "general" | "investment"; count: number }[];
    free: number;
    paid: number;
    averageFirstReplyMinutes: number | null;
  };
  settings: AppSettings;
  audit: { id: string; at: string; action: string; detail: string }[];
}

function Stat({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function Bars({
  rows,
}: {
  rows: { label: string; count: number; note?: string }[];
}): React.JSX.Element {
  const max = Math.max(1, ...rows.map((row) => row.count));
  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((row) => (
        <li key={row.label} className="flex flex-col gap-1">
          <span className="flex items-baseline justify-between gap-3 text-sm">
            <span>{row.label}</span>
            <span className="tabular-nums text-muted">{row.note ?? row.count}</span>
          </span>
          <span className="h-2.5 overflow-hidden rounded-full bg-border" aria-hidden="true">
            <span
              className="block h-full rounded-full bg-accent"
              style={{ width: `${(row.count / max) * 100}%` }}
            />
          </span>
        </li>
      ))}
    </ul>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5">
      <h2 className="text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

const HOW: MessageKey[] = [
  "admin.how.1",
  "admin.how.2",
  "admin.how.3",
  "admin.how.4",
  "admin.how.5",
];

/** What the system is doing and what customers use it for, from anonymous counts only. */
export function AdminDashboard(): React.JSX.Element {
  const { t, locale } = usePreferences();
  const router = useRouter();
  const [data, setData] = useState<AdminPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/overview", { credentials: "same-origin" })
      .then(async (response) => {
        if (response.status === 401) {
          router.replace("/admin/login");
          return;
        }
        const payload = (await response.json()) as AdminPayload;
        if (!cancelled) setData(payload);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function signOut(): Promise<void> {
    await fetch("/api/admin/logout", { method: "POST", credentials: "same-origin" }).catch(
      () => undefined,
    );
    router.replace("/admin/login");
  }

  const number = (value: number): string =>
    new Intl.NumberFormat(LOCALE_INFO[locale].intl).format(value);
  const percent = (part: number, whole: number): number =>
    whole > 0 ? Math.round((part / whole) * 100) : 0;
  const topicLabel = (topic: string): string => {
    const key = `admin.topic.${topic}`;
    return hasMessage(key) ? t(key) : topic;
  };

  const usage = data?.usage;
  const system = data?.system;
  const total = usage?.totalQuestions ?? 0;
  const top = usage?.byTopic.find((row) => row.topic !== "none");
  const ai = usage?.byMode.find((row) => row.mode === "ai")?.count ?? 0;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-5 py-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Logo className="size-10" />
          <h1 className="text-2xl font-semibold tracking-tight">{t("admin.title")}</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-56">
            <LanguagePicker compact />
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            className="text-sm font-semibold text-accent"
          >
            {t("admin.signOut")}
          </button>
        </div>
      </header>

      <p className="rounded-2xl border border-border bg-accent-soft px-4 py-3 text-sm">
        {t("admin.anonymous")}
      </p>

      {data && usage && system ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label={t("admin.questions")} value={number(total)} />
            <Stat label={t("admin.aiShare")} value={`${percent(ai, total)} %`} />
            <Stat label={t("admin.unanswered")} value={`${percent(usage.unanswered, total)} %`} />
            <Stat label={t("admin.consent")} value={number(usage.consentAccepted)} />
            <Stat label={t("admin.goals")} value={number(usage.goalsSet)} />
            <Stat label={t("admin.advisor.stat")} value={number(usage.advisorRequests)} />
            <Stat label={t("admin.withdrawn")} value={number(usage.consentWithdrawn)} />
            <Stat label={t("admin.sessions")} value={number(system.activeSessions)} />
          </div>

          <Panel title={t("admin.controls")}>
            <AdminControls
              settings={data.settings}
              requestsToday={data.ai.requestsToday}
              onSaved={(settings) => setData({ ...data, settings })}
            />
          </Panel>

          <div className="grid gap-5 md:grid-cols-2">
            <Panel title={t("admin.aiUsage")}>
              {data.ai.last30.requests === 0 ? (
                <p className="text-sm text-muted">{t("admin.aiUsage.empty")}</p>
              ) : (
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
                      { label: t("admin.aiUsage.today"), ...data.ai.today },
                      { label: t("admin.aiUsage.month"), ...data.ai.last30 },
                      ...data.ai.byModel.map((row) => ({ label: row.model, ...row })),
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
              )}
              <p className="text-xs text-muted">{t("admin.aiUsage.note")}</p>
            </Panel>

            <Panel title={t("admin.themes")}>
              {usage.unansweredThemes.length === 0 ? (
                <p className="text-sm text-muted">{t("admin.themes.empty")}</p>
              ) : (
                <Bars
                  rows={usage.unansweredThemes.map((row) => ({
                    label: hasMessage(`admin.theme.${row.topic}`)
                      ? t(`admin.theme.${row.topic}` as MessageKey)
                      : row.topic,
                    count: row.count,
                  }))}
                />
              )}
              <p className="text-xs text-muted">{t("admin.themes.note")}</p>
            </Panel>
          </div>

          <Panel title={t("admin.workload")}>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat label={t("admin.workload.open")} value={number(data.workload.open)} />
              <Stat
                label={t("admin.workload.needsReply")}
                value={number(data.workload.needsReply)}
              />
              <Stat label={t("admin.workload.closed")} value={number(data.workload.closed)} />
              <Stat
                label={t("admin.workload.firstReply")}
                value={
                  data.workload.averageFirstReplyMinutes === null
                    ? "—"
                    : t("admin.workload.minutes", {
                        minutes: data.workload.averageFirstReplyMinutes,
                      })
                }
              />
            </div>
            <Bars
              rows={[
                ...data.workload.byTopic.map((row) => ({
                  label: t(`advisor.topic.${row.topic}` as MessageKey),
                  count: row.count,
                })),
                { label: t("admin.workload.free"), count: data.workload.free },
                { label: t("admin.workload.paid"), count: data.workload.paid },
              ]}
            />
          </Panel>

          <Panel title={t("admin.advisor")}>
            <AdvisorQueue />
          </Panel>

          <Panel title={t("admin.announcements")}>
            <Announcements />
          </Panel>

          <div className="grid gap-5 md:grid-cols-2">
            <Panel title={t("admin.usage")}>
              {total === 0 ? (
                <p className="text-sm text-muted">{t("admin.usage.empty")}</p>
              ) : (
                <Bars
                  rows={usage.byTopic.map((row) => ({
                    label: topicLabel(row.topic),
                    count: row.count,
                    note: `${number(row.count)} · ${percent(row.count, total)} %`,
                  }))}
                />
              )}
            </Panel>

            <div className="flex flex-col gap-5">
              <Panel title={t("admin.value")}>
                {total === 0 ? (
                  <p className="text-sm text-muted">{t("admin.usage.empty")}</p>
                ) : (
                  <ul className="flex flex-col gap-2 text-sm">
                    {top ? (
                      <li>
                        {t("admin.value.top", {
                          topic: topicLabel(top.topic),
                          percent: percent(top.count, total),
                        })}
                      </li>
                    ) : null}
                    <li>
                      {t("admin.value.unanswered", { percent: percent(usage.unanswered, total) })}
                    </li>
                    <li>
                      {t("admin.value.consent", {
                        accepted: usage.consentAccepted,
                        withdrawn: usage.consentWithdrawn,
                      })}
                    </li>
                  </ul>
                )}
              </Panel>
              <Panel title={t("admin.byLanguage")}>
                <Bars
                  rows={usage.byLocale.map((row) => ({
                    label: isLocale(row.locale)
                      ? `${LOCALE_INFO[row.locale].flag} ${LOCALE_INFO[row.locale].label}`
                      : row.locale,
                    count: row.count,
                  }))}
                />
              </Panel>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <Panel title={t("admin.how")}>
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
            </Panel>

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
                <dt className="text-muted">{t("admin.checksum")}</dt>
                <dd className="truncate font-mono text-xs">
                  {system.sourceChecksum?.slice(0, 16)}…
                </dd>
              </dl>
            </Panel>
          </div>

          <Panel title={t("admin.spendingByAge")}>
            <Bars
              rows={system.spendingByAge.map((row) => ({
                label: `${row.ageBand} (${number(row.groupSize)})`,
                count: row.medianCents,
                note: formatMoney(row.medianCents, locale),
              }))}
            />
            <p className="text-xs text-muted">{t("admin.spendingByAge.note")}</p>
          </Panel>

          <Panel title={t("admin.audit")}>
            {data.audit.length === 0 ? (
              <p className="text-sm text-muted">{t("admin.audit.empty")}</p>
            ) : (
              <ul className="flex max-h-72 flex-col divide-y divide-border overflow-y-auto text-sm">
                {data.audit.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex flex-wrap items-baseline justify-between gap-x-4 py-2"
                  >
                    <span>
                      {hasMessage(`admin.audit.${entry.action}`)
                        ? t(`admin.audit.${entry.action}` as MessageKey)
                        : entry.action}
                      {entry.detail ? <span className="text-muted"> · {entry.detail}</span> : null}
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
      ) : null}
    </main>
  );
}
