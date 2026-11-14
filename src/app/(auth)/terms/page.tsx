import type { Metadata } from "next";

import { TermsNotice } from "@/components/settings/TermsNotice";

export const metadata: Metadata = { title: "Terms of use · FinSight-AI" };

export default function TermsPage(): React.JSX.Element {
  return <TermsNotice />;
}
