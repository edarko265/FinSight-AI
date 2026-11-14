import { createReadStream } from "node:fs";
import path from "node:path";

import { parse } from "csv-parse";

import { loadEnv } from "./load-env";

loadEnv();

/**
 * Profiles every customer up to the as-of date and prints candidates for the
 * demo logins: a comfortable case, a tight case and a young-adult case.
 * Reads the source file directly; writes nothing.
 */
async function main(): Promise<void> {
  const { parseTransactionRow } = await import("@/lib/data/source-parse");
  const { estimateSafeToSpend, suggestAssumptions } = await import("@/lib/analytics/forecast");
  const { summariseSpending, cashFlow } = await import("@/lib/analytics/spending");
  const { completedMonths, lastCompletedMonth } = await import("@/lib/analytics/periods");
  const { detectIncome } = await import("@/lib/analytics/recurrence");
  type Transaction = import("@/lib/data/types").Transaction;

  const asOf = process.env.DEMO_AS_OF_DATE ?? "2026-09-15";
  const source = path.resolve("data/raw");
  const ages = new Map<string, number>();
  for await (const r of createReadStream(path.join(source, "tx_customers_junction.csv")).pipe(
    parse({ bom: true, columns: true }),
  ) as AsyncIterable<Record<string, string>>) {
    ages.set(r.customer_id ?? "", Number(r.customer_age));
  }

  const out: Record<string, unknown>[] = [];
  const finish = (id: string, all: Transaction[]): void => {
    const txs = all.filter((tx) => tx.date <= asOf);
    const forecast = estimateSafeToSpend(txs, asOf, suggestAssumptions(txs, asOf, 7));
    const last = lastCompletedMonth(asOf);
    const spend = summariseSpending(txs, { period: last });
    const year = completedMonths(asOf, 12);
    const flow = cashFlow(txs, {
      startInclusive: year[0]!.startInclusive,
      endExclusive: year[11]!.endExclusive,
    });
    const cat = (name: string): number =>
      spend.byCategory.find((c) => c.category === name)?.totalCents ?? 0;
    const taxi = summariseSpending(txs, { period: last, mccs: ["4121"] });
    out.push({
      id,
      age: ages.get(id),
      status: forecast.status,
      balance: Math.round(forecast.balanceCents / 100),
      available: Math.round(forecast.availableCents / 100),
      shortfall: Math.round(forecast.shortfallCents / 100),
      monthSpend: Math.round(spend.totalCents / 100),
      restaurants: Math.round(cat("Restaurants") / 100),
      taxi: Math.round(taxi.totalCents / 100),
      taxiCount: taxi.transactionCount,
      income: Math.round(flow.salaryCents / 1200),
      invested: Math.round(flow.investedCents / 1200),
      sweep: flow.salarySweepCents > 0,
      salaryDays: detectIncome(txs, asOf).typicalDays.join("/"),
    });
  };

  let current: string | null = null;
  let ledger: Transaction[] = [];
  let row = 0;
  for await (const record of createReadStream(
    path.join(source, "tx_junction_transactions.csv"),
  ).pipe(parse({ bom: true, columns: true })) as AsyncIterable<Record<string, string>>) {
    row += 1;
    if (record.customer_id !== current) {
      if (current) finish(current, ledger);
      current = record.customer_id ?? "";
      ledger = [];
    }
    ledger.push(parseTransactionRow(record, row));
  }
  if (current) finish(current, ledger);

  const count = (status: string): number => out.filter((o) => o.status === status).length;
  console.log({
    ok: count("ok"),
    shortfall: count("shortfall"),
    insufficient: count("insufficient_data"),
  });
  const pick = (
    label: string,
    filter: (o: Record<string, number | string | boolean>) => boolean,
  ): void => {
    console.log(label);
    console.table((out as Record<string, number | string | boolean>[]).filter(filter).slice(0, 6));
  };
  const good = (o: Record<string, number | string | boolean>): boolean =>
    (o.taxiCount as number) >= 2 && (o.restaurants as number) >= 150 && !o.sweep;
  pick(
    "comfortable",
    (o) =>
      good(o) &&
      o.status === "ok" &&
      (o.available as number) > 800 &&
      (o.available as number) < 3000 &&
      (o.age as number) >= 30 &&
      (o.age as number) <= 50 &&
      (o.invested as number) > 50,
  );
  pick(
    "tight",
    (o) =>
      good(o) &&
      o.status === "shortfall" &&
      (o.shortfall as number) < 600 &&
      (o.balance as number) > 0,
  );
  pick(
    "young",
    (o) => good(o) && (o.age as number) <= 24 && o.status === "ok" && (o.available as number) < 600,
  );
  pick("senior", (o) => good(o) && (o.age as number) >= 66 && o.status === "ok");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
