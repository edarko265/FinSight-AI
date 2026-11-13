import "server-only";

import type { BenchmarkRow } from "@/lib/analytics/benchmarks";
import { openLedger, openProfile } from "@/lib/data/ledger-codec";
import type { CustomerRecord } from "@/lib/data/types";
import { getDb } from "@/lib/db/client";
import { getEnv } from "@/lib/env";
import { decryptField, encryptField } from "@/lib/security/crypto";
import { customerKey, customerRef } from "@/lib/security/keys";

/**
 * All customer data access goes through here. Every function takes the
 * customer's blind index, which callers obtain only from the server session.
 */
const CACHE_LIMIT = 24;
const cache = new Map<string, CustomerRecord>();

/** True when the customer exists. Takes the raw ID because login is the one place it is typed. */
export async function findCustomerRef(customerId: string): Promise<string | null> {
  const ref = customerRef(customerId);
  const db = await getDb();
  const rows = await db.query("SELECT 1 AS found FROM customer_ledgers WHERE customer_ref = $1", [
    ref,
  ]);
  return rows.length > 0 ? ref : null;
}

/** The customer's profile and transactions up to the demo as-of date. Nothing later is ever returned. */
export async function loadCustomer(ref: string): Promise<CustomerRecord | null> {
  const hit = cache.get(ref);
  if (hit) return hit;

  const db = await getDb();
  const rows = await db.query<{ sealed_profile: string; sealed_ledger: string }>(
    "SELECT sealed_profile, sealed_ledger FROM customer_ledgers WHERE customer_ref = $1",
    [ref],
  );
  const row = rows[0];
  if (!row) return null;

  const key = customerKey(ref);
  const asOf = getEnv().DEMO_AS_OF_DATE;
  const record: CustomerRecord = {
    profile: openProfile(row.sealed_profile, key),
    transactions: openLedger(row.sealed_ledger, key).filter((tx) => tx.date <= asOf),
  };
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(ref, record);
  return record;
}

/** Reads a piece of per-customer application state (sealed with the customer's key). */
export async function readState<T>(ref: string, kind: string): Promise<T | null> {
  const db = await getDb();
  const rows = await db.query<{ sealed_value: string }>(
    "SELECT sealed_value FROM customer_state WHERE customer_ref = $1 AND kind = $2",
    [ref, kind],
  );
  const sealed = rows[0]?.sealed_value;
  if (!sealed) return null;
  return JSON.parse(decryptField(sealed, customerKey(ref), `customer_state.${kind}`)) as T;
}

export async function writeState(ref: string, kind: string, value: unknown): Promise<void> {
  const db = await getDb();
  const sealed = encryptField(JSON.stringify(value), customerKey(ref), `customer_state.${kind}`);
  await db.query(
    `INSERT INTO customer_state (customer_ref, kind, sealed_value) VALUES ($1, $2, $3)
     ON CONFLICT (customer_ref, kind) DO UPDATE SET sealed_value = EXCLUDED.sealed_value, updated_at = now()`,
    [ref, kind, sealed],
  );
}

let benchmarkCache: BenchmarkRow[] | undefined;

/** Anonymous group percentiles. Not customer data. */
export async function loadBenchmarks(): Promise<BenchmarkRow[]> {
  if (benchmarkCache) return benchmarkCache;
  const db = await getDb();
  const rows = await db.query<{
    age_band: string;
    metric: string;
    group_size: number;
    p25_cents: string | number;
    p50_cents: string | number;
    p75_cents: string | number;
  }>("SELECT age_band, metric, group_size, p25_cents, p50_cents, p75_cents FROM peer_benchmarks");
  benchmarkCache = rows.map((row) => ({
    ageBand: row.age_band as BenchmarkRow["ageBand"],
    metric: row.metric,
    groupSize: Number(row.group_size),
    p25Cents: Number(row.p25_cents),
    p50Cents: Number(row.p50_cents),
    p75Cents: Number(row.p75_cents),
  }));
  return benchmarkCache;
}
