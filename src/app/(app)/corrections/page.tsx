import type { Metadata } from "next";

import { CorrectionsView } from "@/components/corrections/CorrectionsView";

export const metadata: Metadata = { title: "My corrections · FinSight-AI" };

/** Waits for the signed-in account state before rendering; see the (app) layout. */
export const instant = false;

export default function CorrectionsPage(): React.JSX.Element {
  return <CorrectionsView />;
}
