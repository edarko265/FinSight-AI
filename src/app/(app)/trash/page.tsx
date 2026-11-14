import type { Metadata } from "next";

import { TrashView } from "@/components/trash/TrashView";

export const metadata: Metadata = { title: "Recycle bin · FinSight-AI" };

export default function TrashPage(): React.JSX.Element {
  return <TrashView />;
}
