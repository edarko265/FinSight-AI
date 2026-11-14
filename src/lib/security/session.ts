import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { cookies } from "next/headers";

import { getDb } from "@/lib/db/client";
import { getEnv } from "@/lib/env";
import { secretsMatch } from "@/lib/security/compare";

/**
 * Opaque server sessions. The browser holds a random token in an HttpOnly
 * cookie; the database holds only its SHA-256 hash.
 */
const SESSION_COOKIE = "fs_session";
const SESSION_HOURS = 8;

function hashToken(token: string): string {
  return createHash("sha256").update(`${getEnv().SESSION_SECRET}:${token}`).digest("base64url");
}

export async function createSession(customerRef: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_HOURS * 3_600_000);
  const db = await getDb();
  await db.query("DELETE FROM sessions WHERE expires_at < now()");
  await db.query(
    "INSERT INTO sessions (token_hash, customer_ref, expires_at) VALUES ($1, $2, $3)",
    [hashToken(token), customerRef, expires.toISOString()],
  );
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}

/** The signed-in customer's blind index, or null. This is the only source of customer identity. */
export async function getSessionCustomerRef(): Promise<string | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const db = await getDb();
  const rows = await db.query<{ customer_ref: string }>(
    "SELECT customer_ref FROM sessions WHERE token_hash = $1 AND expires_at > now()",
    [hashToken(token)],
  );
  return rows[0]?.customer_ref ?? null;
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    const db = await getDb();
    await db.query("DELETE FROM sessions WHERE token_hash = $1", [hashToken(token)]);
  }
  jar.delete(SESSION_COOKIE);
}

/** Constant-time comparison of the submitted demo password. */
export function passwordMatches(submitted: string): boolean {
  const expected = getEnv().DEMO_LOGIN_PASSWORD;
  if (!expected) return false;
  return secretsMatch(submitted, expected);
}

const localAttempts = new Map<string, { count: number; resetAt: number }>();

function localLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = localAttempts.get(key);
  if (!entry || entry.resetAt < now) {
    localAttempts.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  entry.count += 1;
  return entry.count <= limit;
}

/**
 * Allows `limit` requests per `windowMs` for a key. Counted in the database so
 * the limit holds across server instances; the key is stored as a keyed hash.
 * If the database cannot be reached, a per-instance counter is used instead,
 * so a limit always applies.
 */
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  const hashed = createHash("sha256")
    .update(`${getEnv().SESSION_SECRET}:limit:${key}`)
    .digest("base64url");
  try {
    const db = await getDb();
    const rows = await db.query<{ count: number }>(
      `INSERT INTO rate_limits (key, window_start, count) VALUES ($1, now(), 1)
       ON CONFLICT (key) DO UPDATE SET
         count = CASE WHEN rate_limits.window_start < now() - ($2 * interval '1 millisecond') THEN 1 ELSE rate_limits.count + 1 END,
         window_start = CASE WHEN rate_limits.window_start < now() - ($2 * interval '1 millisecond') THEN now() ELSE rate_limits.window_start END
       RETURNING count`,
      [hashed, windowMs],
    );
    return Number(rows[0]?.count ?? 1) <= limit;
  } catch {
    return localLimit(key, limit, windowMs);
  }
}

function limitKey(key: string): string {
  return createHash("sha256").update(`${getEnv().SESSION_SECRET}:limit:${key}`).digest("base64url");
}

/**
 * Failed-attempt lockout. Unlike `rateLimit`, a successful attempt does not
 * count: only failures do, and a success clears them. While locked, every
 * attempt is refused, right or wrong, so the limit cannot be used to keep
 * guessing.
 */
export async function isLockedOut(key: string, limit: number, windowMs: number): Promise<boolean> {
  try {
    const db = await getDb();
    const rows = await db.query<{ count: number }>(
      "SELECT count FROM rate_limits WHERE key = $1 AND window_start >= now() - ($2 * interval '1 millisecond')",
      [limitKey(key), windowMs],
    );
    return Number(rows[0]?.count ?? 0) >= limit;
  } catch {
    return false;
  }
}

export async function recordFailure(key: string, windowMs: number): Promise<void> {
  await rateLimit(key, Number.MAX_SAFE_INTEGER, windowMs);
}

export async function clearFailures(key: string): Promise<void> {
  try {
    const db = await getDb();
    await db.query("DELETE FROM rate_limits WHERE key = $1", [limitKey(key)]);
  } catch {
    // Leaving a stale counter only makes the next lockout come sooner.
  }
}
