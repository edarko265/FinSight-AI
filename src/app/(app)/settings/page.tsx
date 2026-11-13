import type { Metadata } from "next";

import { SettingsView } from "@/components/settings/SettingsView";

export const metadata: Metadata = { title: "Settings · FinSight-AI" };

export default function SettingsPage(): React.JSX.Element {
  return <SettingsView />;
}
