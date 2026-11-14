import type { Metadata } from "next";

import { AccountsView } from "@/components/accounts/AccountsView";

export const metadata: Metadata = { title: "Accounts · FinSight-AI" };

/** Waits for the signed-in account state before rendering; see the (app) layout. */
export const instant = false;

export default function AccountsPage(): React.JSX.Element {
  return <AccountsView />;
}
