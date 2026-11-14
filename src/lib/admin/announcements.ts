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
}

type Row = {
  id: string;
  title: string;
  body: string;
  severity: Announcement["severity"];
  created_at: string | Date;
  updated_at: string | Date;
  deleted_at: string | Date | null;
};

const COLUMNS = "id, title, body, severity, created_at, updated_at, deleted_at";
const toAnnouncement = (row: Row): Announcement => ({
  id: row.id,
  title: row.title,
  body: row.body,
  severity: row.severity,
  createdAt: new Date(row.created_at).toISOString(),
  updatedAt: new Date(row.updated_at).toISOString(),
  deletedAt: row.deleted_at ? new Date(row.deleted_at).toISOString() : null,
});

export type AnnouncementInput = Pick<Announcement, "title" | "body" | "severity">;

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
      `SELECT ${COLUMNS} FROM announcements WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 10`,
    )
  ).map(toAnnouncement);
}

export async function createAnnouncement(input: AnnouncementInput): Promise<void> {
  const db = await getDb();
  await db.query("INSERT INTO announcements (id, title, body, severity) VALUES ($1, $2, $3, $4)", [
    randomUUID(),
    input.title,
    input.body,
    input.severity,
  ]);
}

export async function updateAnnouncement(id: string, input: AnnouncementInput): Promise<void> {
  const db = await getDb();
  await db.query(
    "UPDATE announcements SET title = $2, body = $3, severity = $4, updated_at = now() WHERE id = $1",
    [id, input.title, input.body, input.severity],
  );
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
