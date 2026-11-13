import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";

import { getDb } from "@/lib/db/client";
import { getEnv } from "@/lib/env";

/**
 * Opaque server sessions. The browser holds a random token in an HttpOnly
 * cookie; the database holds only its SHA-256 hash.
 */
export const SESSION_COOKIE = "fs_session";
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
  const a = createHash("sha256").update(submitted).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

const attempts = new Map<string, { count: number; resetAt: number }>();

/** Simple in-memory limiter: `limit` attempts per `windowMs` per key. */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  entry.count += 1;
  return entry.count <= limit;
}
