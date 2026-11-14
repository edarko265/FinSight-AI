import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";

import { getEnv } from "@/lib/env";

/**
 * Admin sign-in: one shared password from the environment, and a signed,
 * expiring cookie. Admin sessions can read aggregate statistics only; no admin
 * route can read a customer's data.
 */
export const ADMIN_COOKIE = "fs_admin";
const HOURS = 4;

function sign(expires: number): string {
  return createHmac("sha256", getEnv().SESSION_SECRET)
    .update(`admin:${expires}`)
    .digest("base64url");
}

const MIN_PRODUCTION_PASSWORD = 12;

/** Constant-time check. In production a short admin password is refused outright. */
export function adminPasswordMatches(submitted: string): boolean {
  const expected = getEnv().ADMIN_PASSWORD;
  if (!expected) return false;
  if (process.env.NODE_ENV === "production" && expected.length < MIN_PRODUCTION_PASSWORD) {
    console.error(
      `admin: ADMIN_PASSWORD must be at least ${MIN_PRODUCTION_PASSWORD} characters in production`,
    );
    return false;
  }
  const a = createHash("sha256").update(submitted).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function createAdminSession(): Promise<void> {
  const expires = Date.now() + HOURS * 3_600_000;
  (await cookies()).set(ADMIN_COOKIE, `${expires}.${sign(expires)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    expires: new Date(expires),
  });
}

export async function isAdmin(): Promise<boolean> {
  const value = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!value) return false;
  const [expiresText = "", signature = ""] = value.split(".");
  const expires = Number(expiresText);
  if (!Number.isFinite(expires) || expires < Date.now()) return false;
  const expected = Buffer.from(sign(expires));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export async function destroyAdminSession(): Promise<void> {
  (await cookies()).delete(ADMIN_COOKIE);
}
