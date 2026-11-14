"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { usePreferences } from "@/components/providers/PreferencesProvider";
import { formatDay, LOCALE_INFO } from "@/lib/i18n/config";

const COLOURS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
];

function useNumber(): (value: number) => string {
  const { locale } = usePreferences();
  return (value) => new Intl.NumberFormat(LOCALE_INFO[locale].intl).format(value);
}

/** A headline number. With `href` it is a link to the section that explains it. */
export function Stat({
  label,
  value,
  note,
  href,
  tone,
}: {
  label: string;
  value: string;
  /** A second line that puts the number in context, for example "12 of 40". */
  note?: string;
  href?: string;
  /** "warning" marks a number that needs someone's attention. */
  tone?: "warning";
}): React.JSX.Element {
  const { t } = usePreferences();
  const body = (
    <>
      <p className="text-xs text-muted">{label}</p>
      <p
        className={`mt-1 text-xl font-semibold tabular-nums ${tone === "warning" ? "text-warning" : ""}`}
      >
        {value}
      </p>
      {note ? <p className="mt-0.5 text-xs text-muted tabular-nums">{note}</p> : null}
      {href ? <p className="mt-2 text-xs font-semibold text-accent">{t("admin.open")} →</p> : null}
    </>
  );
  const frame = "block h-full rounded-2xl border border-border bg-surface p-4";
  return href ? (
    <Link
      href={href}
      className={`${frame} transition-colors hover:border-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none`}
    >
      {body}
    </Link>
  ) : (
    <div className={frame}>{body}</div>
  );
}

export function Panel({
  title,
  href,
  action,
  children,
}: {
  title: string;
  /** When set, the panel links to the section with the full view. */
  href?: string;
  /** A control shown beside the title, for example a download button. */
  action?: React.ReactNode;
  children: React.ReactNode;
}): React.JSX.Element {
  const { t } = usePreferences();
  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-2xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold">{title}</h2>
        {action}
        {href ? (
          <Link href={href} className="shrink-0 text-sm font-semibold text-accent">
            {t("admin.open")} →
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/**
 * Horizontal bars. Every row states its number and its share of the total;
 * with `href` a row opens the page where something can be done about it.
 */
export function Bars({
  rows,
  share = true,
}: {
  rows: { label: string; count: number; note?: string; href?: string }[];
  /** Whether to show each row's share of the total. Off when rows are not parts of a whole. */
  share?: boolean;
}): React.JSX.Element {
  const { t } = usePreferences();
  const number = useNumber();
  if (rows.length === 0) return <p className="text-sm text-muted">{t("admin.chart.empty")}</p>;
  const max = Math.max(1, ...rows.map((row) => row.count));
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  return (
    <ul className="flex flex-col gap-1">
      {rows.map((row) => {
        const value =
          row.note ??
          (share && total > 0
            ? `${number(row.count)} · ${Math.round((row.count / total) * 100)} %`
            : number(row.count));
        const body = (
          <>
            <span className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">{row.label}</span>
              <span className="shrink-0 font-medium tabular-nums">{value}</span>
            </span>
            <span
              className="mt-1 block h-2.5 overflow-hidden rounded-full bg-border"
              aria-hidden="true"
            >
              <span
                className="fs-grow-x block h-full rounded-full bg-accent"
                style={{ width: `${(row.count / max) * 100}%` }}
              />
            </span>
          </>
        );
        return (
          <li key={row.label}>
            {row.href ? (
              <Link
                href={row.href}
                className="block rounded-lg px-2 py-1.5 hover:bg-background focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
              >
                {body}
              </Link>
            ) : (
              <div className="rounded-lg px-2 py-1.5 hover:bg-background">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Every day of the 30 days ending on the latest point, so a quiet day shows
 * as a gap and a single busy day does not fill the whole chart.
 */
function fillDays(
  points: { day: string; count: number }[],
  span: number,
): { day: string; count: number }[] {
  const sorted = [...points].sort((a, b) => a.day.localeCompare(b.day));
  const last = sorted.at(-1);
  if (!last) return [];
  const known = new Map(sorted.map((point) => [point.day.slice(0, 10), point.count]));
  const days: { day: string; count: number }[] = [];
  const cursor = new Date(`${last.day.slice(0, 10)}T00:00:00Z`);
  cursor.setUTCDate(cursor.getUTCDate() - (span - 1));
  for (let index = 0; index < span; index += 1) {
    const day = cursor.toISOString().slice(0, 10);
    days.push({ day, count: known.get(day) ?? 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

/**
 * A column per day. Point at, tap or arrow-key to a day to read its number;
 * otherwise the line above the chart gives the total, the daily average and
 * the busiest day.
 */
export function DailyChart({
  points,
  unit,
  span = 30,
}: {
  points: { day: string; count: number }[];
  unit: string;
  /** How many days the chart covers. */
  span?: number;
}): React.JSX.Element {
  const { t, locale } = usePreferences();
  const number = useNumber();
  const [active, setActive] = useState<number | null>(null);
  // Drawn at the size it is shown, so the labels stay readable on a phone and do not balloon on a desktop.
  const frame = useRef<HTMLElement>(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.max(260, Math.round(entry.contentRect.width)));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const days = fillDays(points, span);
  if (days.length === 0) return <p className="text-sm text-muted">{t("admin.chart.empty")}</p>;

  const max = Math.max(1, ...days.map((day) => day.count));
  const total = days.reduce((sum, day) => sum + day.count, 0);
  const peak = days.reduce((best, day) => (day.count > best.count ? day : best));
  const average = Math.round((total / days.length) * 10) / 10;
  const height = width < 480 ? 140 : 180;
  const left = 34;
  const step = (width - left) / days.length;
  const bar = Math.max(2, step * 0.72);
  const labelled = new Set([0, Math.floor((days.length - 1) / 2), days.length - 1]);
  const shown = active === null ? null : days[active];

  function move(event: React.KeyboardEvent<SVGSVGElement>): void {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const from = active ?? (event.key === "ArrowRight" ? -1 : days.length);
    setActive(Math.min(days.length - 1, Math.max(0, from + (event.key === "ArrowRight" ? 1 : -1))));
  }

  return (
    <figure ref={frame} className="flex flex-col gap-2">
      <figcaption
        className="flex min-h-10 flex-wrap items-baseline gap-x-5 gap-y-1 text-sm"
        aria-live="polite"
      >
        {shown ? (
          <span>
            <span className="text-muted">{formatDay(shown.day, locale)}: </span>
            <span className="font-semibold tabular-nums">{number(shown.count)}</span>{" "}
            <span className="text-muted">{unit.toLowerCase()}</span>
          </span>
        ) : (
          <>
            <span>
              <span className="text-muted">{t("admin.chart.total")}: </span>
              <span className="font-semibold tabular-nums">{number(total)}</span>
            </span>
            <span>
              <span className="text-muted">{t("admin.chart.average")}: </span>
              <span className="font-semibold tabular-nums">{number(average)}</span>
            </span>
            <span>
              <span className="text-muted">{t("admin.chart.peak")}: </span>
              <span className="font-semibold tabular-nums">
                {number(peak.count)} ({formatDay(peak.day, locale)})
              </span>
            </span>
          </>
        )}
      </figcaption>
      <svg
        viewBox={`0 0 ${width} ${height + 24}`}
        className="h-auto w-full touch-pan-y rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-accent"
        role="img"
        tabIndex={0}
        aria-label={`${unit}. ${t("admin.chart.total")}: ${total}. ${t("admin.chart.hint")}`}
        onKeyDown={move}
        onPointerLeave={() => setActive(null)}
        onBlur={() => setActive(null)}
      >
        {[max, Math.round(max / 2)].map((value) => {
          const y = height - (value / max) * (height - 8);
          return (
            <g key={value}>
              <line
                x1={left}
                x2={width}
                y1={y}
                y2={y}
                stroke="var(--border)"
                strokeDasharray="3 4"
              />
              <text x={left - 6} y={y + 4} fontSize={11} textAnchor="end" fill="var(--muted)">
                {number(value)}
              </text>
            </g>
          );
        })}
        <line x1={left} x2={width} y1={height} y2={height} stroke="var(--border)" />
        {days.map((day, index) => {
          const barHeight = day.count === 0 ? 0 : Math.max(3, (day.count / max) * (height - 8));
          const x = left + index * step;
          return (
            <g key={day.day}>
              <rect
                x={x + (step - bar) / 2}
                y={height - barHeight}
                width={bar}
                height={barHeight}
                rx={Math.min(3, bar / 2)}
                fill={day.day === peak.day && active === null ? "var(--chart-2)" : "var(--chart-1)"}
                opacity={active === null || active === index ? 1 : 0.35}
              />
              {/* The whole column is the target, so a quiet day can be read too. */}
              <rect
                x={x}
                y={0}
                width={step}
                height={height}
                fill="transparent"
                onPointerEnter={() => setActive(index)}
                onPointerDown={() => setActive(index)}
              />
              {labelled.has(index) ? (
                <text
                  x={index === 0 ? left : index === days.length - 1 ? width : x + step / 2}
                  y={height + 17}
                  fontSize={11}
                  fill="var(--muted)"
                  textAnchor={index === 0 ? "start" : index === days.length - 1 ? "end" : "middle"}
                >
                  {formatDay(day.day, locale)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

/**
 * A ring split into parts. The middle shows the total, or the number and
 * share of the part being pointed at; the legend rows do the same on tap.
 */
export function Ring({
  parts,
  unit,
}: {
  parts: { label: string; count: number }[];
  /** What is being counted, shown under the number in the middle. */
  unit?: string;
}): React.JSX.Element {
  const { t } = usePreferences();
  const number = useNumber();
  const [active, setActive] = useState<number | null>(null);
  const total = parts.reduce((sum, part) => sum + part.count, 0);
  if (total === 0) return <p className="text-sm text-muted">{t("admin.chart.empty")}</p>;
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const shown = active === null ? null : parts[active];
  return (
    <div className="flex flex-wrap items-center gap-5" onPointerLeave={() => setActive(null)}>
      <svg viewBox="0 0 140 140" className="size-36 shrink-0" aria-hidden="true">
        <g transform="rotate(-90 70 70)">
          {parts.map((part, index) => {
            const before = parts.slice(0, index).reduce((sum, earlier) => sum + earlier.count, 0);
            return (
              <circle
                key={part.label}
                cx={70}
                cy={70}
                r={radius}
                fill="none"
                stroke={COLOURS[index % COLOURS.length]}
                strokeWidth={active === index ? 26 : 20}
                opacity={active === null || active === index ? 1 : 0.35}
                strokeDasharray={`${(part.count / total) * circumference} ${circumference}`}
                strokeDashoffset={-(before / total) * circumference}
                onPointerEnter={() => setActive(index)}
                onPointerDown={() => setActive(index)}
              />
            );
          })}
        </g>
        <text
          x={70}
          y={68}
          textAnchor="middle"
          fontSize={22}
          fontWeight={600}
          fill="var(--foreground)"
        >
          {shown ? `${Math.round((shown.count / total) * 100)} %` : number(total)}
        </text>
        <text x={70} y={86} textAnchor="middle" fontSize={10} fill="var(--muted)">
          {shown ? number(shown.count) : (unit ?? t("admin.chart.total"))}
        </text>
      </svg>
      <ul className="flex min-w-40 flex-1 flex-col gap-0.5 text-sm">
        {parts.map((part, index) => (
          <li key={part.label}>
            <button
              type="button"
              onPointerEnter={() => setActive(index)}
              onFocus={() => setActive(index)}
              onBlur={() => setActive(null)}
              onClick={() => setActive(index)}
              className={`flex w-full items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                active === index ? "bg-background" : ""
              }`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: COLOURS[index % COLOURS.length] }}
                  aria-hidden="true"
                />
                <span className="truncate">{part.label}</span>
              </span>
              <span className="shrink-0 font-medium tabular-nums">
                {number(part.count)} · {Math.round((part.count / total) * 100)} %
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** How much of a limit has been used, in words and as a bar that turns to the warning colour near the end. */
export function Meter({
  used,
  limit,
  label,
}: {
  used: number;
  limit: number;
  label: string;
}): React.JSX.Element {
  const number = useNumber();
  const share = limit > 0 ? Math.min(1, used / limit) : 0;
  return (
    <div className="flex flex-col gap-1.5">
      <p className="flex items-baseline justify-between gap-3 text-sm">
        <span>{label}</span>
        <span className="font-medium tabular-nums">
          {number(used)} / {number(limit)} · {Math.round(share * 100)} %
        </span>
      </p>
      <div
        className="h-3 overflow-hidden rounded-full bg-border"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={Math.min(used, limit)}
      >
        <div
          className={`h-full rounded-full ${share >= 0.8 ? "bg-warning" : "bg-accent"}`}
          style={{ width: `${share * 100}%` }}
        />
      </div>
    </div>
  );
}
