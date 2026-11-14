import "server-only";

import type { AssistantMessage, ChatMessage } from "@/lib/contracts/chat";
import { readState, writeState } from "@/lib/data/repository";

/**
 * The customer's conversation with the coach, kept between visits so they can
 * pick up where they left off. Sealed with their key like everything else
 * they own, capped in length, and theirs to clear at any time. Staff cannot
 * read it, and it is not what the anonymous usage statistics are built from.
 */
const KIND = "chat";
const KEEP = 60;

export async function readHistory(ref: string): Promise<ChatMessage[]> {
  return (await readState<ChatMessage[]>(ref, KIND)) ?? [];
}

export async function appendExchange(
  ref: string,
  question: string,
  reply: AssistantMessage,
): Promise<void> {
  const history = await readHistory(ref);
  const asked: ChatMessage = { id: `user-${crypto.randomUUID()}`, role: "user", text: question };
  // Follow-up suggestions belong to the moment they were offered, not to the record.
  const { followUps: _followUps, ...kept } = reply;
  void _followUps;
  await writeState(ref, KIND, [...history, asked, kept].slice(-KEEP));
}

/** Clears the conversation and returns what was there, so it can go to the recycle bin. */
export async function clearHistory(ref: string): Promise<ChatMessage[]> {
  const history = await readHistory(ref);
  await writeState(ref, KIND, []);
  return history;
}

export async function restoreHistory(ref: string, messages: ChatMessage[]): Promise<void> {
  await writeState(ref, KIND, [...messages, ...(await readHistory(ref))].slice(-KEEP));
}
