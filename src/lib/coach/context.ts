import "server-only";

import { cookies } from "next/headers";

import { hasAcceptedTerms, readConsent } from "@/lib/coach/consent";
import type { Goal } from "@/lib/coach/advice";
import { personalise } from "@/lib/coach/personal";
import type { CoachContext } from "@/lib/coach/tools";
import { loadBenchmarks, loadCustomer, readState } from "@/lib/data/repository";
import type { CustomerRecord } from "@/lib/data/types";
import { getEnv } from "@/lib/env";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from "@/lib/i18n/config";
import { getSessionCustomerRef } from "@/lib/security/session";

export async function currentLocale(preferred?: unknown): Promise<Locale> {
  if (isLocale(preferred)) return preferred;
  const stored = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(stored) ? stored : DEFAULT_LOCALE;
}

export type SessionContext = CoachContext & { customerRef: string };

/** One customer's full picture. Money set aside only counts while its goal still exists. */
export async function personalRecord(
  customerRef: string,
  base: CustomerRecord,
  asOf: string,
): Promise<CustomerRecord> {
  const goals = (await readState<Goal[]>(customerRef, "goals")) ?? [];
  return personalise(customerRef, base, asOf, new Set(goals.map((goal) => goal.id)));
}

/**
 * Builds the context for the signed-in customer. The customer comes from the
 * server session only; nothing in a request can select a different one.
 */
export async function getSessionContext(preferredLocale?: unknown): Promise<SessionContext | null> {
  const customerRef = await getSessionCustomerRef();
  if (!customerRef) return null;
  const base = await loadCustomer(customerRef);
  if (!base) return null;
  const asOf = getEnv().DEMO_AS_OF_DATE;
  return {
    customerRef,
    // The bank's record plus what the customer added: linked accounts, corrections, set-asides.
    record: await personalRecord(customerRef, base, asOf),
    asOf,
    locale: await currentLocale(preferredLocale),
    benchmarks: await loadBenchmarks(),
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
  if (hasAcceptedTerms(await readConsent(ctx.customerRef))) return null;
  return Response.json({ error: "terms_required" }, { status: 403 });
}
