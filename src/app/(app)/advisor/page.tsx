import type { Metadata } from "next";

import { AdvisorView } from "@/components/advisor/AdvisorView";

export const metadata: Metadata = { title: "Adviser · FinSight-AI" };

export default function AdvisorPage(): React.JSX.Element {
  return <AdvisorView />;
}
