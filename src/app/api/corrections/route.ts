import { z } from "zod";

import { classifyByRules } from "@/lib/analytics/classify";
import { detectRegularBills, detectRegularBillsUnadjusted } from "@/lib/analytics/recurrence";
import { getSessionContext, termsRequired, unauthorized } from "@/lib/coach/context";
import {
  adjustBill,
  correctBasket,
  kindKey,
  readCorrections,
  undoAllCorrections,
  undoCorrection,
} from "@/lib/coach/personal";
import { transactionKey } from "@/lib/data/linked-accounts";

/**
 * The customer's own corrections: which basket a purchase belongs to, and
 * what an expected bill really is. Each is listed with what the rules or the
 * history said, so it can be compared and undone.
 */
export async function GET(): Promise<Response> {
  const ctx = await getSessionContext();
  if (!ctx) return unauthorized();
  const blocked = await termsRequired(ctx);
  if (blocked) return blocked;
  const corrections = await readCorrections(ctx.customerRef);
  const txs = ctx.record.transactions;

  const transactions = Object.entries(corrections.transactions).flatMap(([key, override]) => {
    const tx = txs.find((candidate) => transactionKey(candidate) === key);
    if (!tx) return [];
    const original = classifyByRules(tx);
    return [
      {
        key,
        date: tx.date,
        amountCents: tx.amountCents,
        category: tx.category,
        original: { basket: original.basket, necessity: original.necessity },
        override,
      },
    ];
  });
  const kinds = Object.entries(corrections.kinds).map(([key, override]) => {
    const [category = "", mcc = ""] = key.split("|");
    const sample = txs.find((candidate) => kindKey(candidate) === key);
    const original = sample ? classifyByRules(sample) : null;
    return {
      key,
      category,
      mcc: mcc || null,
      count: txs.filter((candidate) => kindKey(candidate) === key).length,
      original: original ? { basket: original.basket, necessity: original.necessity } : null,
      override,
    };
  });
  const suggested = detectRegularBillsUnadjusted(txs, ctx.asOf);
  const current = detectRegularBills(txs, ctx.asOf);
  const bills = suggested.map((bill) => {
    const now = current.find((candidate) => candidate.category === bill.category);
    return {
      category: bill.category,
      suggested: { cents: bill.typicalMonthlyCents, day: bill.typicalDay },
      current: now ? { cents: now.typicalMonthlyCents, day: now.typicalDay } : null,
      adjustment: corrections.bills[bill.category] ?? null,
    };
  });
  return Response.json({ transactions, kinds, bills });
}

const override = {
  basket: z.enum(["regular", "irregular", "everyday"]),
  necessity: z.enum(["essential", "discretionary"]),
};
const key = z.string().min(1).max(120);
const body = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("basket"),
    scope: z.enum(["transaction", "kind"]),
    key,
    ...override,
  }),
  z.object({
    action: z.literal("bill"),
    category: z.string().min(1).max(40),
    cents: z.number().int().min(0).max(10_000_000).optional(),
    day: z.number().int().min(1).max(31).optional(),
    skip: z.boolean().optional(),
  }),
  z.object({ action: z.literal("undo"), scope: z.enum(["transaction", "kind", "bill"]), key }),
  z.object({ action: z.literal("undo_all") }),
]);

export async function POST(request: Request): Promise<Response> {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });
  const ctx = await getSessionContext();
  if (!ctx) return unauthorized();
  const blocked = await termsRequired(ctx);
  if (blocked) return blocked;
  const input = parsed.data;
  switch (input.action) {
    case "basket":
      await correctBasket(
        ctx.customerRef,
        { scope: input.scope, key: input.key },
        { basket: input.basket, necessity: input.necessity },
      );
      break;
    case "bill":
      await adjustBill(ctx.customerRef, input.category, {
        cents: input.cents,
        day: input.day,
        skip: input.skip,
      });
      break;
    case "undo":
      await undoCorrection(ctx.customerRef, input.scope, input.key);
      break;
    case "undo_all":
      await undoAllCorrections(ctx.customerRef);
      break;
  }
  return Response.json({ ok: true });
}
