import { z } from "zod";

import { refuse } from "@/lib/admin/auth";
import { audit } from "@/lib/admin/settings";
import { listTaught, setTaughtState, updateTaught } from "@/lib/coach/taught";
import { taughtInputSchema } from "@/lib/coach/taught-schema";

const action = z.object({ action: z.enum(["trash", "restore", "purge"]) });

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/admin/training/[id]">,
): Promise<Response> {
  const refused = await refuse("staff");
  if (refused) return refused;
  const parsed = taughtInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });
  await updateTaught((await context.params).id, parsed.data);
  await audit("training.edit", parsed.data.theme);
  return Response.json({ answers: await listTaught() });
}

export async function POST(
  request: Request,
  context: RouteContext<"/api/admin/training/[id]">,
): Promise<Response> {
  const refused = await refuse("staff");
  if (refused) return refused;
  const parsed = action.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });
  await setTaughtState((await context.params).id, parsed.data.action);
  await audit(`training.${parsed.data.action}`);
  return Response.json({ answers: await listTaught() });
}
