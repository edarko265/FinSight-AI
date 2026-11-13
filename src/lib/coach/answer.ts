import "server-only";

import { askModel } from "@/lib/coach/llm";
import { routeQuestion } from "@/lib/coach/router";
import type { CoachContext, ToolResult } from "@/lib/coach/tools";
import type { AssistantMessage } from "@/lib/contracts/chat";

const MAX_QUESTION = 4000;

function toMessage(result: ToolResult, text: string, mode: "ai" | "basic"): AssistantMessage {
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
    mode,
  };
}

/**
 * Answers one question. With AI available the model chooses the tools and
 * writes the wording; the card, facts and evidence always come from the tool
 * results. If the model is off, fails or times out, basic mode answers.
 */
export async function answerQuestion(
  ctx: CoachContext,
  rawQuestion: string,
  history: { role: "user" | "assistant"; text: string }[] = [],
  options: { allowModel: boolean } = { allowModel: true },
): Promise<AssistantMessage> {
  const question = rawQuestion.trim().slice(0, MAX_QUESTION);
  try {
    // Without the user's consent nothing is sent to a language model.
    const answer = options.allowModel ? await askModel(ctx, question, history) : null;
    if (answer) {
      const primary =
        [...answer.results].reverse().find((result) => result.card) ?? answer.results.at(-1);
      if (primary) return toMessage(primary, answer.text, "ai");
      return {
        id: `assistant-${crypto.randomUUID()}`,
        role: "assistant",
        text: answer.text,
        mode: "ai",
      };
    }
  } catch (error) {
    console.error(
      "coach: model unavailable, using basic mode:",
      error instanceof Error ? error.name : "error",
    );
  }
  const result = routeQuestion(ctx, question);
  return toMessage(result, result.text, "basic");
}
