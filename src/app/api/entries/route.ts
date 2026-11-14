import { z } from "zod";

import { recordUsage } from "@/lib/admin/usage";
import { CONSUMPTION_CATEGORIES } from "@/lib/analytics/classify";
import { addDays, isValidDate } from "@/lib/analytics/periods";
import { recordedBalance } from "@/lib/analytics/spending";
import { allInsights } from "@/lib/coach/all-insights";
import {
  getSessionContext,
  termsRequired,
  unauthorized,
  type SessionContext,
} from "@/lib/coach/context";
import { addEntry, deleteEntry, listEntries, updateEntry } from "@/lib/coach/entries";
import { ENTRY_KINDS, INCOME_SOURCES } from "@/lib/data/entries";

/** How far back an entry may be dated. */
const BACK_DAYS = 366;

/** The income and expenses the customer recorded themselves, newest first. */
export async function GET(): Promise<Response> {
  const ctx = await getSessionContext();
  if (!ctx) return unauthorized();
  const blocked = await termsRequired(ctx);
  if (blocked) return blocked;
  const entries = await listEntries(ctx.customerRef);
  return Response.json({
    asOf: ctx.asOf,
    earliest: addDays(ctx.asOf, -BACK_DAYS),
    balanceCents: recordedBalance(ctx.record.transactions, ctx.asOf)?.balanceCents ?? 0,
    categories: CONSUMPTION_CATEGORIES,
    sources: INCOME_SOURCES,
    entries: entries
      .map(({ id, kind, cents, date, category, note }) => ({
        id,
        kind,
        cents,
        date,
        category,
        note,
      }))
      .sort((a, b) => b.date.localeCompare(a.date)),
  });
}

const fields = {
  kind: z.enum(ENTRY_KINDS),
  cents: z.number().int().min(1).max(10_000_000),
  date: z.string().refine(isValidDate),
  category: z.string().min(1).max(40),
  note: z.string().max(60).default(""),
};
const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("add"), ...fields }),
  z.object({ action: z.literal("update"), id: z.string().min(1).max(80), ...fields }),
  z.object({ action: z.literal("delete"), id: z.string().min(1).max(80) }),
]);

const ALERT_LIMIT = 3;

/** What needs the customer's attention now that did not before the change. */
async function newAlerts(
  before: ReadonlySet<string>,
  locale: SessionContext["locale"],
): Promise<{ id: string; severity: string; title: string; body: string }[]> {
  const ctx = await getSessionContext(locale);
  if (!ctx) return [];
  return (await allInsights(ctx))
    .filter((insight) => insight.severity !== "good" && !before.has(insight.id))
    .slice(0, ALERT_LIMIT)
    .map(({ id, severity, title, body: text }) => ({ id, severity, title, body: text }));
}

export async function POST(request: Request): Promise<Response> {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });
  const ctx = await getSessionContext(new URL(request.url).searchParams.get("locale"));
  if (!ctx) return unauthorized();
  const blocked = await termsRequired(ctx);
  if (blocked) return blocked;
  const input = parsed.data;

  if (input.action === "delete") {
    return (await deleteEntry(ctx.customerRef, input.id))
      ? Response.json({ ok: true, alerts: [] })
      : Response.json({ error: "not_found" }, { status: 404 });
  }

  const allowed: readonly string[] =
    input.kind === "income" ? INCOME_SOURCES : CONSUMPTION_CATEGORIES;
  if (
    !allowed.includes(input.category) ||
    input.date > ctx.asOf ||
    input.date < addDays(ctx.asOf, -BACK_DAYS)
  ) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }
  const before = new Set((await allInsights(ctx)).map((insight) => insight.id));
  if (input.action === "add") {
    const added = await addEntry(ctx.customerRef, input);
    if (typeof added === "string") return Response.json({ error: added }, { status: 400 });
    await recordUsage("widget", `entry_${input.kind}`, ctx.locale);
  } else if (!(await updateEntry(ctx.customerRef, input.id, input))) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  return Response.json({ ok: true, alerts: await newAlerts(before, ctx.locale) });
}
