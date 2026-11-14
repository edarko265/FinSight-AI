import "server-only";

import { cookies } from "next/headers";

import { consentFrom, hasAcceptedTerms, type ConsentRecord } from "@/lib/coach/consent";
import type { Goal } from "@/lib/coach/advice";
import { PERSONAL_KINDS, personalise } from "@/lib/coach/personal";
import type { CoachContext } from "@/lib/coach/tools";
import { loadBenchmarks, loadCustomer, readStates } from "@/lib/data/repository";
import type { CustomerRecord } from "@/lib/data/types";
import { getEnv } from "@/lib/env";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from "@/lib/i18n/config";
import { getSessionCustomerRef } from "@/lib/security/session";

export async function currentLocale(preferred?: unknown): Promise<Locale> {
  if (isLocale(preferred)) return preferred;
  const stored = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(stored) ? stored : DEFAULT_LOCALE;
}

export type SessionContext = CoachContext & {
  customerRef: string;
  /** What the customer had agreed to when the request began. */
  consent: ConsentRecord;
};

/** Everything a request needs to know about the customer, fetched in one read. */
const CONTEXT_KINDS = [...PERSONAL_KINDS, "goals", "consent"] as const;

/** One customer's full picture. Money set aside only counts while its goal still exists. */
export async function personalRecord(
  customerRef: string,
  base: CustomerRecord,
  asOf: string,
): Promise<CustomerRecord> {
  const states = await readStates(customerRef, CONTEXT_KINDS);
  const goals = (states.get("goals") as Goal[] | undefined) ?? [];
  return personalise(customerRef, base, asOf, new Set(goals.map((goal) => goal.id)), states);
}

/**
 * Builds the context for the signed-in customer. The customer comes from the
 * server session only; nothing in a request can select a different one.
 */
export async function getSessionContext(preferredLocale?: unknown): Promise<SessionContext | null> {
  const customerRef = await getSessionCustomerRef();
  if (!customerRef) return null;
  // One trip to the database for the three things every request needs, side by side.
  const [base, states, benchmarks] = await Promise.all([
    loadCustomer(customerRef),
    readStates(customerRef, CONTEXT_KINDS),
    loadBenchmarks(),
  ]);
  if (!base) return null;
  const asOf = getEnv().DEMO_AS_OF_DATE;
  const goals = (states.get("goals") as Goal[] | undefined) ?? [];
  return {
    customerRef,
    // The bank's record plus what the customer added: linked accounts, corrections, set-asides.
    record: await personalise(
      customerRef,
      base,
      asOf,
      new Set(goals.map((goal) => goal.id)),
      states,
    ),
    asOf,
    locale: await currentLocale(preferredLocale),
    benchmarks,
    consent: consentFrom(states.get("consent")),
  };
}

export function unauthorized(): Response {
  return Response.json({ error: "unauthorized" }, { status: 401 });
}

/**
 * Blocks a request until the customer has accepted the terms of use and the
 * privacy notice. Returns a response to send, or null to carry on. Used by
 * every route that shows or changes customer data.
 */
export async function termsRequired(ctx: SessionContext): Promise<Response | null> {
  if (hasAcceptedTerms(ctx.consent)) return null;
  return Response.json({ error: "terms_required" }, { status: 403 });
}
