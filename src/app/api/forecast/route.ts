import { z } from "zod";

import { getSessionContext, unauthorized } from "@/lib/coach/context";
import { forecastFor } from "@/lib/coach/tools";

const body = z.object({
  horizonDays: z.number().int().min(1).max(31).optional(),
  protectedCents: z.number().int().min(0).max(100_000_000).optional(),
  otherOutflowsCents: z.number().int().min(0).max(100_000_000).optional(),
  includeExpectedIncome: z.boolean().optional(),
});

/** Re-runs the safe-to-spend estimate with the user's own assumptions. */
export async function POST(request: Request): Promise<Response> {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });
  const ctx = await getSessionContext();
  if (!ctx) return unauthorized();
  return Response.json(forecastFor(ctx, parsed.data));
}
