"use client";

import Link from "next/link";

import { usePreferences } from "@/components/providers/PreferencesProvider";
import { useLoad } from "@/components/shared/useLoad";
import { LoadError } from "@/components/ui/LoadError";
import { LoadingRegion, SkeletonCard } from "@/components/ui/Skeleton";
import { api } from "@/lib/api-client";
import { formatDay, formatMoney } from "@/lib/i18n/config";
import { hasMessage, type MessageKey } from "@/lib/i18n/translate";
import { InfoTip } from "@/components/ui/InfoTip";

interface Event {
  date: string;
  type: string;
  propertyType?: string;
  priceCents?: number;
  loanCents?: number;
  equityCents?: number;
  collateralValueCents?: number;
  collateralStatus?: string;
  decision?: string;
  rejectionReason?: string;
  expenseType?: string;
  expenseCents?: number;
}

interface Payload {
  stats: {
    applications: number;
    approved: number;
    rejected: number;
    reasons: Record<string, number>;
    days: { median: number; min: number; max: number };
    medianEvents: number;
    medianProperties: number;
    medianLoanToValuePercent: number;
    medianEquityPercent: number;
    stageDay: Record<string, number>;
    stageShare: Record<string, number>;
    expenses: Record<string, { applications: number; medianCents: number }>;
  } | null;
  story: {
    events: Event[];
    outcome: {
      decision: "approved" | "rejected";
      rejectionReason: string | null;
      priceCents: number;
      loanCents: number;
      equityCents: number;
      collateralCents: number;
      requiredMonthlyIncomeCents: number;
      loanToValuePercent: number;
    };
  } | null;
}

/** The steps in the order a customer meets them. Contact with the bank runs through all of them. */
const STEPS = [
  "application_created",
  "property_added",
  "loan_calculation",
  "income_information_received",
  "document_received",
  "collateral_added",
  "collateral_valuation",
  "additional_collateral_requested",
  "expense_recorded",
  "loan_decision",
] as const;

/**
 * What a mortgage application looks like, taught from the applications in the
 * bank's dataset, with the customer's own application shown if they have one.
 * It explains; it does not predict or advise.
 */
export function MortgageView(): React.JSX.Element {
  const { t, locale } = usePreferences();
  const { data, failed, retry, headingRef } = useLoad(() => api<Payload>("/api/mortgage"));

  const money = (cents: number): string => formatMoney(cents, locale);
  const text = (prefix: string, value: string): string =>
    hasMessage(`${prefix}.${value}`)
      ? t(`${prefix}.${value}` as MessageKey)
      : value.replaceAll("_", " ");
  const card = "rounded-2xl border border-border bg-surface p-4";
  const stats = data?.stats;
  const story = data?.story;
  const share = (part: number, whole: number): number =>
    whole > 0 ? Math.round((part / whole) * 100) : 0;

  function detail(event: Event): string {
    const parts: string[] = [];
    if (event.propertyType) parts.push(text("mortgage.property", event.propertyType));
    if (event.priceCents) parts.push(`${t("mortgage.figure.price")} ${money(event.priceCents)}`);
    if (event.loanCents) parts.push(`${t("mortgage.figure.loan")} ${money(event.loanCents)}`);
    if (event.equityCents) parts.push(`${t("mortgage.figure.equity")} ${money(event.equityCents)}`);
    if (event.collateralValueCents)
      parts.push(`${t("mortgage.figure.collateral")} ${money(event.collateralValueCents)}`);
    if (event.expenseType)
      parts.push(
        `${text("mortgage.expense", event.expenseType)} ${money(event.expenseCents ?? 0)}`,
      );
    if (event.decision) parts.push(text("mortgage.decision", event.decision));
    if (event.rejectionReason) parts.push(text("mortgage.reason", event.rejectionReason));
    return parts.join(" · ");
  }

  return (
    <div className="flex flex-col gap-5 px-4 py-4">
      <h1 ref={headingRef} tabIndex={-1} className="text-xl font-semibold focus:outline-none">
        {t("mortgage.title")}
      </h1>
      <p className="rounded-2xl border border-border bg-accent-soft px-4 py-3 text-sm">
        {t("mortgage.disclaimer")}
      </p>
      {failed ? <LoadError onRetry={retry} /> : null}

      {story ? (
        <section className={`${card} flex flex-col gap-3`}>
          <h2 className="text-base font-semibold">{t("mortgage.yours")}</h2>
          <p
            className={`self-start rounded-full px-3 py-1 text-sm font-semibold ${
              story.outcome.decision === "approved"
                ? "bg-accent-soft text-accent"
                : "bg-warning-soft text-warning"
            }`}
          >
            {text("mortgage.decision", story.outcome.decision)}
            {story.outcome.rejectionReason
              ? ` · ${text("mortgage.reason", story.outcome.rejectionReason)}`
              : ""}
          </p>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            {(
              [
                ["mortgage.figure.price", story.outcome.priceCents],
                ["mortgage.figure.loan", story.outcome.loanCents],
                ["mortgage.figure.equity", story.outcome.equityCents],
                ["mortgage.figure.collateral", story.outcome.collateralCents],
                ["mortgage.figure.income", story.outcome.requiredMonthlyIncomeCents],
              ] as [MessageKey, number][]
            ).map(([key, cents]) => (
              <div key={key} className="rounded-xl border border-border p-3">
                <dt className="text-sm text-muted">{t(key)}</dt>
                <dd className="mt-0.5 font-semibold tabular-nums">{money(cents)}</dd>
              </div>
            ))}
            <div className="rounded-xl border border-border p-3">
              <dt className="text-sm text-muted">{t("mortgage.figure.ltv")}</dt>
              <dd className="mt-0.5 font-semibold tabular-nums">
                {story.outcome.loanToValuePercent} %
              </dd>
            </div>
          </dl>
          {story.outcome.rejectionReason ? (
            <p className="text-sm text-muted">
              {text("mortgage.reason.explain", story.outcome.rejectionReason)}
            </p>
          ) : null}
          <details>
            <summary className="cursor-pointer text-sm font-semibold text-accent">
              {t("mortgage.timeline", { count: story.events.length })}
            </summary>
            <ol className="mt-3 flex flex-col gap-2 border-l-2 border-border pl-4 text-sm">
              {story.events.map((event, index) => (
                <li key={`${event.date}-${index}`}>
                  <span className="text-sm text-muted">{formatDay(event.date, locale)}</span>
                  <span className="block font-medium">{text("mortgage.event", event.type)}</span>
                  {detail(event) ? <span className="block text-muted">{detail(event)}</span> : null}
                </li>
              ))}
            </ol>
          </details>
        </section>
      ) : null}

      {stats ? (
        <>
          <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {(
              [
                ["mortgage.stat.days", t("mortgage.stat.days.value", stats.days)],
                ["mortgage.stat.steps", String(stats.medianEvents)],
                ["mortgage.stat.properties", String(stats.medianProperties)],
                ["mortgage.stat.approved", `${share(stats.approved, stats.applications)} %`],
                ["mortgage.stat.ltv", `${stats.medianLoanToValuePercent} %`],
                ["mortgage.stat.equity", `${stats.medianEquityPercent} %`],
              ] as [MessageKey, string][]
            ).map(([key, value]) => (
              <div key={key} className={card}>
                <p className="text-sm text-muted">{t(key)}</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
              </div>
            ))}
          </section>
          <p className="text-sm text-muted">
            {t("mortgage.stat.note", { count: stats.applications })}
          </p>

          <section className={`${card} flex flex-col gap-3`}>
            <h2 className="text-base font-semibold">{t("mortgage.steps")}</h2>
            <ol className="flex flex-col gap-3">
              {STEPS.filter((step) => stats.stageShare[step] !== undefined).map((step, index) => (
                <li key={step} className="flex gap-3 text-sm">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-semibold text-on-brand">
                    {index + 1}
                  </span>
                  <span>
                    <span className="block font-semibold">{text("mortgage.event", step)}</span>
                    <span className="block text-muted">{text("mortgage.step", step)}</span>
                    <span className="block text-sm text-muted">
                      {t("mortgage.step.when", {
                        day: stats.stageDay[step] ?? 0,
                        share: stats.stageShare[step] ?? 0,
                      })}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <section className={`${card} flex flex-col gap-3`}>
            <h2 className="text-base font-semibold">{t("mortgage.costs")}</h2>
            <InfoTip>{t("mortgage.costs.note")}</InfoTip>
            <ul className="flex flex-col divide-y divide-border text-sm">
              {Object.entries(stats.expenses)
                .sort((a, b) => b[1].medianCents - a[1].medianCents)
                .map(([type, value]) => (
                  <li key={type} className="flex items-baseline justify-between gap-3 py-2">
                    <span>
                      {text("mortgage.expense", type)}
                      <span className="block text-sm text-muted">
                        {t("mortgage.costs.share", {
                          share: share(value.applications, stats.applications),
                        })}
                      </span>
                    </span>
                    <span className="shrink-0 font-medium tabular-nums">
                      {money(value.medianCents)}
                    </span>
                  </li>
                ))}
            </ul>
          </section>

          <section className={`${card} flex flex-col gap-3`}>
            <h2 className="text-base font-semibold">{t("mortgage.reasons")}</h2>
            <p className="text-sm text-muted">
              {t("mortgage.reasons.note", { rejected: stats.rejected, total: stats.applications })}
            </p>
            <ul className="flex flex-col gap-3 text-sm">
              {Object.entries(stats.reasons)
                .sort((a, b) => b[1] - a[1])
                .map(([reason, count]) => (
                  <li key={reason}>
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="font-semibold">{text("mortgage.reason", reason)}</span>
                      <span className="shrink-0 tabular-nums text-muted">
                        {count} · {share(count, stats.rejected)} %
                      </span>
                    </span>
                    <span
                      className="mt-1 block h-2 overflow-hidden rounded-full bg-border"
                      aria-hidden="true"
                    >
                      <span
                        className="block h-full rounded-full bg-accent"
                        style={{ width: `${share(count, stats.rejected)}%` }}
                      />
                    </span>
                    <span className="mt-1 block text-muted">
                      {text("mortgage.reason.explain", reason)}
                    </span>
                  </li>
                ))}
            </ul>
          </section>
        </>
      ) : data ? (
        <p className="rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted">
          {t("mortgage.noStats")}
        </p>
      ) : failed ? null : (
        <LoadingRegion className="flex flex-col gap-5">
          <SkeletonCard />
          <SkeletonCard />
        </LoadingRegion>
      )}

      <Link
        href="/advisor"
        className="self-start rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary"
      >
        {t("mortgage.talk")}
      </Link>
    </div>
  );
}
