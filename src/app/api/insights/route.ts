import { countAnnouncementViews } from "@/lib/admin/announcements";
import { allInsights } from "@/lib/coach/all-insights";
import { getSessionContext, termsRequired, unauthorized } from "@/lib/coach/context";
import { readState, writeState } from "@/lib/data/repository";

const PREFIX = "announcement-";
const UUID_LENGTH = 36;

export async function GET(request: Request): Promise<Response> {
  const ctx = await getSessionContext(new URL(request.url).searchParams.get("locale"));
  if (!ctx) return unauthorized();
  const blocked = await termsRequired(ctx);
  if (blocked) return blocked;
  const read = new Set((await readState<string[]>(ctx.customerRef, "insights_read")) ?? []);
  const insights = await allInsights(ctx);

  // Reach: each customer counts once per announcement. Which ones a customer has seen stays in
  // their own sealed state; the announcement only gets a number.
  const seen = new Set((await readState<string[]>(ctx.customerRef, "announcements_seen")) ?? []);
  const fresh = insights
    .filter((insight) => insight.id.startsWith(PREFIX))
    .map((insight) => insight.id.slice(PREFIX.length, PREFIX.length + UUID_LENGTH))
    .filter((id) => !seen.has(id));
  if (fresh.length > 0) {
    await countAnnouncementViews(fresh);
    await writeState(ctx.customerRef, "announcements_seen", [...seen, ...fresh].slice(-200));
  }

  return Response.json({
    insights: insights.map((insight) => ({ ...insight, read: read.has(insight.id) })),
  });
}

/** Marks every current insight as read. */
export async function POST(): Promise<Response> {
  const ctx = await getSessionContext();
  if (!ctx) return unauthorized();
  const blocked = await termsRequired(ctx);
  if (blocked) return blocked;
  await writeState(
    ctx.customerRef,
    "insights_read",
    (await allInsights(ctx)).map((insight) => insight.id),
  );
  return Response.json({ ok: true });
}
