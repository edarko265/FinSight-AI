import type { Metadata } from "next";

import { TrashView } from "@/components/trash/TrashView";

export const metadata: Metadata = { title: "Recycle bin · FinSight-AI" };

/** Waits for the signed-in account state before rendering; see the (app) layout. */
export const instant = false;

export default function TrashPage(): React.JSX.Element {
  return <TrashView />;
}
