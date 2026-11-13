import type { Metadata } from "next";

import { InsightsView } from "@/components/insights/InsightsView";

export const metadata: Metadata = { title: "Insights · FinSight-AI" };

export default function InsightsPage(): React.JSX.Element {
  return <InsightsView />;
}
