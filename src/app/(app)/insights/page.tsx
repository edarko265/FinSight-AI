import type { Metadata } from "next";

import { InsightsView } from "@/components/insights/InsightsView";

export const metadata: Metadata = { title: "Insights · FinSight-AI" };

/** Waits for the signed-in account state before rendering; see the (app) layout. */
export const instant = false;

export default function InsightsPage(): React.JSX.Element {
  return <InsightsView />;
}
