import { gunzipSync, gzipSync } from "node:zlib";

import type { CustomerProfile, Transaction } from "@/lib/data/types";
import { decryptField, encryptField, type DataKey } from "@/lib/security/crypto";

/**
 * A customer's ledger is stored as one value: transactions packed into
 * columns, compressed, then sealed with the customer's key. Nothing about an
 * individual transaction is visible in the database.
 */
type PackedLedger = {
  v: 1;
  categories: string[];
  types: string[];
  rows: [
    row: number,
    date: string,
    time: string,
    amountCents: number,
    balanceCents: number,
    category: number,
    type: number,
    merchantId: string | null,
    mcc: string | null,
  ][];
};

const LEDGER_CONTEXT = "customer_ledgers.sealed_ledger";
const PROFILE_CONTEXT = "customer_ledgers.sealed_profile";

function indexOf(list: string[], value: string): number {
  const found = list.indexOf(value);
  if (found !== -1) return found;
  list.push(value);
  return list.length - 1;
}

export function sealLedger(transactions: readonly Transaction[], key: DataKey): string {
  const packed: PackedLedger = { v: 1, categories: [], types: [], rows: [] };
  for (const tx of transactions) {
    packed.rows.push([
      tx.row,
      tx.date,
      tx.time,
      tx.amountCents,
      tx.balanceCents,
      indexOf(packed.categories, tx.category),
      indexOf(packed.types, tx.type),
      tx.merchantId,
      tx.mcc,
    ]);
  }
  const compressed = gzipSync(Buffer.from(JSON.stringify(packed), "utf8"));
  return encryptField(compressed.toString("base64"), key, LEDGER_CONTEXT);
}

export function openLedger(sealed: string, key: DataKey): Transaction[] {
  const compressed = Buffer.from(decryptField(sealed, key, LEDGER_CONTEXT), "base64");
  const packed = JSON.parse(gunzipSync(compressed).toString("utf8")) as PackedLedger;
  return packed.rows.map(
    ([row, date, time, amountCents, balanceCents, category, type, merchantId, mcc]) => ({
      row,
      date,
      time,
      amountCents,
      balanceCents,
      category: packed.categories[category] ?? "Unknown",
      type: packed.types[type] ?? "unknown",
      merchantId,
      mcc,
    }),
  );
}

export function sealProfile(profile: CustomerProfile, key: DataKey): string {
  return encryptField(JSON.stringify(profile), key, PROFILE_CONTEXT);
}

export function openProfile(sealed: string, key: DataKey): CustomerProfile {
  return JSON.parse(decryptField(sealed, key, PROFILE_CONTEXT)) as CustomerProfile;
}
