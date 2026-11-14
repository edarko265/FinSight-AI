import type { Metadata } from "next";

import { MortgageView } from "@/components/mortgage/MortgageView";

export const metadata: Metadata = { title: "Mortgage guide · FinSight-AI" };

/** Waits for the signed-in account state before rendering; see the (app) layout. */
export const instant = false;

export default function MortgagePage(): React.JSX.Element {
  return <MortgageView />;
}
