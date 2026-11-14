import type { MessageKey } from "@/lib/i18n/translate";

/**
 * Demo sign-ins: synthetic customers from the bank's dataset, chosen with
 * scripts/select-personas.ts because their data tells a clear story. The
 * labels describe the data, not a person.
 */
export const DEMO_PERSONAS: { customerId: string; label: MessageKey }[] = [
  { customerId: "CUST03707", label: "login.persona.steady" },
  { customerId: "CUST02226", label: "login.persona.tight" },
  { customerId: "CUST04630", label: "login.persona.senior" },
];
