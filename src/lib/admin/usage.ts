import "server-only";

import { getDb } from "@/lib/db/client";

/**
 * Anonymous usage counting. Records only what kind of thing happened, in which
 * language, and whether AI was used: never who asked or what they typed.
 */
export type UsageKind =
  "question" | "consent" | "goal" | "voice" | "widget" | "advisor" | "unanswered" | "grounding";

export async function recordUsage(
  kind: UsageKind,
  topic: string,
  locale: string,
  mode = "n/a",
): Promise<void> {
  try {
    const db = await getDb();
    await db.query(
      `INSERT INTO usage_events (day, kind, topic, locale, mode, count) VALUES (CURRENT_DATE, $1, $2, $3, $4, 1)
       ON CONFLICT (day, kind, topic, locale, mode) DO UPDATE SET count = usage_events.count + 1`,
      [kind, topic.slice(0, 40), locale.slice(0, 8), mode.slice(0, 8)],
    );
  } catch (error) {
    // Counting must never break the feature being counted.
    console.error("usage: could not record:", error instanceof Error ? error.name : "error");
  }
}

export interface UsageSummary {
  totalQuestions: number;
  byTopic: { topic: string; count: number }[];
  byLocale: { locale: string; count: number }[];
  byMode: { mode: string; count: number }[];
  daily: { day: string; count: number }[];
  unanswered: number;
  consentAccepted: number;
  consentWithdrawn: number;
  goalsSet: number;
  voiceUses: number;
  widgetsPinned: number;
  advisorRequests: number;
  /** AI answers whose wording was replaced because it stated an amount no calculation produced. */
  groundingCorrections: number;
  /** Questions the coach had no calculation for, by broad theme. */
  unansweredThemes: { topic: string; count: number }[];
}

export async function usageSummary(): Promise<UsageSummary> {
  const db = await getDb();
  const rows = await db.query<{
    day: string | Date;
    kind: string;
    topic: string;
    locale: string;
    mode: string;
    count: number;
  }>(
    "SELECT day, kind, topic, locale, mode, count FROM usage_events WHERE day > CURRENT_DATE - 30",
  );
  const sum = (map: Map<string, number>, key: string, count: number): void => {
    map.set(key, (map.get(key) ?? 0) + count);
  };
  const topics = new Map<string, number>();
  const locales = new Map<string, number>();
  const modes = new Map<string, number>();
  const days = new Map<string, number>();
  const kinds = new Map<string, number>();
  const themes = new Map<string, number>();
  for (const row of rows) {
    const count = Number(row.count);
    sum(kinds, row.kind === "consent" ? `consent:${row.topic}` : row.kind, count);
    if (row.kind === "unanswered") sum(themes, row.topic, count);
    if (row.kind !== "question") continue;
    sum(topics, row.topic, count);
    sum(locales, row.locale, count);
    sum(modes, row.mode, count);
    sum(
      days,
      row.day instanceof Date ? row.day.toISOString().slice(0, 10) : String(row.day).slice(0, 10),
      count,
    );
  }
  const list = <K extends string>(map: Map<string, number>, key: K) =>
    [...map.entries()]
      .map(([name, count]) => ({ [key]: name, count }) as Record<K, string> & { count: number })
      .sort((a, b) => b.count - a.count);
  return {
    totalQuestions: kinds.get("question") ?? 0,
    byTopic: list(topics, "topic"),
    byLocale: list(locales, "locale"),
    byMode: list(modes, "mode"),
    daily: [...days.entries()]
      .map(([day, count]) => ({ day, count }))
      .sort((a, b) => a.day.localeCompare(b.day)),
    // Every question with no calculation behind it, not only the ones nothing matched at all.
    unanswered: [...themes.values()].reduce((total, value) => total + value, 0),
    consentAccepted: kinds.get("consent:accepted") ?? 0,
    consentWithdrawn: kinds.get("consent:withdrawn") ?? 0,
    goalsSet: kinds.get("goal") ?? 0,
    voiceUses: kinds.get("voice") ?? 0,
    widgetsPinned: kinds.get("widget") ?? 0,
    advisorRequests: kinds.get("advisor") ?? 0,
    groundingCorrections: kinds.get("grounding") ?? 0,
    unansweredThemes: list(themes, "topic"),
  };
}
