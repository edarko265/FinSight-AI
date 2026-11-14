"use client";

import { useSearchParams } from "next/navigation";

import { PinnableChat } from "@/components/chat/PinnableChat";

/** The coach tab. A question can be passed in the URL, which is how insights open the coach. */
export function ChatScreen(): React.JSX.Element {
  const params = useSearchParams();
  const question = params.get("q") ?? undefined;
  // Shortcuts from the dashboard: start listening, or start a voice call, straight away.
  const start = params.get("call") ? "call" : params.get("listen") ? "listen" : undefined;

  return <PinnableChat initialQuestion={question} start={start} />;
}
