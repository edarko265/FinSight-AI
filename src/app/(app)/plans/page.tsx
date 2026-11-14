import type { Metadata } from "next";

import { PlansView } from "@/components/plans/PlansView";

export const metadata: Metadata = { title: "Plans · FinSight-AI" };

/** Waits for the signed-in account state before rendering; see the (app) layout. */
export const instant = false;

export default function PlansPage(): React.JSX.Element {
  return <PlansView />;
}
