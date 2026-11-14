import type { Metadata } from "next";

import { GoalsView } from "@/components/goals/GoalsView";

export const metadata: Metadata = { title: "Goals · FinSight-AI" };

/** Waits for the signed-in account state before rendering; see the (app) layout. */
export const instant = false;

export default function GoalsPage(): React.JSX.Element {
  return <GoalsView />;
}
