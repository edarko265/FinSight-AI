import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, open, writeFile } from "node:fs/promises";
import path from "node:path";

import { parse } from "csv-parse";

import { loadEnv } from "./load-env";

loadEnv();

/**
 * Loads the bank's synthetic dataset into the database, encrypted.
 *
 *   pnpm data:ingest -- --source data/raw            every customer
 *   pnpm data:ingest -- --source data/raw --limit 200   first 200 (faster for development)
 *
 * The transaction file is read as a stream. Rows arrive grouped by customer, so
 * each customer's ledger is sealed and written as soon as it is complete.
 */
const TX_FILE = "tx_junction_transactions.csv";
const CUSTOMER_FILE = "tx_customers_junction.csv";
const BATCH = 100;

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function sha256(file: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk as Buffer);
  return hash.digest("hex");
}

async function main(): Promise<void> {
  const { getEnv } = await import("@/lib/env");
  const { getDb } = await import("@/lib/db/client");
  const { migrate } = await import("@/lib/db/migrate");
  const { parseTransactionRow, TRANSACTION_HEADERS } = await import("@/lib/data/source-parse");
  const { sealLedger, sealProfile } = await import("@/lib/data/ledger-codec");
  const { customerKey, customerRef } = await import("@/lib/security/keys");
  const { ageBand, BenchmarkBuilder, customerMetrics } = await import("@/lib/analytics/benchmarks");
  type Transaction = import("@/lib/data/types").Transaction;

  const source = path.resolve(arg("source") ?? "data/raw");
  const limit = Number(arg("limit") ?? Infinity);
  const env = getEnv();
  const txPath = path.join(source, TX_FILE);

  const head = await open(txPath, "r")
    .then(async (handle) => {
      const { buffer, bytesRead } = await handle.read(Buffer.alloc(200), 0, 200, 0);
      await handle.close();
      return buffer.subarray(0, bytesRead).toString("utf8");
    })
    .catch(() => "");
  if (head === "")
    throw new Error(`Cannot read ${txPath}. See the README for how to download the dataset.`);
  if (head.startsWith("version https://git-lfs")) {
    throw new Error(
      `${TX_FILE} is a Git LFS pointer, not the data. Use "Download raw file" on GitHub.`,
    );
  }

  console.log("Checksumming source...");
  const checksum = await sha256(txPath);

  const customers = new Map<string, { age: number | null; postalCode: string | null }>();
  const customerParser = createReadStream(path.join(source, CUSTOMER_FILE)).pipe(
    parse({ bom: true, columns: true, skip_empty_lines: true }),
  );
  for await (const record of customerParser as AsyncIterable<Record<string, string>>) {
    const age = Number(record.customer_age);
    customers.set(record.customer_id ?? "", {
      age: Number.isFinite(age) && record.customer_age !== "" ? age : null,
      postalCode: record.customer_postal_code || null,
    });
  }

  const db = await getDb();
  await migrate(db);
  const ingestionId = randomUUID();
  await db.query(
    "INSERT INTO ingestions (id, source_file, source_sha256, source_commit, status) VALUES ($1, $2, $3, $4, 'running')",
    [ingestionId, TX_FILE, checksum, arg("commit") ?? null],
  );

  const benchmarks = new BenchmarkBuilder();
  const categories = new Map<string, number>();
  let pending: unknown[][] = [];
  let customerCount = 0;
  let rowCount = 0;
  let minDate = "9999";
  let maxDate = "0000";

  async function flushBatch(): Promise<void> {
    if (pending.length === 0) return;
    const values = pending.map(
      (_, i) => `($${i * 5 + 1}, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5})`,
    );
    await db.query(
      `INSERT INTO customer_ledgers (customer_ref, key_id, ingestion_id, sealed_profile, sealed_ledger)
       VALUES ${values.join(", ")}
       ON CONFLICT (customer_ref) DO UPDATE SET
         key_id = EXCLUDED.key_id, ingestion_id = EXCLUDED.ingestion_id,
         sealed_profile = EXCLUDED.sealed_profile, sealed_ledger = EXCLUDED.sealed_ledger`,
      pending.flat(),
    );
    pending = [];
  }

  async function finishCustomer(
    customerId: string,
    accountId: string,
    ledger: Transaction[],
  ): Promise<void> {
    const info = customers.get(customerId);
    if (!info) throw new Error(`Transactions reference unknown customer at row ${ledger[0]?.row}`);
    const ref = customerRef(customerId);
    const key = customerKey(ref);
    pending.push([
      ref,
      key.id,
      ingestionId,
      sealProfile({ customerId, accountId, age: info.age, postalCode: info.postalCode }, key),
      sealLedger(ledger, key),
    ]);
    benchmarks.add(ageBand(info.age), customerMetrics(ledger, env.DEMO_AS_OF_DATE));
    customerCount += 1;
    if (pending.length >= BATCH) await flushBatch();
    if (customerCount % 500 === 0) console.log(`  ${customerCount} customers, ${rowCount} rows`);
  }

  const parser = createReadStream(txPath).pipe(
    parse({ bom: true, columns: true, skip_empty_lines: true }),
  );
  let currentId: string | null = null;
  let currentAccount = "";
  let ledger: Transaction[] = [];
  let row = 0;
  let headerChecked = false;
  const seen = new Set<string>();

  for await (const record of parser as AsyncIterable<Record<string, string>>) {
    if (!headerChecked) {
      const missing = TRANSACTION_HEADERS.filter((header) => !(header in record));
      if (missing.length > 0) throw new Error(`Source is missing columns: ${missing.join(", ")}`);
      headerChecked = true;
    }
    row += 1;
    const id = record.customer_id ?? "";
    if (id !== currentId) {
      if (currentId !== null) {
        await finishCustomer(currentId, currentAccount, ledger);
        if (customerCount >= limit) {
          currentId = null;
          break;
        }
      }
      if (seen.has(id)) throw new Error(`Customer rows are not contiguous at row ${row}`);
      seen.add(id);
      currentId = id;
      currentAccount = record.bank_account_id ?? "";
      ledger = [];
    }
    const tx = parseTransactionRow(record, row);
    ledger.push(tx);
    rowCount += 1;
    categories.set(tx.category, (categories.get(tx.category) ?? 0) + 1);
    if (tx.date < minDate) minDate = tx.date;
    if (tx.date > maxDate) maxDate = tx.date;
  }
  if (currentId !== null) await finishCustomer(currentId, currentAccount, ledger);
  await flushBatch();

  await db.query("DELETE FROM peer_benchmarks");
  const rows = benchmarks.rows();
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    const values = chunk.map(
      (_, j) =>
        `($1, $${j * 6 + 2}, $${j * 6 + 3}, $${j * 6 + 4}, $${j * 6 + 5}, $${j * 6 + 6}, $${j * 6 + 7})`,
    );
    await db.query(
      `INSERT INTO peer_benchmarks (ingestion_id, age_band, metric, group_size, p25_cents, p50_cents, p75_cents)
       VALUES ${values.join(", ")}`,
      [
        ingestionId,
        ...chunk.flatMap((r) => [
          r.ageBand,
          r.metric,
          r.groupSize,
          r.p25Cents,
          r.p50Cents,
          r.p75Cents,
        ]),
      ],
    );
  }

  await db.query(
    "UPDATE ingestions SET status = 'complete', customer_count = $2, row_count = $3, finished_at = now() WHERE id = $1",
    [ingestionId, customerCount, rowCount],
  );

  const report = {
    ingestionId,
    sourceFile: TX_FILE,
    sourceSha256: checksum,
    customers: customerCount,
    rows: rowCount,
    dateRange: { from: minDate, to: maxDate },
    categories: Object.fromEntries([...categories].sort((a, b) => b[1] - a[1])),
    benchmarkRows: rows.length,
    benchmarkAsOf: env.DEMO_AS_OF_DATE,
    partial: Number.isFinite(limit),
  };
  await mkdir(path.join("data", "derived"), { recursive: true });
  await writeFile(
    path.join("data", "derived", "ingestion-report.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(`Done: ${customerCount} customers, ${rowCount} rows, ${rows.length} benchmark rows.`);
  await db.close();
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Ingestion failed");
  process.exit(1);
});
