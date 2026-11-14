import { refuse } from "@/lib/admin/auth";
import { audit } from "@/lib/admin/settings";
import { customersWithDevices } from "@/lib/push/push";
import { runReminders } from "@/lib/push/reminders";

export const maxDuration = 60;

/** How many customers have device notifications on. */
export async function GET(): Promise<Response> {
  const refused = await refuse("manager");
  if (refused) return refused;
  return Response.json({ customers: (await customersWithDevices()).length });
}

/** Runs the reminder job now, instead of waiting for the schedule. */
export async function POST(): Promise<Response> {
  const refused = await refuse("manager");
  if (refused) return refused;
  const result = await runReminders();
  await audit("reminders.run", `${result.sent} sent to ${result.customers} customers`);
  return Response.json(result);
}
