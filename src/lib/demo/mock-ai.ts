import type { ChatMessage } from "@/lib/contracts/chat";
import {
  BALANCE_TREND,
  MONTHLY_SPENDING,
  RESTAURANT_TREND,
  SPENDING_BY_CATEGORY,
} from "@/lib/demo/fixtures";

/**
 * Stand-in for the coach endpoint. It matches a few keywords and returns a canned reply so the
 * UI can be built and demonstrated. Replace the body with a call to the real route handler; the
 * return type is the contract the UI depends on.
 */
export async function askCoach(question: string): Promise<Extract<ChatMessage, { role: "assistant" }>> {
  await new Promise((resolve) => setTimeout(resolve, 700));
  const q = question.toLowerCase();
  const id = `assistant-${Date.now()}`;

  if (q.includes("restaurant")) {
    return {
      id,
      role: "assistant",
      text: "Here is how your restaurant spending has moved over the last six months.",
      card: RESTAURANT_TREND,
    };
  }
  if (q.includes("balance") || q.includes("saldo")) {
    return {
      id,
      role: "assistant",
      text: "This is your recorded balance at the end of each month.",
      card: BALANCE_TREND,
    };
  }
  if (q.includes("month") || q.includes("trend") || q.includes("over time")) {
    return {
      id,
      role: "assistant",
      text: "Your total spending for each of the last six months:",
      card: MONTHLY_SPENDING,
    };
  }
  if (q.includes("where") || q.includes("spend") || q.includes("category")) {
    return {
      id,
      role: "assistant",
      text: "Here is a breakdown of where your money went in October.",
      card: SPENDING_BY_CATEGORY,
    };
  }
  return {
    id,
    role: "assistant",
    text: "I can show your spending by category, your balance over time, or how a category has changed. Try one of the suggestions.",
  };
}
