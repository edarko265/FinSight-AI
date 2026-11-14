import { getSessionContext, termsRequired, unauthorized } from "@/lib/coach/context";
import { runTool } from "@/lib/coach/registry";
import type { ToolResult } from "@/lib/coach/tools";
import type { ChartCard } from "@/lib/contracts/chart";

export interface StorySlide {
  id: string;
  title: string;
  text: string;
  card: ChartCard;
  lesson?: string;
}

/**
 * "My month in 30 seconds": the last completed month told as a short sequence
 * of slides. Every slide is one of the coach's ordinary calculations, so the
 * figures are the same ones the chat and dashboard show.
 */
export async function GET(request: Request): Promise<Response> {
  const ctx = await getSessionContext(new URL(request.url).searchParams.get("locale"));
  if (!ctx) return unauthorized();
  const blocked = await termsRequired(ctx);
  if (blocked) return blocked;

  const steps: [string, ToolResult][] = [
    ["flow", runTool(ctx, "flow", { period: "last_month" })],
    ["baskets", runTool(ctx, "baskets", { period: "last_month" })],
    ["spending", runTool(ctx, "spending", { period: "last_month" })],
    ["trend", runTool(ctx, "trend", { months: 6 })],
    ["recommend", runTool(ctx, "recommend", {})],
    ["safe", runTool(ctx, "safe_to_spend", { horizonDays: 7 })],
  ];
  const slides: StorySlide[] = steps.flatMap(([id, result]) =>
    result.card
      ? [
          {
            id,
            title: result.card.title,
            text: result.text,
            card: result.card,
            lesson: result.lesson,
          },
        ]
      : [],
  );
  return Response.json({ slides });
}
