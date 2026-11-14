import { z } from "zod";

import { getSessionContext, termsRequired, unauthorized } from "@/lib/coach/context";
import { restoreGoal } from "@/lib/coach/goals";
import { emptyTrash, listTrash, takeFromTrash } from "@/lib/coach/trash";
import { restoreToDashboard } from "@/lib/coach/views";

/** The customer's recycle bin. */
export async function GET(): Promise<Response> {
  const ctx = await getSessionContext();
  if (!ctx) return unauthorized();
  const blocked = await termsRequired(ctx);
  if (blocked) return blocked;
  const items = await listTrash(ctx.customerRef);
  return Response.json({
    items: items.map(({ id, kind, label, deletedAt }) => ({ id, kind, label, deletedAt })),
  });
}

const body = z.union([
  z.object({ id: z.string().min(1).max(80), action: z.enum(["restore", "delete"]) }),
  z.object({ action: z.literal("empty") }),
]);

/** Restores an item, deletes it permanently, or empties the bin. */
export async function POST(request: Request): Promise<Response> {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });
  const ctx = await getSessionContext();
  if (!ctx) return unauthorized();
  const blocked = await termsRequired(ctx);
  if (blocked) return blocked;

  if (parsed.data.action === "empty") {
    await emptyTrash(ctx.customerRef);
    return Response.json({ ok: true });
  }
  const item = await takeFromTrash(ctx.customerRef, parsed.data.id);
  if (!item) return Response.json({ error: "not_found" }, { status: 404 });
  if (parsed.data.action === "restore") {
    if (item.kind === "goal") await restoreGoal(ctx, item.item);
    else await restoreToDashboard(ctx, item);
  }
  return Response.json({ ok: true });
}
