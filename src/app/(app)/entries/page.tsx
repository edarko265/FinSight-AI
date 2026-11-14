import type { Metadata } from "next";

import { EntriesView } from "@/components/entries/EntriesView";

export const metadata: Metadata = { title: "Income and expenses · FinSight-AI" };

/** Waits for the signed-in account state before rendering; see the (app) layout. */
export const instant = false;

export default function EntriesPage(): React.JSX.Element {
  return <EntriesView />;
}
