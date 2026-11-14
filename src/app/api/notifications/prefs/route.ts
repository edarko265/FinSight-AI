import { z } from "zod";

import { getSessionContext, termsRequired, unauthorized } from "@/lib/coach/context";
import { NOTIFY_TYPES, readPrefs, writePrefs } from "@/lib/push/prefs";

export async function GET(): Promise<Response> {
  const ctx = await getSessionContext();
  if (!ctx) return unauthorized();
  const blocked = await termsRequired(ctx);
  if (blocked) return blocked;
  return Response.json({ prefs: await readPrefs(ctx.customerRef), types: NOTIFY_TYPES });
}

const hour = z.number().int().min(0).max(23);
const body = z.object({
  types: z.object(
    Object.fromEntries(NOTIFY_TYPES.map((type) => [type, z.boolean()])) as Record<
      (typeof NOTIFY_TYPES)[number],
      z.ZodBoolean
    >,
  ),
  quiet: z.object({ from: hour, to: hour }).nullable(),
});

export async function PUT(request: Request): Promise<Response> {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });
  const ctx = await getSessionContext();
  if (!ctx) return unauthorized();
  const blocked = await termsRequired(ctx);
  if (blocked) return blocked;
  await writePrefs(ctx.customerRef, parsed.data);
  return Response.json({ prefs: parsed.data });
}
