import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";

import { activeStaff, type StaffRole } from "@/lib/admin/staff";
import { getEnv } from "@/lib/env";
import { secretsMatch } from "@/lib/security/compare";

/**
 * Admin sign-in. The installation owner signs in with the password from the
 * environment; other staff sign in with their own username and password. Both
 * get a signed, expiring cookie that names who they are. Staff sessions can
 * read aggregate statistics and what customers chose to send an adviser; no
 * admin route can read a customer's data.
 */
const ADMIN_COOKIE = "fs_admin";
const HOURS = 4;
export const OWNER_ID = "owner";

export interface StaffSession {
  id: string;
  role: StaffRole | "owner";
  name: string;
}

function sign(expires: number, staffId: string): string {
  return createHmac("sha256", getEnv().SESSION_SECRET)
    .update(`admin:${expires}:${staffId}`)
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
  return secretsMatch(submitted, expected);
}

export async function createAdminSession(staffId: string = OWNER_ID): Promise<void> {
  const expires = Date.now() + HOURS * 3_600_000;
  (await cookies()).set(ADMIN_COOKIE, `${expires}.${staffId}.${sign(expires, staffId)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    expires: new Date(expires),
  });
}

/**
 * Who is signed in to the admin area, if anyone. A staff member is looked up
 * on every request, so moving them to the recycle bin or changing their role
 * takes effect at once, not when their cookie expires.
 */
export async function currentStaff(): Promise<StaffSession | null> {
  const value = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!value) return null;
  const [expiresText = "", staffId = "", signature = ""] = value.split(".");
  const expires = Number(expiresText);
  if (!Number.isFinite(expires) || expires < Date.now() || !staffId) return null;
  const expected = Buffer.from(sign(expires, staffId));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  if (staffId === OWNER_ID) return { id: OWNER_ID, role: "owner", name: "" };
  const member = await activeStaff(staffId);
  return member ? { id: member.id, role: member.role, name: member.name } : null;
}

export const isManagerRole = (role: StaffSession["role"]): boolean =>
  role === "owner" || role === "admin";

/** Any signed-in member of staff. */
export async function isAdmin(): Promise<boolean> {
  return (await currentStaff()) !== null;
}

/**
 * Guards a route. Returns the response to send when the caller may not
 * continue: 401 when nobody is signed in, 403 when the role is not enough.
 */
export async function refuse(level: "staff" | "manager"): Promise<Response | null> {
  const staff = await currentStaff();
  if (!staff) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (level === "manager" && !isManagerRole(staff.role)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  return null;
}

export async function destroyAdminSession(): Promise<void> {
  (await cookies()).delete(ADMIN_COOKIE);
}
