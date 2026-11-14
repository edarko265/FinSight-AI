import "server-only";

import QRCode from "qrcode";

import { readState, writeState } from "@/lib/data/repository";
import { newTotpSecret, totpUri, verifyTotp } from "@/lib/security/totp";

/**
 * Two-step sign-in for customers: a code from an authenticator app after the
 * password. The secret is sealed with the customer's key. It is optional here;
 * a bank deployment would use the bank's own strong authentication instead.
 */
interface Stored {
  secret: string;
  enabled: boolean;
}

const KIND = "totp";

export async function twoStepEnabled(ref: string): Promise<boolean> {
  return (await readState<Stored>(ref, KIND))?.enabled === true;
}

/** Starts set-up: makes a secret (not yet in force) and returns what the app needs to show. */
export async function beginTwoStep(
  ref: string,
  account: string,
): Promise<{ secret: string; qr: string }> {
  const secret = newTotpSecret();
  await writeState(ref, KIND, { secret, enabled: false } satisfies Stored);
  return {
    secret,
    qr: await QRCode.toDataURL(totpUri(secret, account), { margin: 1, width: 220 }),
  };
}

/** Finishes set-up once the customer proves the app shows the right code. */
export async function confirmTwoStep(ref: string, code: string): Promise<boolean> {
  const stored = await readState<Stored>(ref, KIND);
  if (!stored || !verifyTotp(stored.secret, code, Date.now())) return false;
  await writeState(ref, KIND, { ...stored, enabled: true });
  return true;
}

/** Checks a code at sign-in. True when two-step is off, so callers can always call it. */
export async function passesTwoStep(ref: string, code: string | undefined): Promise<boolean> {
  const stored = await readState<Stored>(ref, KIND);
  if (!stored?.enabled) return true;
  return code !== undefined && verifyTotp(stored.secret, code, Date.now());
}

/** Switches two-step off. Needs a current code, so a borrowed open session cannot remove it. */
export async function disableTwoStep(ref: string, code: string): Promise<boolean> {
  const stored = await readState<Stored>(ref, KIND);
  if (!stored?.enabled) return true;
  if (!verifyTotp(stored.secret, code, Date.now())) return false;
  await writeState(ref, KIND, { secret: "", enabled: false });
  return true;
}
