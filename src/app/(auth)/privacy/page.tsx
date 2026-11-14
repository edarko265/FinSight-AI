import type { Metadata } from "next";

import { PrivacyNotice } from "@/components/settings/PrivacyNotice";

export const metadata: Metadata = { title: "Privacy · FinSight-AI" };

export default function PrivacyPage(): React.JSX.Element {
  return <PrivacyNotice />;
}
