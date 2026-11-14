import "server-only";

import { askModel } from "@/lib/coach/llm";
import type { SessionContext } from "@/lib/coach/context";
import { goalsResult, setGoal } from "@/lib/coach/goals";
import { detectGoal, routeQuestion } from "@/lib/coach/router";
import type { ToolResult } from "@/lib/coach/tools";
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
  try {
    // Without the user's consent nothing is sent to a language model.
    const answer = options.allowModel ? await askModel(ctx, question, history) : null;
    if (answer) {
      const primary =
        [...answer.results].reverse().find((result) => result.card) ?? answer.results.at(-1);
      if (primary) return { message: toMessage(primary, answer.text, "ai"), topic: primary.tool };
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
  } catch (error) {
    console.error(
      "coach: model unavailable, using basic mode:",
      error instanceof Error ? error.name : "error",
    );
  }
  const result = await basicAnswer(ctx, question);
  return { message: toMessage(result, result.text, "basic"), topic: result.tool };
}
