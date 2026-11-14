import { z } from "zod";

import { getSessionContext, termsRequired, unauthorized } from "@/lib/coach/context";
import { removeSetAside, setAside } from "@/lib/coach/goals";

const create = z.object({
  goalId: z.string().min(1).max(80).nullable(),
  cents: z.number().int().min(100).max(100_000_000),
  /** When it was set aside, if not today. */
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

/** Marks money as set aside for a goal. A simulation of saving: nothing is transferred. */
export async function POST(request: Request): Promise<Response> {
  const parsed = create.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });
  const ctx = await getSessionContext();
  if (!ctx) return unauthorized();
  const blocked = await termsRequired(ctx);
  if (blocked) return blocked;
  const result = await setAside(ctx, parsed.data);
  if (typeof result === "string") {
    return Response.json({ error: result }, { status: result === "not_found" ? 404 : 400 });
  }
  return Response.json({ ok: true });
}

const remove = z.object({ id: z.string().min(1).max(80) });

/** Takes a set-aside back; it goes to the recycle bin. */
export async function DELETE(request: Request): Promise<Response> {
  const parsed = remove.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });
  const ctx = await getSessionContext();
  if (!ctx) return unauthorized();
  const blocked = await termsRequired(ctx);
  if (blocked) return blocked;
  return (await removeSetAside(ctx, parsed.data.id))
    ? Response.json({ ok: true })
    : Response.json({ error: "not_found" }, { status: 404 });
}
