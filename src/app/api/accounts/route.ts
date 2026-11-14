import { z } from "zod";

import { recordUsage } from "@/lib/admin/usage";
import { getSessionContext, termsRequired, unauthorized } from "@/lib/coach/context";
import { linkAccount, listLinked, unlinkAccount, updateLinked } from "@/lib/coach/personal";
import { addToTrash } from "@/lib/coach/trash";
import { DEMO_BANKS, LINKED_KINDS } from "@/lib/data/linked-accounts";

/**
 * The customer's accounts: the bank's own, and any linked from other banks.
 * Linked accounts are a simulation (made-up banks, generated transactions);
 * every response says so through `simulated`.
 */
export async function GET(): Promise<Response> {
  const ctx = await getSessionContext();
  if (!ctx) return unauthorized();
  const blocked = await termsRequired(ctx);
  if (blocked) return blocked;
  const main = ctx.record.transactions.filter((tx) => !tx.account).at(-1);
  return Response.json({
    banks: DEMO_BANKS,
    kinds: LINKED_KINDS,
    accounts: ctx.record.accounts ?? [
      {
        id: "main",
        kind: "main",
        balanceCents: main?.balanceCents ?? 0,
        included: true,
        simulated: false,
      },
    ],
    linked: await listLinked(ctx.customerRef),
  });
}

const body = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("link"),
    bank: z.enum(DEMO_BANKS),
    kind: z.enum(LINKED_KINDS),
    nickname: z.string().trim().min(1).max(40),
    included: z.boolean(),
  }),
  z.object({
    action: z.literal("update"),
    id: z.string().min(1).max(80),
    nickname: z.string().trim().min(1).max(40).optional(),
    included: z.boolean().optional(),
  }),
  z.object({ action: z.literal("unlink"), id: z.string().min(1).max(80) }),
]);

export async function POST(request: Request): Promise<Response> {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });
  const ctx = await getSessionContext();
  if (!ctx) return unauthorized();
  const blocked = await termsRequired(ctx);
  if (blocked) return blocked;
  const input = parsed.data;

  if (input.action === "link") {
    const linked = await linkAccount(ctx.customerRef, input, ctx.asOf);
    if (typeof linked === "string") return Response.json({ error: linked }, { status: 400 });
    await recordUsage("widget", "account_linked", ctx.locale);
    return Response.json({ ok: true });
  }
  if (input.action === "update") {
    return (await updateLinked(ctx.customerRef, input.id, input))
      ? Response.json({ ok: true })
      : Response.json({ error: "not_found" }, { status: 404 });
  }
  const removed = await unlinkAccount(ctx.customerRef, input.id);
  if (!removed) return Response.json({ error: "not_found" }, { status: 404 });
  await addToTrash(ctx.customerRef, [
    {
      id: `trash-${crypto.randomUUID()}`,
      kind: "account",
      deletedAt: new Date().toISOString(),
      label: removed.nickname,
      item: removed,
    },
  ]);
  return Response.json({ ok: true });
}
