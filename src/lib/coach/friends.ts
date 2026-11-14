import "server-only";

import { randomBytes } from "node:crypto";

import type { Plan, PublicPlan } from "@/lib/coach/plans";
import { sharedPlan } from "@/lib/coach/plans";
import { addToTrash } from "@/lib/coach/trash";
import { readState, writeState } from "@/lib/data/repository";
import { getDb } from "@/lib/db/client";

/**
 * Friends: people whose shared plans a customer wants to see in one place.
 *
 * Each customer has a friend code they can give out. Adding someone by their
 * code lets you see the plans that person has chosen to share, and nothing
 * else: no amounts, no balance, no name. The link is one-way and private: the
 * other person is not told, and what you call them is your own label.
 */
export interface Friend {
  id: string;
  /** The friend's blind index. Never sent to the browser. */
  ref: string;
  nickname: string;
  addedOn: string;
}

const KIND = "friends";
const MAX_FRIENDS = 30;

function newCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(randomBytes(8), (byte) => alphabet[byte % alphabet.length]).join("");
}

/** The customer's own friend code, created the first time it is asked for. */
export async function friendCode(ref: string): Promise<string> {
  const db = await getDb();
  const rows = await db.query<{ code: string }>(
    "SELECT code FROM friend_codes WHERE customer_ref = $1",
    [ref],
  );
  if (rows[0]) return rows[0].code;
  const code = newCode();
  await db.query(
    "INSERT INTO friend_codes (code, customer_ref) VALUES ($1, $2) ON CONFLICT (customer_ref) DO NOTHING",
    [code, ref],
  );
  return (
    (
      await db.query<{ code: string }>("SELECT code FROM friend_codes WHERE customer_ref = $1", [
        ref,
      ])
    )[0]?.code ?? code
  );
}

export async function listFriends(ref: string): Promise<Friend[]> {
  return (await readState<Friend[]>(ref, KIND)) ?? [];
}

export type FriendError = "not_found" | "self" | "already" | "too_many";

export async function addFriend(
  ref: string,
  code: string,
  nickname: string,
  asOf: string,
): Promise<Friend | FriendError> {
  const db = await getDb();
  const rows = await db.query<{ customer_ref: string }>(
    "SELECT customer_ref FROM friend_codes WHERE code = $1",
    [
      code
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 8),
    ],
  );
  const other = rows[0]?.customer_ref;
  if (!other) return "not_found";
  if (other === ref) return "self";
  const friends = await listFriends(ref);
  if (friends.some((friend) => friend.ref === other)) return "already";
  if (friends.length >= MAX_FRIENDS) return "too_many";
  const friend: Friend = {
    id: `friend-${crypto.randomUUID()}`,
    ref: other,
    nickname: nickname.trim().slice(0, 40),
    addedOn: asOf,
  };
  await writeState(ref, KIND, [...friends, friend]);
  return friend;
}

export async function renameFriend(ref: string, id: string, nickname: string): Promise<boolean> {
  const friends = await listFriends(ref);
  if (!friends.some((friend) => friend.id === id)) return false;
  await writeState(
    ref,
    KIND,
    friends.map((friend) =>
      friend.id === id ? { ...friend, nickname: nickname.trim().slice(0, 40) } : friend,
    ),
  );
  return true;
}

export async function removeFriend(ref: string, id: string): Promise<boolean> {
  const friends = await listFriends(ref);
  const removed = friends.find((friend) => friend.id === id);
  if (!removed) return false;
  await writeState(
    ref,
    KIND,
    friends.filter((friend) => friend.id !== id),
  );
  await addToTrash(ref, [
    {
      id: `trash-${crypto.randomUUID()}`,
      kind: "friend",
      deletedAt: new Date().toISOString(),
      label: removed.nickname,
      item: removed,
    },
  ]);
  return true;
}

export async function restoreFriend(ref: string, friend: Friend): Promise<void> {
  const friends = await listFriends(ref);
  if (!friends.some((item) => item.ref === friend.ref)) {
    await writeState(ref, KIND, [...friends, friend].slice(0, MAX_FRIENDS));
  }
}

/** Each friend with the plans they have chosen to share. Percentages only. */
export async function friendsWithPlans(
  ref: string,
): Promise<{ id: string; nickname: string; plans: PublicPlan[] }[]> {
  const out: { id: string; nickname: string; plans: PublicPlan[] }[] = [];
  for (const friend of await listFriends(ref)) {
    const theirs = (await readState<Plan[]>(friend.ref, "plans")) ?? [];
    const plans: PublicPlan[] = [];
    for (const plan of theirs) {
      if (!plan.shareCode) continue;
      const shared = await sharedPlan(plan.shareCode);
      if (shared) plans.push(shared);
    }
    out.push({ id: friend.id, nickname: friend.nickname, plans });
  }
  return out;
}
