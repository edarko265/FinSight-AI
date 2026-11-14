import "server-only";

import { createHash, randomUUID } from "node:crypto";

import { addDays, parts } from "@/lib/analytics/periods";
import { getSettings } from "@/lib/admin/settings";
import { getDb } from "@/lib/db/client";
import { decryptField, encryptField } from "@/lib/security/crypto";
import { customerKey } from "@/lib/security/keys";

/**
 * Hand-over from the AI coach to a human adviser. The customer starts it and
 * chooses what to share. Advice about investments is given by the person, not
 * by the model. The fee shown is an example: the first request is free.
 */
export const ADVISOR_TOPICS = ["general", "investment"] as const;
export type AdvisorTopic = (typeof ADVISOR_TOPICS)[number];

const DETAILS = "advisor_requests.sealed_details";
const MESSAGE = "advisor_messages.sealed_text";

interface Details {
  slot: string;
  note: string;
  feeCents: number;
}

export interface AdvisorMessage {
  id: string;
  sender: "customer" | "advisor";
  text: string;
  at: string;
}

export interface AdvisorRequest {
  id: string;
  topic: AdvisorTopic;
  status: "open" | "active" | "closed";
  slot: string;
  note: string;
  feeCents: number;
  createdAt: string;
  messages: AdvisorMessage[];
}

type RequestRow = {
  id: string;
  customer_ref: string;
  topic: AdvisorTopic;
  status: AdvisorRequest["status"];
  sealed_details: string;
  created_at: string | Date;
  deleted_at?: string | Date | null;
};

const iso = (value: string | Date): string => new Date(value).toISOString();

/** Call times on the next working days after the demo date. */
export function callSlots(asOf: string): string[] {
  const slots: string[] = [];
  for (let offset = 1; slots.length < 6 && offset < 10; offset += 1) {
    const date = addDays(asOf, offset);
    const { year, month, day } = parts(date);
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    if (weekday === 0 || weekday === 6) continue;
    slots.push(`${date}T10:00`, `${date}T14:30`);
  }
  return slots.slice(0, 6);
}

async function messagesFor(requestId: string, ref: string): Promise<AdvisorMessage[]> {
  const db = await getDb();
  const rows = await db.query<{
    id: string;
    sender: "customer" | "advisor";
    sealed_text: string;
    created_at: string | Date;
  }>(
    "SELECT id, sender, sealed_text, created_at FROM advisor_messages WHERE request_id = $1 ORDER BY created_at, id",
    [requestId],
  );
  const key = customerKey(ref);
  return rows.map((row) => ({
    id: row.id,
    sender: row.sender,
    text: decryptField(row.sealed_text, key, MESSAGE),
    at: iso(row.created_at),
  }));
}

async function open(row: RequestRow, withMessages: boolean): Promise<AdvisorRequest> {
  const details = JSON.parse(
    decryptField(row.sealed_details, customerKey(row.customer_ref), DETAILS),
  ) as Details;
  return {
    id: row.id,
    topic: row.topic,
    status: row.status,
    ...details,
    createdAt: iso(row.created_at),
    messages: withMessages ? await messagesFor(row.id, row.customer_ref) : [],
  };
}

const COLUMNS = "id, customer_ref, topic, status, sealed_details, created_at";

export async function nextFeeCents(customerRef: string): Promise<number> {
  const db = await getDb();
  const rows = await db.query<{ n: number | string }>(
    "SELECT count(*) AS n FROM advisor_requests WHERE customer_ref = $1",
    [customerRef],
  );
  return Number(rows[0]?.n ?? 0) === 0 ? 0 : (await getSettings()).advisorFeeCents;
}

/** The customer's current (not closed) request with its messages, if any. */
export async function currentRequest(customerRef: string): Promise<AdvisorRequest | null> {
  const db = await getDb();
  const rows = await db.query<RequestRow>(
    `SELECT ${COLUMNS} FROM advisor_requests WHERE customer_ref = $1 AND status <> 'closed'
       AND deleted_at IS NULL
     ORDER BY created_at DESC LIMIT 1`,
    [customerRef],
  );
  return rows[0] ? open(rows[0], true) : null;
}

export async function createRequest(
  customerRef: string,
  input: { topic: AdvisorTopic; slot: string; note: string },
): Promise<AdvisorRequest> {
  const existing = await currentRequest(customerRef);
  if (existing) return existing;
  const db = await getDb();
  const details: Details = {
    slot: input.slot,
    note: input.note,
    feeCents: await nextFeeCents(customerRef),
  };
  const id = randomUUID();
  await db.query(
    "INSERT INTO advisor_requests (id, customer_ref, topic, status, sealed_details) VALUES ($1, $2, $3, 'open', $4)",
    [
      id,
      customerRef,
      input.topic,
      encryptField(JSON.stringify(details), customerKey(customerRef), DETAILS),
    ],
  );
  if (input.note) await addMessage(id, customerRef, "customer", input.note);
  return (await currentRequest(customerRef)) as AdvisorRequest;
}

async function addMessage(
  requestId: string,
  ref: string,
  sender: "customer" | "advisor",
  text: string,
): Promise<void> {
  const db = await getDb();
  await db.query(
    "INSERT INTO advisor_messages (id, request_id, sender, sealed_text) VALUES ($1, $2, $3, $4)",
    [randomUUID(), requestId, sender, encryptField(text, customerKey(ref), MESSAGE)],
  );
  await db.query("UPDATE advisor_requests SET updated_at = now() WHERE id = $1", [requestId]);
}

export async function customerReply(
  customerRef: string,
  text: string,
): Promise<AdvisorRequest | null> {
  const request = await currentRequest(customerRef);
  if (!request) return null;
  await addMessage(request.id, customerRef, "customer", text);
  return currentRequest(customerRef);
}

// ---- Adviser side. An adviser sees only what a customer chose to share in a request. ----

export interface QueueItem extends Omit<AdvisorRequest, "messages"> {
  /** A stable pseudonym, so the adviser can tell requests apart without seeing the customer ID. */
  alias: string;
  waitingForAdvisor: boolean;
  /** Set when the request is in the recycle bin. */
  deleted: boolean;
}

function alias(ref: string): string {
  return `#${createHash("sha256").update(ref).digest("hex").slice(0, 6).toUpperCase()}`;
}

export async function advisorQueue(): Promise<QueueItem[]> {
  const db = await getDb();
  const rows = await db.query<RequestRow & { last_sender: string | null }>(
    `SELECT r.id, r.customer_ref, r.topic, r.status, r.sealed_details, r.created_at, r.deleted_at,
            (SELECT m.sender FROM advisor_messages m WHERE m.request_id = r.id ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS last_sender
     FROM advisor_requests r ORDER BY (r.status = 'closed'), r.created_at DESC LIMIT 80`,
  );
  const items: QueueItem[] = [];
  for (const row of rows) {
    const { messages: _messages, ...request } = await open(row, false);
    void _messages;
    items.push({
      ...request,
      alias: alias(row.customer_ref),
      waitingForAdvisor:
        !row.deleted_at && row.status !== "closed" && row.last_sender !== "advisor",
      deleted: Boolean(row.deleted_at),
    });
  }
  return items;
}

async function rowById(id: string): Promise<RequestRow | null> {
  const db = await getDb();
  const rows = await db.query<RequestRow>(`SELECT ${COLUMNS} FROM advisor_requests WHERE id = $1`, [
    id,
  ]);
  return rows[0] ?? null;
}

export async function advisorThread(
  id: string,
): Promise<(AdvisorRequest & { alias: string }) | null> {
  const row = await rowById(id);
  return row ? { ...(await open(row, true)), alias: alias(row.customer_ref) } : null;
}

export async function advisorReply(id: string, text: string): Promise<boolean> {
  const row = await rowById(id);
  if (!row || row.status === "closed") return false;
  await addMessage(id, row.customer_ref, "advisor", text);
  const db = await getDb();
  await db.query("UPDATE advisor_requests SET status = 'active' WHERE id = $1", [id]);
  return true;
}

/** Staff actions on a request: close, reopen, move to the recycle bin, restore, or delete for good. */
export async function setRequestState(
  id: string,
  action: "close" | "reopen" | "trash" | "restore" | "purge",
): Promise<void> {
  const db = await getDb();
  switch (action) {
    case "close":
      await db.query(
        "UPDATE advisor_requests SET status = 'closed', updated_at = now() WHERE id = $1",
        [id],
      );
      break;
    case "reopen":
      await db.query(
        "UPDATE advisor_requests SET status = 'active', updated_at = now() WHERE id = $1",
        [id],
      );
      break;
    case "trash":
      await db.query(
        "UPDATE advisor_requests SET deleted_at = now(), updated_at = now() WHERE id = $1",
        [id],
      );
      break;
    case "restore":
      await db.query(
        "UPDATE advisor_requests SET deleted_at = NULL, updated_at = now() WHERE id = $1",
        [id],
      );
      break;
    case "purge":
      // Only from the recycle bin; messages go with it.
      await db.query("DELETE FROM advisor_requests WHERE id = $1 AND deleted_at IS NOT NULL", [id]);
      break;
  }
}

export interface AdvisorWorkload {
  open: number;
  needsReply: number;
  closed: number;
  byTopic: { topic: AdvisorTopic; count: number }[];
  free: number;
  paid: number;
  /** Average minutes from a request to the adviser's first reply, over answered requests. */
  averageFirstReplyMinutes: number | null;
}

/** Adviser workload from the request queue. Counts and averages only. */
export async function advisorWorkload(): Promise<AdvisorWorkload> {
  const queue = await advisorQueue();
  const live = queue.filter((item) => !item.deleted);
  const db = await getDb();
  const waits = await db.query<{ minutes: number | string | null }>(
    `SELECT avg(extract(epoch FROM (first.at - r.created_at)) / 60) AS minutes
     FROM advisor_requests r
     JOIN (SELECT request_id, min(created_at) AS at FROM advisor_messages WHERE sender = 'advisor' GROUP BY request_id) first
       ON first.request_id = r.id
     WHERE r.deleted_at IS NULL`,
  );
  const minutes = waits[0]?.minutes;
  return {
    open: live.filter((item) => item.status !== "closed").length,
    needsReply: live.filter((item) => item.waitingForAdvisor).length,
    closed: live.filter((item) => item.status === "closed").length,
    byTopic: ADVISOR_TOPICS.map((topic) => ({
      topic,
      count: live.filter((item) => item.topic === topic).length,
    })),
    free: live.filter((item) => item.feeCents === 0).length,
    paid: live.filter((item) => item.feeCents > 0).length,
    averageFirstReplyMinutes:
      minutes === null || minutes === undefined ? null : Math.round(Number(minutes)),
  };
}
