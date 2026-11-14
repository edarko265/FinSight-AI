import { z } from "zod";

import { classify, classifyByRules } from "@/lib/analytics/classify";
import { isValidDate } from "@/lib/analytics/periods";
import { filterSpending } from "@/lib/analytics/spending";
import { transactionKey } from "@/lib/data/linked-accounts";
import { getSessionContext, termsRequired, unauthorized } from "@/lib/coach/context";

const date = z.string().refine(isValidDate);
const list = z
  .string()
  .max(400)
  .transform((value) => value.split(",").filter(Boolean))
  .optional();
const query = z.object({
  start: date,
  end: date,
  categories: list,
  mccs: list,
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/** The transactions behind an answer, for the signed-in customer only, newest first. */
export async function GET(request: Request): Promise<Response> {
  const parsed = query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });
  const ctx = await getSessionContext();
  if (!ctx) return unauthorized();
  const blocked = await termsRequired(ctx);
  if (blocked) return blocked;

  const { start, end, categories, mccs, offset, limit } = parsed.data;
  const matches = filterSpending(ctx.record.transactions, {
    period: { startInclusive: start, endExclusive: end },
    categories,
    mccs,
  }).reverse();
  return Response.json({
    total: matches.length,
    totalCents: -matches.reduce((sum, tx) => sum + tx.amountCents, 0),
    items: matches.slice(offset, offset + limit).map((tx) => {
      const c = classify(tx);
      const original = classifyByRules(tx);
      return {
        // Identifies this transaction, and its kind, for the customer's own corrections.
        key: transactionKey(tx),
        kindKey: `${tx.category}|${tx.mcc ?? ""}`,
        account: tx.account ?? null,
        corrected: Boolean(tx.override),
        originalBasket: original.basket,
        originalNecessity: original.necessity,
        date: tx.date,
        time: tx.time,
        amountCents: tx.amountCents,
        category: tx.category,
        mcc: tx.mcc,
        merchantId: tx.merchantId,
        basket: c.basket,
        necessity: c.necessity,
      };
    }),
  });
}
