import "server-only";

import { cookies } from "next/headers";

import type { CoachContext } from "@/lib/coach/tools";
import { loadBenchmarks, loadCustomer } from "@/lib/data/repository";
import { getEnv } from "@/lib/env";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from "@/lib/i18n/config";
import { getSessionCustomerRef } from "@/lib/security/session";

export async function currentLocale(preferred?: unknown): Promise<Locale> {
  if (isLocale(preferred)) return preferred;
  const stored = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(stored) ? stored : DEFAULT_LOCALE;
}

export type SessionContext = CoachContext & { customerRef: string };

/**
 * Builds the context for the signed-in customer. The customer comes from the
 * server session only; nothing in a request can select a different one.
 */
export async function getSessionContext(preferredLocale?: unknown): Promise<SessionContext | null> {
  const customerRef = await getSessionCustomerRef();
  if (!customerRef) return null;
  const record = await loadCustomer(customerRef);
  if (!record) return null;
  return {
    customerRef,
    record,
    asOf: getEnv().DEMO_AS_OF_DATE,
    locale: await currentLocale(preferredLocale),
    benchmarks: await loadBenchmarks(),
  };
}

export function unauthorized(): Response {
  return Response.json({ error: "unauthorized" }, { status: 401 });
}
