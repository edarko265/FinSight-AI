import type { Metadata } from "next";

import { SettingsView } from "@/components/settings/SettingsView";

export const metadata: Metadata = { title: "Settings · FinSight-AI" };

/** Waits for the signed-in account state before rendering; see the (app) layout. */
export const instant = false;

export default function SettingsPage(): React.JSX.Element {
  return <SettingsView />;
}
