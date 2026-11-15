/**
 * Demo sign-ins: synthetic customers from the bank's dataset, grouped by the
 * kind of story their data tells, so a demo can open the right one: a steady
 * month, a tight one, a young adult, a pensioner, or someone whose mortgage
 * application is in the dataset. Chosen with scripts/select-personas.ts and
 * the mortgage files. The labels describe the data, not a person.
 */
export const PERSONA_TYPES = [
  "steady",
  "tight",
  "young",
  "senior",
  "mortgageApproved",
  "mortgageDeclined",
] as const;
export type PersonaType = (typeof PERSONA_TYPES)[number];

export type DeclineReason =
  "insufficient_income" | "insufficient_collateral" | "insufficient_equity" | "existing_debt";

export interface DemoPersona {
  customerId: string;
  age: number;
  /** For a mortgage customer: the price of the home applied for, in cents. */
  homePriceCents?: number;
  /** For a declined application: the reason on record. */
  declined?: DeclineReason;
}

export const DEMO_PERSONAS: Record<PersonaType, readonly DemoPersona[]> = {
  steady: [
    { customerId: "CUST03707", age: 40 },
    { customerId: "CUST00042", age: 42 },
    { customerId: "CUST00126", age: 45 },
    { customerId: "CUST00191", age: 47 },
  ],
  tight: [
    { customerId: "CUST02226", age: 41 },
    { customerId: "CUST00002", age: 47 },
    { customerId: "CUST00098", age: 41 },
    { customerId: "CUST00220", age: 57 },
  ],
  young: [
    { customerId: "CUST00032", age: 20 },
    { customerId: "CUST00152", age: 21 },
    { customerId: "CUST00171", age: 21 },
    { customerId: "CUST00226", age: 21 },
  ],
  senior: [
    { customerId: "CUST04630", age: 72 },
    { customerId: "CUST00029", age: 77 },
    { customerId: "CUST00072", age: 70 },
    { customerId: "CUST00130", age: 68 },
  ],
  mortgageApproved: [
    { customerId: "CUST04457", age: 54, homePriceCents: 20_300_000 },
    { customerId: "CUST02003", age: 33, homePriceCents: 17_800_000 },
    { customerId: "CUST01957", age: 40, homePriceCents: 23_700_000 },
    { customerId: "CUST03690", age: 37, homePriceCents: 24_200_000 },
  ],
  mortgageDeclined: [
    {
      customerId: "CUST00296",
      age: 53,
      homePriceCents: 29_000_000,
      declined: "insufficient_income",
    },
    {
      customerId: "CUST02113",
      age: 49,
      homePriceCents: 35_800_000,
      declined: "insufficient_collateral",
    },
    {
      customerId: "CUST04944",
      age: 47,
      homePriceCents: 26_050_000,
      declined: "insufficient_equity",
    },
    { customerId: "CUST01321", age: 49, homePriceCents: 31_150_000, declined: "existing_debt" },
  ],
};
