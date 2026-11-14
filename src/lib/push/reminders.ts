import { readConsent } from "@/lib/coach/consent";
import "server-only";

import { takeDueAnnouncements } from "@/lib/admin/announcements";
import { allInsights } from "@/lib/coach/all-insights";
import { personalRecord, type SessionContext } from "@/lib/coach/context";
import { loadBenchmarks, loadCustomer } from "@/lib/data/repository";
import { getEnv } from "@/lib/env";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n/translate";
import { mayNotify, readPrefs, typeOfInsight } from "@/lib/push/prefs";
import {
  alreadySent,
  customersWithDevices,
  markSent,
  pushLocale,
  pushToCustomer,
  pushToEveryone,
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
  // Announcements that were scheduled and whose time has come go out first.
  for (const notice of await takeDueAnnouncements()) {
    await pushToEveryone({ title: notice.title, body: notice.body, url: "/insights" });
  }
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
    const ctx: SessionContext = {
      customerRef,
      record,
      asOf,
      locale,
      benchmarks,
      consent: await readConsent(customerRef),
    };

    const prefs = await readPrefs(customerRef);
    const now = new Date();
    const done = await alreadySent(customerRef);
    const next = (await allInsights(ctx)).find(
      (insight) =>
        !insight.id.startsWith("announcement-") &&
        insight.severity !== "good" &&
        !done.has(insight.id) &&
        // Only the kinds this customer asked for, and never during their quiet hours.
        mayNotify(prefs, typeOfInsight(insight.id), now),
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
