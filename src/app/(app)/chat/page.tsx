import type { Metadata } from "next";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { PROMPT_SUGGESTIONS } from "@/lib/demo/fixtures";

export const metadata: Metadata = { title: "Chat · FinSight-AI" };

export default function ChatPage(): React.JSX.Element {
  return (
    <ChatPanel
      intro="Hi! Ask me about your spending, balance or habits. I can show charts right here."
      suggestions={PROMPT_SUGGESTIONS}
      placeholder="Ask about your money"
    />
  );
}
