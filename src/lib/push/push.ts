import "server-only";

import { sendNotification, setVapidDetails, type PushSubscription } from "web-push";

import { readState, writeState } from "@/lib/data/repository";
import { getDb } from "@/lib/db/client";
import { getEnv } from "@/lib/env";
import { decryptField } from "@/lib/security/crypto";
import { mayNotify, readPrefs } from "@/lib/push/prefs";
import { customerKey } from "@/lib/security/keys";

/**
 * Device notifications (Web Push).
 *
 * A device's subscription is stored sealed with its customer's key, like
 * everything else the customer owns. Only general announcements are pushed
 * from the server. Personal figures are never sent through a push service:
 * insights about a customer's own money are raised by the app on the device.
 */
const KIND = "push";
const MAX_DEVICES = 5;

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

export function pushPublicKey(): string | null {
  const env = getEnv();
  return env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY ? env.VAPID_PUBLIC_KEY : null;
}

function configure(): boolean {
  const env = getEnv();
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return false;
  setVapidDetails(
    env.APP_BASE_URL ?? "https://finsight.invalid",
    env.VAPID_PUBLIC_KEY,
    env.VAPID_PRIVATE_KEY,
  );
  return true;
}

export async function listSubscriptions(customerRef: string): Promise<PushSubscription[]> {
  return (await readState<PushSubscription[]>(customerRef, KIND)) ?? [];
}

export async function addSubscription(
  customerRef: string,
  subscription: PushSubscription,
): Promise<void> {
  const others = (await listSubscriptions(customerRef)).filter(
    (item) => item.endpoint !== subscription.endpoint,
  );
  await writeState(customerRef, KIND, [subscription, ...others].slice(0, MAX_DEVICES));
}

export async function removeSubscription(customerRef: string, endpoint: string): Promise<void> {
  const remaining = (await listSubscriptions(customerRef)).filter(
    (item) => item.endpoint !== endpoint,
  );
  await writeState(customerRef, KIND, remaining);
}

/** Sends to one device. Returns false when the device's subscription is gone and should be dropped. */
async function send(subscription: PushSubscription, payload: PushPayload): Promise<boolean> {
  try {
    await sendNotification(subscription, JSON.stringify(payload), { TTL: 3600 });
    return true;
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode;
    return !(status === 404 || status === 410);
  }
}

/** Sends to all of one customer's devices and forgets the ones that no longer exist. */
export async function pushToCustomer(customerRef: string, payload: PushPayload): Promise<number> {
  if (!configure()) return 0;
  const subscriptions = await listSubscriptions(customerRef);
  const alive: PushSubscription[] = [];
  for (const subscription of subscriptions) {
    if (await send(subscription, payload)) alive.push(subscription);
  }
  if (alive.length !== subscriptions.length) await writeState(customerRef, KIND, alive);
  return alive.length;
}

/** Sends a general notice to every device that has notifications on. Returns how many were reached. */
export async function pushToEveryone(payload: PushPayload): Promise<number> {
  if (!configure()) return 0;
  const db = await getDb();
  const rows = await db.query<{ customer_ref: string; sealed_value: string }>(
    "SELECT customer_ref, sealed_value FROM customer_state WHERE kind = $1",
    [KIND],
  );
  let reached = 0;
  for (const row of rows) {
    let subscriptions: PushSubscription[] = [];
    try {
      subscriptions = JSON.parse(
        decryptField(row.sealed_value, customerKey(row.customer_ref), `customer_state.${KIND}`),
      ) as PushSubscription[];
    } catch {
      continue;
    }
    // Respect what this customer chose: announcements off, or quiet hours right now.
    if (!mayNotify(await readPrefs(row.customer_ref), "announcement", new Date())) continue;
    const alive: PushSubscription[] = [];
    for (const subscription of subscriptions) {
      if (await send(subscription, payload)) alive.push(subscription);
    }
    reached += alive.length;
    if (alive.length !== subscriptions.length) await writeState(row.customer_ref, KIND, alive);
  }
  return reached;
}

const LOCALE_KIND = "push_locale";
const SENT_KIND = "push_sent";

/** Remembers which language a customer's notifications should be written in. */
export async function rememberPushLocale(customerRef: string, locale: string): Promise<void> {
  await writeState(customerRef, LOCALE_KIND, locale);
}

export async function pushLocale(customerRef: string): Promise<string | null> {
  return readState<string>(customerRef, LOCALE_KIND);
}

/** Which reminders have already been sent to a customer, so none is sent twice. */
export async function alreadySent(customerRef: string): Promise<Set<string>> {
  return new Set((await readState<string[]>(customerRef, SENT_KIND)) ?? []);
}

export async function markSent(customerRef: string, ids: string[]): Promise<void> {
  const all = [...(await alreadySent(customerRef)), ...ids];
  await writeState(customerRef, SENT_KIND, all.slice(-200));
}

/** The customers who have at least one device with notifications on. */
export async function customersWithDevices(): Promise<string[]> {
  const db = await getDb();
  const rows = await db.query<{ customer_ref: string }>(
    "SELECT customer_ref FROM customer_state WHERE kind = $1",
    [KIND],
  );
  return rows.map((row) => row.customer_ref);
}
