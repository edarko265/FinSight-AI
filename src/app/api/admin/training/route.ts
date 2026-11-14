import { refuse } from "@/lib/admin/auth";
import { audit } from "@/lib/admin/settings";
import { createTaught, listTaught } from "@/lib/coach/taught";
import { taughtInputSchema } from "@/lib/coach/taught-schema";

/** Answers staff have taught the coach. Advisers and bankers write these too: they are the experts. */
export async function GET(): Promise<Response> {
  const refused = await refuse("staff");
  if (refused) return refused;
  return Response.json({ answers: await listTaught() });
}

export async function POST(request: Request): Promise<Response> {
  const refused = await refuse("staff");
  if (refused) return refused;
  const parsed = taughtInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });
  await createTaught(parsed.data);
  await audit("training.create", parsed.data.theme);
  return Response.json({ answers: await listTaught() });
}
