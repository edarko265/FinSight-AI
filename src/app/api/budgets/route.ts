import { z } from "zod";

import { discretionaryByCategory } from "@/lib/coach/advice";
import { BUDGET_TARGETS, budgetStatuses, deleteBudget, setBudget } from "@/lib/coach/budgets";
import { getSessionContext, termsRequired, unauthorized } from "@/lib/coach/context";

/** The customer's monthly limits with how this month is going, and typical amounts to suggest. */
export async function GET(): Promise<Response> {
  const ctx = await getSessionContext();
  if (!ctx) return unauthorized();
  const blocked = await termsRequired(ctx);
  if (blocked) return blocked;
  return Response.json({
    budgets: await budgetStatuses(ctx),
    targets: BUDGET_TARGETS,
    // What the customer usually spends by free-choice category, as a starting point for a limit.
    typical: discretionaryByCategory(ctx),
  });
}

const body = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("set"),
    target: z.enum(BUDGET_TARGETS),
    cents: z.number().int().min(100).max(10_000_000),
  }),
  z.object({ action: z.literal("delete"), id: z.string().min(1).max(80) }),
]);

export async function POST(request: Request): Promise<Response> {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });
  const ctx = await getSessionContext();
  if (!ctx) return unauthorized();
  const blocked = await termsRequired(ctx);
  if (blocked) return blocked;
  if (parsed.data.action === "set") {
    const result = await setBudget(ctx.customerRef, parsed.data);
    if (typeof result === "string") return Response.json({ error: result }, { status: 400 });
    return Response.json({ ok: true });
  }
  return (await deleteBudget(ctx.customerRef, parsed.data.id))
    ? Response.json({ ok: true })
    : Response.json({ error: "not_found" }, { status: 404 });
}
