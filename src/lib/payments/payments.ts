import "server-only";

import { randomBytes, randomUUID } from "node:crypto";

import { getDb } from "@/lib/db/client";
import { decryptField, encryptField } from "@/lib/security/crypto";
import { customerKey } from "@/lib/security/keys";

/**
 * Payments.
 *
 * THIS PROTOTYPE TAKES NO MONEY. Every payment goes through the simulated
 * provider below: no card is asked for, nothing is charged, and the receipt
 * says so. The interface is what a real payment provider would implement;
 * swapping it in is the only change the rest of the app would need.
 */
export interface PaymentProvider {
  id: string;
  /** True when no money actually moves. Shown to the customer on every receipt. */
  simulated: boolean;
  charge(input: { amountCents: number; purpose: string }): Promise<{ reference: string }>;
}

const simulatedProvider: PaymentProvider = {
  id: "simulated",
  simulated: true,
  async charge() {
    return { reference: `SIM-${randomBytes(4).toString("hex").toUpperCase()}` };
  },
};

/** Where a real provider would be chosen. Only the simulated one exists. */
export const paymentProvider = (): PaymentProvider => simulatedProvider;

export interface Payment {
  id: string;
  purpose: string;
  amountCents: number;
  reference: string;
  simulated: boolean;
  at: string;
}

const DETAILS = "payments.sealed_details";

export async function pay(ref: string, purpose: string, amountCents: number): Promise<Payment> {
  const provider = paymentProvider();
  const { reference } = await provider.charge({ amountCents, purpose });
  const id = randomUUID();
  const db = await getDb();
  await db.query(
    `INSERT INTO payments (id, customer_ref, purpose, amount_cents, provider, status, sealed_details)
     VALUES ($1, $2, $3, $4, $5, 'paid', $6)`,
    [
      id,
      ref,
      purpose,
      amountCents,
      provider.id,
      encryptField(JSON.stringify({ reference }), customerKey(ref), DETAILS),
    ],
  );
  return {
    id,
    purpose,
    amountCents,
    reference,
    simulated: provider.simulated,
    at: new Date().toISOString(),
  };
}

export async function listPayments(ref: string): Promise<Payment[]> {
  const db = await getDb();
  const rows = await db.query<{
    id: string;
    purpose: string;
    amount_cents: number | string;
    provider: string;
    sealed_details: string;
    created_at: string | Date;
  }>(
    "SELECT id, purpose, amount_cents, provider, sealed_details, created_at FROM payments WHERE customer_ref = $1 ORDER BY created_at DESC LIMIT 20",
    [ref],
  );
  return rows.map((row) => ({
    id: row.id,
    purpose: row.purpose,
    amountCents: Number(row.amount_cents),
    reference: (
      JSON.parse(decryptField(row.sealed_details, customerKey(ref), DETAILS)) as {
        reference: string;
      }
    ).reference,
    simulated: row.provider === simulatedProvider.id,
    at: new Date(row.created_at).toISOString(),
  }));
}

/** Totals for staff: how many payments and how much, never who paid. */
export async function paymentTotals(): Promise<{
  count: number;
  cents: number;
  simulated: boolean;
}> {
  const db = await getDb();
  const rows = await db.query<{ n: number | string; total: number | string | null }>(
    "SELECT count(*) AS n, sum(amount_cents) AS total FROM payments WHERE status = 'paid'",
  );
  return {
    count: Number(rows[0]?.n ?? 0),
    cents: Number(rows[0]?.total ?? 0),
    simulated: paymentProvider().simulated,
  };
}
