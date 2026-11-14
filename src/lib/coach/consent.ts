import "server-only";

import { readState, writeState } from "@/lib/data/repository";

/**
 * What the customer has agreed to.
 *
 * - Terms of use and the privacy notice must be accepted at first sign-in,
 *   before any of the customer's data is shown.
 * - AI processing is a separate, optional choice. Until the customer accepts
 *   it, nothing about them is sent to a language-model or speech provider and
 *   the coach answers in basic mode. It can be withdrawn at any time.
 *
 * Both are versioned: changing a version asks again.
 */
export const TERMS_VERSION = "2026-11-14";
export const AI_TERMS_VERSION = "2026-11-14";

export interface ConsentRecord {
  termsVersion: string | null;
  termsAcceptedAt: string | null;
  aiTermsVersion: string | null;
  acceptedAt: string | null;
  withdrawnAt: string | null;
}

const EMPTY: ConsentRecord = {
  termsVersion: null,
  termsAcceptedAt: null,
  aiTermsVersion: null,
  acceptedAt: null,
  withdrawnAt: null,
};

export async function readConsent(customerRef: string): Promise<ConsentRecord> {
  return { ...EMPTY, ...(await readState<Partial<ConsentRecord>>(customerRef, "consent")) };
}

export function hasAcceptedTerms(record: ConsentRecord): boolean {
  return record.termsVersion === TERMS_VERSION && record.termsAcceptedAt !== null;
}

export function hasAiConsent(record: ConsentRecord): boolean {
  return (
    hasAcceptedTerms(record) &&
    record.aiTermsVersion === AI_TERMS_VERSION &&
    record.acceptedAt !== null
  );
}

/** True once the customer has said yes or no to AI, so they are not asked again on every visit. */
export function hasDecidedOnAi(record: ConsentRecord): boolean {
  return hasAiConsent(record) || record.withdrawnAt !== null;
}

export async function acceptTerms(customerRef: string): Promise<ConsentRecord> {
  const record: ConsentRecord = {
    ...(await readConsent(customerRef)),
    termsVersion: TERMS_VERSION,
    termsAcceptedAt: new Date().toISOString(),
  };
  await writeState(customerRef, "consent", record);
  return record;
}

export async function setAiConsent(customerRef: string, accepted: boolean): Promise<ConsentRecord> {
  const now = new Date().toISOString();
  const current = await readConsent(customerRef);
  const record: ConsentRecord = accepted
    ? { ...current, aiTermsVersion: AI_TERMS_VERSION, acceptedAt: now, withdrawnAt: null }
    : { ...current, aiTermsVersion: null, acceptedAt: null, withdrawnAt: now };
  await writeState(customerRef, "consent", record);
  return record;
}
