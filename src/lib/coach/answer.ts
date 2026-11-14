import "server-only";

import { askModel } from "@/lib/coach/llm";
import { OUTSIDE_THEMES, themeOf } from "@/lib/admin/themes";
import { recordUsage } from "@/lib/admin/usage";
import type { SessionContext } from "@/lib/coach/context";
import { checkGrounding } from "@/lib/coach/grounding";
import { goalsResult, setGoal } from "@/lib/coach/goals";
import { detectGoal, routeQuestion } from "@/lib/coach/router";
import { explain } from "@/lib/coach/steps";
import { findTaught } from "@/lib/coach/taught";
import type { ToolResult } from "@/lib/coach/tools";
import type { AssistantMessage } from "@/lib/contracts/chat";

const MAX_QUESTION = 4000;

/** An answer written by the bank's staff, shown exactly as they approved it. */
function taughtMessage(text: string): CoachAnswer {
  return {
    message: { id: `assistant-${crypto.randomUUID()}`, role: "assistant", text, mode: "team" },
    topic: "taught",
  };
}

function toMessage(
  ctx: SessionContext,
  result: ToolResult,
  text: string,
  mode: "ai" | "basic",
): AssistantMessage {
  const steps = explain(ctx, result);
  return {
    id: `assistant-${crypto.randomUUID()}`,
    role: "assistant",
    text,
    card: result.card,
    query: result.card ? result.query : undefined,
    facts: result.facts.length > 0 ? result.facts : undefined,
    evidence: result.evidence,
    lesson: result.lesson,
    followUps: result.followUps.length > 0 ? result.followUps : undefined,
    steps: steps.length > 0 ? steps : undefined,
    mode,
  };
}

export interface CoachAnswer {
  message: AssistantMessage;
  /** What the question was about, for anonymous usage statistics. Never the question itself. */
  topic: string;
}

async function basicAnswer(ctx: SessionContext, question: string): Promise<ToolResult> {
  const goal = detectGoal(question);
  if (goal === "list") return goalsResult(ctx);
  if (goal) return setGoal(ctx, goal);
  return routeQuestion(ctx, question);
}

/**
 * Answers one question. With AI available the model chooses the tools and
 * writes the wording; the card, facts and evidence always come from the tool
 * results. If the model is off, fails or times out, basic mode answers.
 */
export async function answerQuestion(
  ctx: SessionContext,
  rawQuestion: string,
  history: { role: "user" | "assistant"; text: string }[] = [],
  options: { allowModel: boolean } = { allowModel: true },
): Promise<CoachAnswer> {
  const question = rawQuestion.trim().slice(0, MAX_QUESTION);
  // A subject no calculation covers (loans, insurance, taxes): if staff have taught an answer,
  // theirs is given before a keyword or the model can reach for a calculation that only looks
  // related, such as housing costs for a mortgage question.
  if (OUTSIDE_THEMES.has(themeOf(question))) {
    const taught = await findTaught(question, ctx.locale);
    if (taught) return taughtMessage(taught);
  }
  try {
    // Without the user's consent nothing is sent to a language model.
    const answer = options.allowModel ? await askModel(ctx, question, history) : null;
    if (answer) {
      const primary =
        [...answer.results].reverse().find((result) => result.card) ?? answer.results.at(-1);
      // The model may only repeat calculated figures. If its wording states an amount that no
      // calculation produced, the wording is dropped in favour of the calculation's own sentence.
      const grounded = checkGrounding(answer.text, answer.results).grounded;
      if (!grounded) {
        console.error("coach: unsupported amount in model text, using calculated wording");
        await recordUsage("grounding", "corrected", ctx.locale, "ai");
      }
      if (primary) {
        return {
          message: toMessage(ctx, primary, grounded ? answer.text : primary.text, "ai"),
          topic: primary.tool,
        };
      }
      // No calculation applies. If staff have taught an answer for this, theirs is given
      // rather than the model's own general wording.
      const taught = await findTaught(question, ctx.locale);
      if (taught) return taughtMessage(taught);
      // With no calculation behind it, an answer that states personal amounts is not shown at all.
      if (grounded) {
        return {
          message: {
            id: `assistant-${crypto.randomUUID()}`,
            role: "assistant",
            text: answer.text,
            mode: "ai",
          },
          topic: "conversation",
        };
      }
    }
  } catch (error) {
    console.error(
      "coach: model unavailable, using basic mode:",
      error instanceof Error ? error.name : "error",
    );
  }
  const result = await basicAnswer(ctx, question);
  if (result.tool === "none") {
    const taught = await findTaught(question, ctx.locale);
    if (taught) return taughtMessage(taught);
  }
  return { message: toMessage(ctx, result, result.text, "basic"), topic: result.tool };
}
