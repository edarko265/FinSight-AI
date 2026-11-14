import type { Metadata } from "next";

import { AdvisorView } from "@/components/advisor/AdvisorView";

export const metadata: Metadata = { title: "Adviser · FinSight-AI" };

/** Waits for the signed-in account state before rendering; see the (app) layout. */
export const instant = false;

export default function AdvisorPage(): React.JSX.Element {
  return <AdvisorView />;
}
