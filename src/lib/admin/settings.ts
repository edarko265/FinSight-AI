import "server-only";

import { randomUUID } from "node:crypto";

import { z } from "zod";

import { currentStaff, OWNER_ID } from "@/lib/admin/auth";
import { listStaff } from "@/lib/admin/staff";
import { getDb } from "@/lib/db/client";

/**
 * Settings staff can change from the admin area without a deploy. Stored as
 * one validated document; anything missing falls back to the defaults here.
 */
export const REWARD_IDS = [
  "under_average",
  "choice_down",
  "buffer",
  "surplus_streak",
  "investing",
  "goal",
] as const;
export const COUPON_IDS = ["coffee", "groceries", "voucher"] as const;

const points = z.number().int().min(0).max(1000);

export const settingsSchema = z.object({
  features: z.object({
    ai: z.boolean(),
    voice: z.boolean(),
    rewards: z.boolean(),
    advisor: z.boolean(),
    /** Sharing and copying plans between customers. */
    sharing: z.boolean(),
  }),
  /** Which AI provider answers. "auto" follows the AI_PROVIDER environment variable. */
  aiProvider: z.enum(["auto", "openai", "gemini"]),
  /** Price of an adviser conversation after the first, which is free. */
  advisorFeeCents: z.number().int().min(0).max(100_000),
  /** AI answers per day across all customers; beyond it the coach uses basic mode. 0 means no limit. */
  aiDailyRequestLimit: z.number().int().min(0).max(1_000_000),
  rewards: z.object({
    points: z.object({
      under_average: points,
      choice_down: points,
      buffer: points,
      surplus_streak: points,
      investing: points,
      goal: points,
    }),
    couponUnlockAt: z.object({ coffee: points, groceries: points, voucher: points }),
  }),
});

export type AppSettings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: AppSettings = {
  features: { ai: true, voice: true, rewards: true, advisor: true, sharing: true },
  aiProvider: "auto",
  advisorFeeCents: 1900,
  aiDailyRequestLimit: 2000,
  rewards: {
    points: {
      under_average: 75,
      choice_down: 75,
      buffer: 100,
      surplus_streak: 20,
      investing: 50,
      goal: 25,
    },
    couponUnlockAt: { coffee: 100, groceries: 200, voucher: 350 },
  },
};

const KEY = "app";
const TTL_MS = 5000;
let cache: { at: number; value: AppSettings } | undefined;

export async function getSettings(): Promise<AppSettings> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  let value = DEFAULT_SETTINGS;
  try {
    const db = await getDb();
    const rows = await db.query<{ value: string }>(
      "SELECT value FROM app_settings WHERE key = $1",
      [KEY],
    );
    const stored = rows[0] ? (JSON.parse(rows[0].value) as Partial<AppSettings>) : {};
    const merged = {
      ...DEFAULT_SETTINGS,
      ...stored,
      features: { ...DEFAULT_SETTINGS.features, ...stored.features },
      rewards: {
        points: { ...DEFAULT_SETTINGS.rewards.points, ...stored.rewards?.points },
        couponUnlockAt: {
          ...DEFAULT_SETTINGS.rewards.couponUnlockAt,
          ...stored.rewards?.couponUnlockAt,
        },
      },
    };
    const parsed = settingsSchema.safeParse(merged);
    if (parsed.success) value = parsed.data;
  } catch (error) {
    console.error("settings: using defaults:", error instanceof Error ? error.name : "error");
  }
  cache = { at: Date.now(), value };
  return value;
}

export async function saveSettings(next: AppSettings): Promise<AppSettings> {
  const db = await getDb();
  await db.query(
    `INSERT INTO app_settings (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [KEY, JSON.stringify(next)],
  );
  cache = { at: Date.now(), value: next };
  return next;
}

/** Records a staff action. Details describe the change, never a customer. */
export async function audit(action: string, detail = "", actor?: string): Promise<void> {
  try {
    const db = await getDb();
    const who = actor ?? (await currentStaff().catch(() => null))?.id ?? "";
    await db.query("INSERT INTO admin_audit (id, action, detail, actor) VALUES ($1, $2, $3, $4)", [
      randomUUID(),
      action.slice(0, 60),
      detail.slice(0, 300),
      who.slice(0, 60),
    ]);
  } catch (error) {
    console.error("audit: could not record:", error instanceof Error ? error.name : "error");
  }
}

export interface AuditEntry {
  id: string;
  at: string;
  action: string;
  detail: string;
  /** "owner", a staff member's name, or empty when nobody was signed in. */
  actor: string;
}

export async function auditLog(): Promise<AuditEntry[]> {
  const db = await getDb();
  const rows = await db.query<{
    id: string;
    at: string | Date;
    action: string;
    detail: string;
    actor: string;
  }>("SELECT id, at, action, detail, actor FROM admin_audit ORDER BY at DESC LIMIT 100");
  const names = new Map((await listStaff()).map((member) => [member.id, member.name]));
  return rows.map((row) => ({
    ...row,
    at: new Date(row.at).toISOString(),
    actor: row.actor === OWNER_ID ? OWNER_ID : (names.get(row.actor) ?? ""),
  }));
}

// ---- AI consumption ----

export async function recordAiUsage(
  model: string,
  inputTokens: number,
  outputTokens: number,
): Promise<void> {
  try {
    const db = await getDb();
    await db.query(
      `INSERT INTO ai_usage (day, model, requests, input_tokens, output_tokens) VALUES (CURRENT_DATE, $1, 1, $2, $3)
       ON CONFLICT (day, model) DO UPDATE SET requests = ai_usage.requests + 1,
         input_tokens = ai_usage.input_tokens + EXCLUDED.input_tokens,
         output_tokens = ai_usage.output_tokens + EXCLUDED.output_tokens`,
      [model.slice(0, 60), Math.round(inputTokens) || 0, Math.round(outputTokens) || 0],
    );
  } catch (error) {
    console.error("ai usage: could not record:", error instanceof Error ? error.name : "error");
  }
}

export async function aiRequestsToday(): Promise<number> {
  const db = await getDb();
  const rows = await db.query<{ n: number | string | null }>(
    "SELECT sum(requests) AS n FROM ai_usage WHERE day = CURRENT_DATE",
  );
  return Number(rows[0]?.n ?? 0);
}

export interface AiUsageSummary {
  today: { requests: number; inputTokens: number; outputTokens: number };
  last30: { requests: number; inputTokens: number; outputTokens: number };
  byModel: { model: string; requests: number; inputTokens: number; outputTokens: number }[];
  daily: { day: string; requests: number }[];
}

export async function aiUsageSummary(span = 30): Promise<AiUsageSummary> {
  const db = await getDb();
  const rows = await db.query<{
    day: string | Date;
    model: string;
    requests: number;
    input_tokens: number | string;
    output_tokens: number | string;
    is_today: boolean;
  }>(
    `SELECT day, model, requests, input_tokens, output_tokens, (day = CURRENT_DATE) AS is_today
     FROM ai_usage WHERE day > CURRENT_DATE - $1::int ORDER BY day`,
    [span],
  );
  const zero = () => ({ requests: 0, inputTokens: 0, outputTokens: 0 });
  const today = zero();
  const last30 = zero();
  const models = new Map<string, ReturnType<typeof zero>>();
  const days = new Map<string, number>();
  for (const row of rows) {
    const add = (target: ReturnType<typeof zero>): void => {
      target.requests += Number(row.requests);
      target.inputTokens += Number(row.input_tokens);
      target.outputTokens += Number(row.output_tokens);
    };
    add(last30);
    if (row.is_today) add(today);
    const model = models.get(row.model) ?? zero();
    add(model);
    models.set(row.model, model);
    const day = new Date(row.day).toISOString().slice(0, 10);
    days.set(day, (days.get(day) ?? 0) + Number(row.requests));
  }
  return {
    today,
    last30,
    byModel: [...models.entries()].map(([model, totals]) => ({ model, ...totals })),
    daily: [...days.entries()].map(([day, requests]) => ({ day, requests })),
  };
}
