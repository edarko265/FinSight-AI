import type { Metadata } from "next";
import { Suspense } from "react";

import { ChatScreen } from "@/components/chat/ChatScreen";

export const metadata: Metadata = { title: "Coach · FinSight-AI" };

/** Waits for the signed-in account state before rendering; see the (app) layout. */
export const instant = false;

export default function ChatPage(): React.JSX.Element {
  return (
    <Suspense>
      <ChatScreen />
    </Suspense>
  );
}
