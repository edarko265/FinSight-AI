import type { Metadata } from "next";

import { StoryView } from "@/components/story/StoryView";

export const metadata: Metadata = { title: "Your month · FinSight-AI" };

/** Waits for the signed-in account state before rendering; see the (app) layout. */
export const instant = false;

export default function StoryPage(): React.JSX.Element {
  return <StoryView />;
}
