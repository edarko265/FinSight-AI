import "server-only";

import { randomUUID } from "node:crypto";

import { themeOf } from "@/lib/admin/themes";
import { getDb } from "@/lib/db/client";

/**
 * Answers the bank's staff have taught the coach.
 *
 * When a question has no calculation behind it (loans, insurance, how to
 * dispute a card payment), the coach would otherwise say it cannot help.
 * Staff see those gaps by theme in the admin area and write the answer the
 * coach should have given. From then on the coach gives it, word for word,
 * labelled as coming from the bank's team. Nothing is generated: what staff
 * approved is what customers read.
 */
export interface TaughtAnswer {
  id: string;
  /** One of the unanswered-question themes, for example "loans". */
  theme: string;
  /** Words or phrases that pick this answer over the theme's general one. */
  keywords: string[];
  answers: { en: string; fi: string; sv: string };
  /** How many times the coach has given it. */
  uses: number;
  updatedAt: string;
  deletedAt: string | null;
}

type Row = {
  id: string;
  theme: string;
  keywords: string;
  answer_en: string;
  answer_fi: string;
  answer_sv: string;
  uses: number | string;
  updated_at: string | Date;
  deleted_at: string | Date | null;
};

const COLUMNS =
  "id, theme, keywords, answer_en, answer_fi, answer_sv, uses, updated_at, deleted_at";

const splitKeywords = (text: string): string[] =>
  text
    .split(",")
    .map((word) => word.trim().toLowerCase())
    .filter(Boolean);

const toAnswer = (row: Row): TaughtAnswer => ({
  id: row.id,
  theme: row.theme,
  keywords: splitKeywords(row.keywords),
  answers: { en: row.answer_en, fi: row.answer_fi, sv: row.answer_sv },
  uses: Number(row.uses),
  updatedAt: new Date(row.updated_at).toISOString(),
  deletedAt: row.deleted_at ? new Date(row.deleted_at).toISOString() : null,
});

export interface TaughtInput {
  theme: string;
  keywords: string[];
  answers: { en: string; fi: string; sv: string };
}

/** Everything, including the recycle bin, for staff. */
export async function listTaught(): Promise<TaughtAnswer[]> {
  const db = await getDb();
  return (
    await db.query<Row>(`SELECT ${COLUMNS} FROM coach_answers ORDER BY updated_at DESC LIMIT 200`)
  ).map(toAnswer);
}

export async function createTaught(input: TaughtInput): Promise<void> {
  const db = await getDb();
  await db.query(
    "INSERT INTO coach_answers (id, theme, keywords, answer_en, answer_fi, answer_sv) VALUES ($1, $2, $3, $4, $5, $6)",
    [
      randomUUID(),
      input.theme,
      input.keywords.join(", "),
      input.answers.en,
      input.answers.fi,
      input.answers.sv,
    ],
  );
}

export async function updateTaught(id: string, input: TaughtInput): Promise<void> {
  const db = await getDb();
  await db.query(
    "UPDATE coach_answers SET theme = $2, keywords = $3, answer_en = $4, answer_fi = $5, answer_sv = $6, updated_at = now() WHERE id = $1",
    [
      id,
      input.theme,
      input.keywords.join(", "),
      input.answers.en,
      input.answers.fi,
      input.answers.sv,
    ],
  );
}

export async function setTaughtState(
  id: string,
  action: "trash" | "restore" | "purge",
): Promise<void> {
  const db = await getDb();
  if (action === "purge") {
    await db.query("DELETE FROM coach_answers WHERE id = $1 AND deleted_at IS NOT NULL", [id]);
  } else {
    await db.query(
      `UPDATE coach_answers SET deleted_at = ${action === "trash" ? "now()" : "NULL"}, updated_at = now() WHERE id = $1`,
      [id],
    );
  }
}

/**
 * Picks the taught answer for a question, or none.
 *
 * 1. An answer whose keyword appears in the question wins; among several, the
 *    one matching the longest keyword (the most specific).
 * 2. Otherwise the general answer (no keywords) for the question's theme.
 * 3. The text is given in the customer's language, falling back to English,
 *    then to whichever language staff wrote.
 */
export function pickTaught(
  candidates: TaughtAnswer[],
  question: string,
  locale: string,
): { id: string; text: string } | null {
  const text = question.toLowerCase();
  const live = candidates.filter((candidate) => !candidate.deletedAt);
  let best: TaughtAnswer | null = null;
  let bestLength = 0;
  for (const candidate of live) {
    for (const keyword of candidate.keywords) {
      if (keyword.length > bestLength && text.includes(keyword)) {
        best = candidate;
        bestLength = keyword.length;
      }
    }
  }
  if (!best) {
    const theme = themeOf(question);
    best =
      live.find((candidate) => candidate.theme === theme && candidate.keywords.length === 0) ??
      null;
  }
  if (!best) return null;
  const { en, fi, sv } = best.answers;
  const wording = (locale === "fi" ? fi : locale === "sv" ? sv : en) || en || fi || sv;
  return wording ? { id: best.id, text: wording } : null;
}

/** The taught answer for this question, counted as used. Never throws: the coach must still answer. */
export async function findTaught(question: string, locale: string): Promise<string | null> {
  try {
    const db = await getDb();
    const rows = await db.query<Row>(
      `SELECT ${COLUMNS} FROM coach_answers WHERE deleted_at IS NULL`,
    );
    const picked = pickTaught(rows.map(toAnswer), question, locale);
    if (!picked) return null;
    await db.query("UPDATE coach_answers SET uses = uses + 1 WHERE id = $1", [picked.id]);
    return picked.text;
  } catch (error) {
    console.error(
      "coach: taught answers unavailable:",
      error instanceof Error ? error.name : "error",
    );
    return null;
  }
}
