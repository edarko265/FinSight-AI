import { z } from "zod";

import { getSettings } from "@/lib/admin/settings";
import { getSessionContext, termsRequired, unauthorized } from "@/lib/coach/context";
import { actualSplit, applySplit, SLICES, TEMPLATES } from "@/lib/coach/plan-math";
import {
  copyPlan,
  createPlan,
  deletePlan,
  goalShares,
  listedPlans,
  listPlans,
  normaliseCode,
  reconcileShares,
  sharedPlan,
  sharePlan,
  unsharePlan,
  updatePlan,
} from "@/lib/coach/plans";
import { rateLimit } from "@/lib/security/session";

const failure = (error: string, status = 400): Response => Response.json({ error }, { status });

/**
 * The customer's plans, how their month is actually split, and plans others
 * have listed. With `?code=` it previews one shared plan instead.
 *
 * Amounts in the response are the signed-in customer's own, worked out from
 * their own income. Nothing here carries anyone else's amounts: shared plans
 * hold percentages only.
 */
export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const ctx = await getSessionContext(params.get("locale"));
  if (!ctx) return unauthorized();
  const blocked = await termsRequired(ctx);
  if (blocked) return blocked;
  const { features } = await getSettings();
  const actual = actualSplit(ctx.record.transactions, ctx.asOf);

  const code = params.get("code");
  if (code !== null) {
    if (!features.sharing) return failure("sharing_off", 403);
    // Codes are random, and looking them up is limited so they cannot be guessed in bulk.
    if (!(await rateLimit(`plan-code:${ctx.customerRef}`, 20, 60_000))) {
      return failure("too_many_attempts", 429);
    }
    const shared = await sharedPlan(code);
    if (!shared) return failure("not_found", 404);
    return Response.json({
      plan: shared,
      forMe: applySplit(shared.split, actual.incomeCents),
      actual,
    });
  }

  const plans = await reconcileShares(ctx, await listPlans(ctx));
  const mine = new Set(plans.map((plan) => plan.shareCode).filter(Boolean));
  return Response.json({
    sharing: features.sharing,
    actual,
    goals: await goalShares(ctx),
    templates: TEMPLATES,
    plans: plans.map((plan) => ({ ...plan, forMe: applySplit(plan.split, actual.incomeCents) })),
    listed: features.sharing
      ? (await listedPlans()).map((plan) => ({ ...plan, mine: mine.has(plan.code) }))
      : [],
  });
}

const split = z.object(
  Object.fromEntries(SLICES.map((key) => [key, z.number().int().min(0).max(100)])) as Record<
    (typeof SLICES)[number],
    z.ZodNumber
  >,
);
const name = z.string().trim().min(1).max(60);
const id = z.string().min(1).max(80);

const body = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    name,
    split,
    origin: z.enum(["own", "template"]),
  }),
  z.object({ action: z.literal("update"), id, name, split }),
  z.object({ action: z.literal("delete"), id }),
  z.object({
    action: z.literal("share"),
    id,
    listed: z.boolean(),
    showGoalNames: z.boolean(),
  }),
  z.object({ action: z.literal("unshare"), id }),
  z.object({ action: z.literal("copy"), code: z.string().min(4).max(20) }),
]);

export async function POST(request: Request): Promise<Response> {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return failure("invalid_request");
  const ctx = await getSessionContext();
  if (!ctx) return unauthorized();
  const blocked = await termsRequired(ctx);
  if (blocked) return blocked;
  const input = parsed.data;
  const { features } = await getSettings();
  if (!features.sharing && (input.action === "share" || input.action === "copy")) {
    return failure("sharing_off", 403);
  }

  let result: unknown;
  switch (input.action) {
    case "create":
      result = await createPlan(ctx, input);
      break;
    case "update":
      result = await updatePlan(ctx, input.id, input);
      break;
    case "delete":
      result = (await deletePlan(ctx, input.id)) || "not_found";
      break;
    case "share":
      result = await sharePlan(ctx, input.id, input);
      break;
    case "unshare":
      result = (await unsharePlan(ctx, input.id)) || "not_found";
      break;
    case "copy":
      if (!(await rateLimit(`plan-code:${ctx.customerRef}`, 20, 60_000))) {
        return failure("too_many_attempts", 429);
      }
      result = await copyPlan(ctx, normaliseCode(input.code));
      break;
  }
  if (typeof result === "string") return failure(result, result === "not_found" ? 404 : 400);
  return Response.json({ ok: true, plan: typeof result === "object" ? result : undefined });
}
