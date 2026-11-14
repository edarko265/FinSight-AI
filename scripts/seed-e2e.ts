import { rm } from "node:fs/promises";

import { E2E_CUSTOMER, E2E_CUSTOMER_TIGHT, E2E_ENV } from "../e2e/env";

/**
 * Fills a throw-away embedded database with two made-up customers for the
 * browser tests. Nothing here comes from the bank's dataset.
 *
 *   pnpm exec tsx scripts/seed-e2e.ts
 */
Object.assign(process.env, E2E_ENV);

type Transaction = import("@/lib/data/types").Transaction;

/** Fourteen months of an ordinary account: salary, rent, bills, food, some fun. */
function ledger(startBalance: number, salary: number, rent: number, fun: number): Transaction[] {
  const rows: Transaction[] = [];
  let balance = startBalance;
  let row = 0;
  const add = (
    date: string,
    cents: number,
    category: string,
    type: string,
    mcc: string | null = null,
    merchantId: string | null = null,
  ): void => {
    row += 1;
    balance += cents;
    rows.push({
      row,
      date,
      time: "12:00:00",
      amountCents: cents,
      balanceCents: balance,
      category,
      type,
      merchantId,
      mcc,
    });
  };
  for (let index = 0; index < 15; index += 1) {
    const year = 2025 + Math.floor((6 + index) / 12);
    const month = String(((6 + index) % 12) + 1).padStart(2, "0");
    const day = (value: number): string => `${year}-${month}-${String(value).padStart(2, "0")}`;
    if (day(1) > E2E_ENV.DEMO_AS_OF_DATE!) break;
    const last = day(15) > E2E_ENV.DEMO_AS_OF_DATE!;
    add(day(1), salary, "Salary", "salary");
    add(day(3), -rent, "Housing", "housing_payment");
    add(day(5), -1299, "Entertainment", "purchase", "7832", "MRC-STREAM-01");
    add(day(6), -6500 - (index % 3) * 400, "Utilities", "utilities_payment");
    add(day(8), -8200, "Groceries", "purchase", "5411", "MRC-GRO-01");
    add(day(10), -fun, "Restaurants", "purchase", "5812", "MRC-RES-01");
    add(day(12), -900, "Transportation", "purchase", "4121", "MRC-TAXI-01");
    if (last) continue;
    add(day(16), -7600, "Groceries", "purchase", "5411", "MRC-GRO-02");
    add(day(18), -fun, "Restaurants", "purchase", "5814", "MRC-RES-02");
    add(day(20), -4500, "Lifestyle", "purchase", "5651", "MRC-LIF-01");
    add(day(24), -6900, "Groceries", "purchase", "5411", "MRC-GRO-01");
    if (index % 4 === 0) add(day(26), -12_000, "Health", "purchase", "8021", "MRC-HEA-01");
  }
  return rows;
}

async function main(): Promise<void> {
  await rm(E2E_ENV.PGLITE_DIR!, { recursive: true, force: true });
  const { getDb } = await import("@/lib/db/client");
  const { migrate } = await import("@/lib/db/migrate");
  const { sealLedger, sealProfile } = await import("@/lib/data/ledger-codec");
  const { customerKey, customerRef } = await import("@/lib/security/keys");

  const db = await getDb();
  await migrate(db);
  await db.query(
    "INSERT INTO ingestions (id, source_file, source_sha256, status) VALUES ('e2e', 'fixture', 'e2e', 'complete')",
  );
  const customers: [string, number, Transaction[]][] = [
    [E2E_CUSTOMER, 34, ledger(180_000, 290_000, 85_000, 3200)],
    [E2E_CUSTOMER_TIGHT, 27, ledger(20_000, 190_000, 92_000, 5400)],
  ];
  for (const [id, age, transactions] of customers) {
    const ref = customerRef(id);
    const key = customerKey(ref);
    await db.query(
      "INSERT INTO customer_ledgers (customer_ref, key_id, ingestion_id, sealed_profile, sealed_ledger) VALUES ($1, $2, 'e2e', $3, $4)",
      [
        ref,
        E2E_ENV.DATA_ENCRYPTION_KEY_ID,
        sealProfile({ customerId: id, accountId: `ACC-${id}`, age, postalCode: "00100" }, key),
        sealLedger(transactions, key),
      ],
    );
  }
  await db.close();
  console.log(`Seeded ${customers.length} made-up customers into ${E2E_ENV.PGLITE_DIR}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
