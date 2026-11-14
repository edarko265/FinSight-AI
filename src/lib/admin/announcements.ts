import "server-only";

import { randomUUID } from "node:crypto";

import { getDb } from "@/lib/db/client";

/** Notices written by staff and shown to every customer among their insights. */
export interface Announcement {
  id: string;
  title: string;
  body: string;
  severity: "info" | "warning" | "good";
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  /** How many customers have seen it. */
  views: number;
  /** When it becomes visible to customers. Null means at once. */
  publishAt: string | null;
  /** Finnish and Swedish wording. A language left empty falls back to the main text. */
  translations: Translations;
}

type Translations = Partial<Record<"fi" | "sv", { title: string; body: string }>>;

type Row = {
  id: string;
  title: string;
  body: string;
  severity: Announcement["severity"];
  created_at: string | Date;
  updated_at: string | Date;
  deleted_at: string | Date | null;
  views: number | string;
  publish_at: string | Date | null;
  translations: string;
};

const COLUMNS =
  "id, title, body, severity, created_at, updated_at, deleted_at, views, publish_at, translations";
const toAnnouncement = (row: Row): Announcement => ({
  id: row.id,
  title: row.title,
  body: row.body,
  severity: row.severity,
  createdAt: new Date(row.created_at).toISOString(),
  updatedAt: new Date(row.updated_at).toISOString(),
  deletedAt: row.deleted_at ? new Date(row.deleted_at).toISOString() : null,
  views: Number(row.views),
  publishAt: row.publish_at ? new Date(row.publish_at).toISOString() : null,
  translations: parseTranslations(row.translations),
});

function parseTranslations(raw: string): Translations {
  try {
    return JSON.parse(raw) as Translations;
  } catch {
    return {};
  }
}

/** The announcement in the customer's language, falling back to the main text. */
export function localise(notice: Announcement, locale: string): { title: string; body: string } {
  const own = locale === "fi" || locale === "sv" ? notice.translations[locale] : undefined;
  return { title: own?.title || notice.title, body: own?.body || notice.body };
}

export type AnnouncementInput = Pick<Announcement, "title" | "body" | "severity"> & {
  publishAt?: string | null;
  translations?: Translations;
};

/** Everything, including the recycle bin, for staff. */
export async function listAnnouncements(): Promise<Announcement[]> {
  const db = await getDb();
  return (
    await db.query<Row>(`SELECT ${COLUMNS} FROM announcements ORDER BY created_at DESC LIMIT 100`)
  ).map(toAnnouncement);
}

/** What customers see: published and not deleted. */
export async function activeAnnouncements(): Promise<Announcement[]> {
  const db = await getDb();
  return (
    await db.query<Row>(
      `SELECT ${COLUMNS} FROM announcements
       WHERE deleted_at IS NULL AND (publish_at IS NULL OR publish_at <= now())
       ORDER BY COALESCE(publish_at, created_at) DESC LIMIT 10`,
    )
  ).map(toAnnouncement);
}

/** Creates an announcement. Returns true when it is visible at once (not scheduled for later). */
export async function createAnnouncement(input: AnnouncementInput): Promise<boolean> {
  const db = await getDb();
  const later = Boolean(input.publishAt && Date.parse(input.publishAt) > Date.now());
  await db.query(
    `INSERT INTO announcements (id, title, body, severity, publish_at, translations, pushed_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      randomUUID(),
      input.title,
      input.body,
      input.severity,
      later ? input.publishAt : null,
      JSON.stringify(input.translations ?? {}),
      // One sent at once is pushed by the caller; a scheduled one is pushed when its time comes.
      later ? null : new Date().toISOString(),
    ],
  );
  return !later;
}

export async function updateAnnouncement(id: string, input: AnnouncementInput): Promise<void> {
  const db = await getDb();
  await db.query(
    `UPDATE announcements SET title = $2, body = $3, severity = $4, publish_at = $5,
       translations = $6, updated_at = now() WHERE id = $1`,
    [
      id,
      input.title,
      input.body,
      input.severity,
      input.publishAt ?? null,
      JSON.stringify(input.translations ?? {}),
    ],
  );
}

/** Scheduled announcements whose time has come and which have not been sent to devices yet. */
export async function takeDueAnnouncements(): Promise<Announcement[]> {
  const db = await getDb();
  const rows = await db.query<Row>(
    `UPDATE announcements SET pushed_at = now()
     WHERE deleted_at IS NULL AND pushed_at IS NULL AND publish_at <= now()
     RETURNING ${COLUMNS}`,
  );
  return rows.map(toAnnouncement);
}

/** Moves to the recycle bin, restores from it, or removes for good. */
export async function setAnnouncementState(
  id: string,
  action: "trash" | "restore" | "purge",
): Promise<void> {
  const db = await getDb();
  if (action === "purge") {
    await db.query("DELETE FROM announcements WHERE id = $1 AND deleted_at IS NOT NULL", [id]);
  } else {
    await db.query(
      `UPDATE announcements SET deleted_at = ${action === "trash" ? "now()" : "NULL"}, updated_at = now() WHERE id = $1`,
      [id],
    );
  }
}

/** Counts one more customer as having seen each of these announcements. */
export async function countAnnouncementViews(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDb();
  for (const id of ids) {
    await db.query("UPDATE announcements SET views = views + 1 WHERE id = $1", [id]);
  }
}
