import "server-only";

import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";

import { getDb } from "@/lib/db/client";
import { decryptField, encryptField } from "@/lib/security/crypto";
import { serviceKey, staffIndex } from "@/lib/security/keys";
import { newTotpSecret, verifyTotp } from "@/lib/security/totp";

/**
 * Staff accounts for the admin area.
 *
 * - admin: everything, including settings and the team.
 * - adviser, banker: the adviser queue and the aggregate statistics.
 *
 * The installation owner (the ADMIN_PASSWORD) is not a row here and can never
 * be locked out by a mistake in this table.
 */
export const STAFF_ROLES = ["admin", "adviser", "banker"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export interface StaffMember {
  id: string;
  name: string;
  username: string;
  role: StaffRole;
  createdAt: string;
  deletedAt: string | null;
  /** Whether this member signs in with a second step. */
  twoStep: boolean;
}

type Row = {
  id: string;
  sealed_profile: string;
  password_hash: string;
  created_at: string | Date;
  deleted_at: string | Date | null;
};

const COLUMNS = "id, sealed_profile, password_hash, created_at, deleted_at";
const key = () => serviceKey("staff");
const context = (id: string): string => `staff_users.profile:${id}`;

interface Profile {
  name: string;
  username: string;
  role: StaffRole;
  /** Two-step sign-in secret, once the member has set it up. */
  totp?: string;
  /** A secret that is being set up but not confirmed yet. */
  totpPending?: string;
}

function seal(id: string, profile: Profile): string {
  return encryptField(JSON.stringify(profile), key(), context(id));
}

function readProfile(row: Row): Profile {
  return JSON.parse(decryptField(row.sealed_profile, key(), context(row.id))) as Profile;
}

function toMember(row: Row): StaffMember {
  const { totp, totpPending: _pending, ...profile } = readProfile(row);
  void _pending;
  return {
    id: row.id,
    ...profile,
    twoStep: Boolean(totp),
    createdAt: new Date(row.created_at).toISOString(),
    deletedAt: row.deleted_at ? new Date(row.deleted_at).toISOString() : null,
  };
}

function hashPassword(password: string): string {
  const salt = randomBytes(16);
  return `scrypt.${salt.toString("base64url")}.${scryptSync(password, salt, 64).toString("base64url")}`;
}

function passwordMatches(password: string, stored: string): boolean {
  const [scheme, salt = "", hash = ""] = stored.split(".");
  if (scheme !== "scrypt") return false;
  const expected = Buffer.from(hash, "base64url");
  const given = scryptSync(password, Buffer.from(salt, "base64url"), 64);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** Everyone, including the recycle bin. */
export async function listStaff(): Promise<StaffMember[]> {
  const db = await getDb();
  const rows = await db.query<Row>(
    `SELECT ${COLUMNS} FROM staff_users ORDER BY created_at DESC LIMIT 200`,
  );
  return rows.map(toMember);
}

/** One member who may sign in: exists and is not in the recycle bin. */
export async function activeStaff(id: string): Promise<StaffMember | null> {
  const db = await getDb();
  const rows = await db.query<Row>(
    `SELECT ${COLUMNS} FROM staff_users WHERE id = $1 AND deleted_at IS NULL`,
    [id],
  );
  return rows[0] ? toMember(rows[0]) : null;
}

export interface StaffInput {
  name: string;
  username: string;
  role: StaffRole;
  password: string;
}

/** Adds a member. Returns false when the username is already in use (also by someone in the bin). */
export async function createStaff(input: StaffInput): Promise<boolean> {
  const db = await getDb();
  const index = staffIndex(input.username);
  const taken = await db.query("SELECT 1 FROM staff_users WHERE username_index = $1", [index]);
  if (taken.length > 0) return false;
  const id = randomUUID();
  const profile = { name: input.name, username: input.username.toLowerCase(), role: input.role };
  await db.query(
    "INSERT INTO staff_users (id, username_index, sealed_profile, password_hash) VALUES ($1, $2, $3, $4)",
    [id, index, seal(id, profile), hashPassword(input.password)],
  );
  return true;
}

/** Changes the name or role, and the password when one is given. The username stays. */
export async function updateStaff(
  id: string,
  change: { name: string; role: StaffRole; password?: string },
): Promise<boolean> {
  const db = await getDb();
  const rows = await db.query<Row>(`SELECT ${COLUMNS} FROM staff_users WHERE id = $1`, [id]);
  if (!rows[0]) return false;
  const current = readProfile(rows[0]);
  const profile = { ...current, name: change.name, role: change.role };
  await db.query(
    "UPDATE staff_users SET sealed_profile = $2, password_hash = $3, updated_at = now() WHERE id = $1",
    [
      id,
      seal(id, profile),
      change.password ? hashPassword(change.password) : rows[0].password_hash,
    ],
  );
  return true;
}

/** Moves to the recycle bin (which also ends their access), restores, or removes for good. */
export async function setStaffState(
  id: string,
  action: "trash" | "restore" | "purge",
): Promise<void> {
  const db = await getDb();
  if (action === "purge") {
    await db.query("DELETE FROM staff_users WHERE id = $1 AND deleted_at IS NOT NULL", [id]);
  } else {
    await db.query(
      `UPDATE staff_users SET deleted_at = ${action === "trash" ? "now()" : "NULL"}, updated_at = now() WHERE id = $1`,
      [id],
    );
  }
}

/** Checks a username and password. Members in the recycle bin cannot sign in. */
export async function verifyStaff(
  username: string,
  password: string,
  code?: string,
): Promise<StaffMember | "totp_required" | null> {
  const db = await getDb();
  const rows = await db.query<Row>(
    `SELECT ${COLUMNS} FROM staff_users WHERE username_index = $1 AND deleted_at IS NULL`,
    [staffIndex(username)],
  );
  const row = rows[0];
  if (!row) {
    // Spend the same time as a real check, so a missing username is not quicker to refuse.
    scryptSync(password, Buffer.alloc(16), 64);
    return null;
  }
  if (!passwordMatches(password, row.password_hash)) return null;
  const secret = readProfile(row).totp;
  if (secret && !(code !== undefined && verifyTotp(secret, code, Date.now()))) {
    return code === undefined ? "totp_required" : null;
  }
  return toMember(row);
}

async function activeRow(id: string): Promise<Row | null> {
  const db = await getDb();
  const rows = await db.query<Row>(
    `SELECT ${COLUMNS} FROM staff_users WHERE id = $1 AND deleted_at IS NULL`,
    [id],
  );
  return rows[0] ?? null;
}

async function saveProfile(id: string, profile: Profile): Promise<void> {
  const db = await getDb();
  await db.query("UPDATE staff_users SET sealed_profile = $2, updated_at = now() WHERE id = $1", [
    id,
    seal(id, profile),
  ]);
}

/** Starts two-step set-up for a member and returns the secret and its account label. */
export async function beginStaffTwoStep(
  id: string,
): Promise<{ secret: string; account: string } | null> {
  const row = await activeRow(id);
  if (!row) return null;
  const profile = readProfile(row);
  const secret = newTotpSecret();
  await saveProfile(id, { ...profile, totpPending: secret });
  return { secret, account: profile.username };
}

export async function confirmStaffTwoStep(id: string, code: string): Promise<boolean> {
  const row = await activeRow(id);
  if (!row) return false;
  const { totpPending, ...profile } = readProfile(row);
  if (!totpPending || !verifyTotp(totpPending, code, Date.now())) return false;
  await saveProfile(id, { ...profile, totp: totpPending });
  return true;
}

export async function disableStaffTwoStep(id: string, code: string): Promise<boolean> {
  const row = await activeRow(id);
  if (!row) return false;
  const { totp, totpPending: _pending, ...profile } = readProfile(row);
  void _pending;
  if (!totp) return true;
  if (!verifyTotp(totp, code, Date.now())) return false;
  await saveProfile(id, profile);
  return true;
}

/** A member changes their own password, proving they know the current one. */
export async function changeOwnPassword(
  id: string,
  current: string,
  next: string,
): Promise<boolean> {
  const db = await getDb();
  const rows = await db.query<Row>(
    `SELECT ${COLUMNS} FROM staff_users WHERE id = $1 AND deleted_at IS NULL`,
    [id],
  );
  const row = rows[0];
  if (!row || !passwordMatches(current, row.password_hash)) return false;
  await db.query("UPDATE staff_users SET password_hash = $2, updated_at = now() WHERE id = $1", [
    id,
    hashPassword(next),
  ]);
  return true;
}
