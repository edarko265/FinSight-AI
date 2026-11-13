import "server-only";

import { readState, writeState } from "@/lib/data/repository";

/**
 * Consent to AI processing. Until the user accepts the current terms, nothing
 * about them is sent to a language-model or speech provider; the coach answers
 * in basic mode, on our own server. Consent can be withdrawn at any time.
 */
export const AI_TERMS_VERSION = "2026-11-14";

export interface ConsentRecord {
  aiTermsVersion: string | null;
  acceptedAt: string | null;
  withdrawnAt: string | null;
}

const EMPTY: ConsentRecord = { aiTermsVersion: null, acceptedAt: null, withdrawnAt: null };

export async function readConsent(customerRef: string): Promise<ConsentRecord> {
  return (await readState<ConsentRecord>(customerRef, "consent")) ?? EMPTY;
}

export function hasAiConsent(record: ConsentRecord): boolean {
  return record.aiTermsVersion === AI_TERMS_VERSION && record.acceptedAt !== null;
}

export async function setAiConsent(customerRef: string, accepted: boolean): Promise<ConsentRecord> {
  const now = new Date().toISOString();
  const record: ConsentRecord = accepted
    ? { aiTermsVersion: AI_TERMS_VERSION, acceptedAt: now, withdrawnAt: null }
    : { aiTermsVersion: null, acceptedAt: null, withdrawnAt: now };
  await writeState(customerRef, "consent", record);
  return record;
}
