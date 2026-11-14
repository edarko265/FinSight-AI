import "server-only";

import { allInsights } from "@/lib/coach/all-insights";
import { personalRecord, type SessionContext } from "@/lib/coach/context";
import { loadBenchmarks, loadCustomer } from "@/lib/data/repository";
import { getEnv } from "@/lib/env";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n/translate";
import {
  alreadySent,
  customersWithDevices,
  markSent,
  pushLocale,
  pushToCustomer,
} from "@/lib/push/push";

export interface ReminderRun {
  customers: number;
  sent: number;
}

/**
 * The reminder job: for every customer with notifications on, works out what
 * needs their attention (a goal to put money towards, a bill due, a habit
 * going the wrong way, a possible shortfall) and sends one notification for
 * the most important thing they have not been told about yet.
 *
 * The notification carries the headline only. Amounts stay in the app: the
 * body just says to open it.
 */
export async function runReminders(): Promise<ReminderRun> {
  const refs = await customersWithDevices();
  const benchmarks = await loadBenchmarks();
  const asOf = getEnv().DEMO_AS_OF_DATE;
  let sent = 0;

  for (const customerRef of refs) {
    const base = await loadCustomer(customerRef);
    if (!base) continue;
    const record = await personalRecord(customerRef, base, asOf);
    const stored = await pushLocale(customerRef);
    const locale = isLocale(stored) ? stored : DEFAULT_LOCALE;
    const ctx: SessionContext = { customerRef, record, asOf, locale, benchmarks };

    const done = await alreadySent(customerRef);
    const next = (await allInsights(ctx)).find(
      (insight) =>
        !insight.id.startsWith("announcement-") &&
        insight.severity !== "good" &&
        !done.has(insight.id),
    );
    if (!next) continue;

    const reached = await pushToCustomer(customerRef, {
      title: next.title,
      body: translate(locale, "notify.reminder.body"),
      url: "/insights",
      tag: next.id,
    });
    if (reached > 0) {
      sent += 1;
      await markSent(customerRef, [next.id]);
    }
  }
  return { customers: refs.length, sent };
}
