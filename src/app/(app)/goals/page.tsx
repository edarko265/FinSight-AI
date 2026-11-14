import type { Metadata } from "next";

import { GoalsView } from "@/components/goals/GoalsView";

export const metadata: Metadata = { title: "Goals · FinSight-AI" };

export default function GoalsPage(): React.JSX.Element {
  return <GoalsView />;
}
