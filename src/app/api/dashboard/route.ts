import { getSessionContext, unauthorized } from "@/lib/coach/context";
import { dashboardStateSchema, loadDashboard, saveDashboard } from "@/lib/coach/views";

/** The customer's saved views, with the active view's widgets calculated for its period. */
export async function GET(request: Request): Promise<Response> {
  const ctx = await getSessionContext(new URL(request.url).searchParams.get("locale"));
  if (!ctx) return unauthorized();
  return Response.json(await loadDashboard(ctx));
}

/** Replaces the saved views (add, rename, delete, switch, change period, add or remove widgets). */
export async function PUT(request: Request): Promise<Response> {
  const parsed = dashboardStateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });
  const ctx = await getSessionContext(new URL(request.url).searchParams.get("locale"));
  if (!ctx) return unauthorized();
  return Response.json(await saveDashboard(ctx, parsed.data));
}
