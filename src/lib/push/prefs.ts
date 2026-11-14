import "server-only";

import { readState, writeState } from "@/lib/data/repository";

/**
 * What a customer wants to be notified about, and when not to be disturbed.
 * These apply to notifications on the device; everything still appears in the
 * app under Insights.
 */
export const NOTIFY_TYPES = [
  "shortfall",
  "habit",
  "bill",
  "goal",
  "plan",
  "budget",
  "tips",
  "announcement",
] as const;
export type NotifyType = (typeof NOTIFY_TYPES)[number];

export interface NotifyPrefs {
  types: Record<NotifyType, boolean>;
  /** Hours of the day, 0–23, in Finnish time. Null means no quiet hours. */
  quiet: { from: number; to: number } | null;
}

const KIND = "notify_prefs";
export const DEFAULT_PREFS: NotifyPrefs = {
  types: Object.fromEntries(NOTIFY_TYPES.map((type) => [type, true])) as Record<
    NotifyType,
    boolean
  >,
  quiet: { from: 21, to: 8 },
};

export async function readPrefs(ref: string): Promise<NotifyPrefs> {
  const stored = await readState<Partial<NotifyPrefs>>(ref, KIND);
  return {
    types: { ...DEFAULT_PREFS.types, ...stored?.types },
    quiet: stored && "quiet" in stored ? (stored.quiet ?? null) : DEFAULT_PREFS.quiet,
  };
}

export const writePrefs = (ref: string, prefs: NotifyPrefs): Promise<void> =>
  writeState(ref, KIND, prefs);

/** Which kind of notification an insight is, from its identifier. */
export function typeOfInsight(id: string): NotifyType {
  const prefix = id.split("-")[0] ?? "";
  if (prefix === "announcement") return "announcement";
  if (prefix === "shortfall" || prefix === "buffer") return "shortfall";
  if (prefix === "pace") return "habit";
  if (prefix === "bill") return "bill";
  if (prefix === "goal") return "goal";
  if (prefix === "plan") return "plan";
  if (prefix === "budget") return "budget";
  return "tips";
}

/** The hour of the day in Finland, where the bank's customers are. */
function hourInFinland(now: Date): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      hourCycle: "h23",
      timeZone: "Europe/Helsinki",
    })
      .format(now)
      .slice(0, 2),
  );
}

/** True when `hour` falls inside the quiet period, which may run past midnight. */
export function isQuiet(prefs: NotifyPrefs, hour: number): boolean {
  if (!prefs.quiet) return false;
  const { from, to } = prefs.quiet;
  if (from === to) return false;
  return from < to ? hour >= from && hour < to : hour >= from || hour < to;
}

/** Whether a notification of this type may go to this customer's devices right now. */
export function mayNotify(prefs: NotifyPrefs, type: NotifyType, now: Date): boolean {
  return prefs.types[type] && !isQuiet(prefs, hourInFinland(now));
}
