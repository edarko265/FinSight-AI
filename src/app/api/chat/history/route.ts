import { clearHistory, readHistory } from "@/lib/coach/chat-history";
import { getSessionContext, termsRequired, unauthorized } from "@/lib/coach/context";
import { addToTrash } from "@/lib/coach/trash";

/** The customer's saved conversation. */
export async function GET(): Promise<Response> {
  const ctx = await getSessionContext();
  if (!ctx) return unauthorized();
  const blocked = await termsRequired(ctx);
  if (blocked) return blocked;
  return Response.json({ messages: await readHistory(ctx.customerRef) });
}

/** Clears the conversation. It goes to the recycle bin, from where it can be restored. */
export async function DELETE(): Promise<Response> {
  const ctx = await getSessionContext();
  if (!ctx) return unauthorized();
  const blocked = await termsRequired(ctx);
  if (blocked) return blocked;
  const messages = await clearHistory(ctx.customerRef);
  if (messages.length > 0) {
    await addToTrash(ctx.customerRef, [
      {
        id: `trash-${crypto.randomUUID()}`,
        kind: "chat",
        deletedAt: new Date().toISOString(),
        label: String(messages.length),
        item: messages,
      },
    ]);
  }
  return Response.json({ ok: true });
}
