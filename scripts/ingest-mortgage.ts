import { createReadStream } from "node:fs";
import path from "node:path";

import { parse } from "csv-parse";

import { loadEnv } from "./load-env";

loadEnv();

/**
 * Loads the mortgage files from the bank's synthetic dataset.
 *
 *   pnpm data:mortgage -- --source data/raw
 *
 * Two things are written:
 *  - for each customer with an application, their own event history and
 *    outcome, sealed with their key like everything else they own;
 *  - anonymous figures across all applications (how long, how many steps,
 *    how often approved, why not), which describe no individual.
 *
 * The free-text notes in the source are not kept: the event type and its
 * figures say the same thing, and the app writes its own wording.
 */
const HISTORY_FILE = "mtg_negotiation_history.csv";
const OUTCOME_FILE = "mtg_tx_customer_link_and_final_mtg_infio.csv";
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function rows(file: string): Promise<Record<string, string>[]> {
  const out: Record<string, string>[] = [];
  const parser = createReadStream(file).pipe(
    parse({ bom: true, columns: true, skip_empty_lines: true }),
  );
  for await (const record of parser as AsyncIterable<Record<string, string>>) out.push(record);
  return out;
}

/** "26MAY26:19:36:59" to "2026-05-26". */
function toDate(stamp: string): string {
  const match = /^(\d{2})([A-Z]{3})(\d{2}):/.exec(stamp);
  if (!match) throw new Error(`Unreadable timestamp: ${stamp}`);
  const month = MONTHS.indexOf(match[2] ?? "") + 1;
  if (month === 0) throw new Error(`Unreadable month: ${stamp}`);
  return `20${match[3]}-${String(month).padStart(2, "0")}-${match[1]}`;
}

const cents = (euros: string | undefined): number | undefined =>
  euros && euros.trim() !== "" && Number.isFinite(Number(euros))
    ? Math.round(Number(euros) * 100)
    : undefined;

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(sorted.length / 2) - 1] ?? 0;
}

async function main(): Promise<void> {
  const { getDb } = await import("@/lib/db/client");
  const { migrate } = await import("@/lib/db/migrate");
  const { encryptField } = await import("@/lib/security/crypto");
  const { customerKey, customerRef } = await import("@/lib/security/keys");
  const { MORTGAGE_EVENTS } = await import("@/lib/data/mortgage");
  type MortgageEvent = import("@/lib/data/mortgage").MortgageEvent;
  type MortgageEventType = import("@/lib/data/mortgage").MortgageEventType;
  type MortgageStory = import("@/lib/data/mortgage").MortgageStory;
  type MortgageStats = import("@/lib/data/mortgage").MortgageStats;

  const source = path.resolve(arg("source") ?? "data/raw");
  const db = await getDb();
  await migrate(db);

  const history = await rows(path.join(source, HISTORY_FILE));
  const outcomes = await rows(path.join(source, OUTCOME_FILE));
  const known = new Set<string>(MORTGAGE_EVENTS);

  const events = new Map<string, MortgageEvent[]>();
  for (const record of history) {
    const type = record.event_type ?? "";
    if (!known.has(type)) continue;
    const list = events.get(record.mortgage_customer_id ?? "") ?? [];
    const event: MortgageEvent = {
      date: toDate(record.timestamp ?? ""),
      type: type as MortgageEventType,
    };
    if (record.property_type) event.propertyType = record.property_type;
    if (record.collateral_status) event.collateralStatus = record.collateral_status;
    if (record.decision) event.decision = record.decision;
    if (record.rejection_reason) event.rejectionReason = record.rejection_reason;
    if (record.expense_type) event.expenseType = record.expense_type;
    const figures = {
      priceCents: cents(record.property_price_estimate),
      loanCents: cents(record.loan_amount),
      equityCents: cents(record.equity_amount),
      collateralValueCents: cents(record.collateral_value),
      expenseCents: cents(record.expense_amount),
    };
    for (const [key, value] of Object.entries(figures)) {
      if (value !== undefined) (event as unknown as Record<string, number>)[key] = value;
    }
    list.push(event);
    events.set(record.mortgage_customer_id ?? "", list);
  }

  const days: number[] = [];
  const counts: number[] = [];
  const properties: number[] = [];
  const ltv: number[] = [];
  const equity: number[] = [];
  const reasons: Record<string, number> = {};
  const stageDays = new Map<string, number[]>();
  const expenses = new Map<string, number[]>();
  let approved = 0;
  let sealed = 0;
  let unmatched = 0;

  for (const record of outcomes) {
    const list = (events.get(record.mortgage_customer_id ?? "") ?? []).sort((a, b) =>
      a.date.localeCompare(b.date),
    );
    const first = list[0];
    const last = list.at(-1);
    if (!first || !last) continue;
    const decision = record.final_decision === "approved" ? "approved" : "rejected";
    if (decision === "approved") approved += 1;
    else if (record.rejection_reason)
      reasons[record.rejection_reason] = (reasons[record.rejection_reason] ?? 0) + 1;

    const start = Date.parse(first.date);
    days.push(Math.round((Date.parse(last.date) - start) / 86_400_000));
    counts.push(list.length);
    properties.push(list.filter((event) => event.type === "property_added").length);
    const seen = new Set<string>();
    const paid = new Map<string, number>();
    for (const event of list) {
      if (!seen.has(event.type)) {
        seen.add(event.type);
        const bucket = stageDays.get(event.type) ?? [];
        bucket.push(Math.round((Date.parse(event.date) - start) / 86_400_000));
        stageDays.set(event.type, bucket);
      }
      if (event.expenseType && event.expenseCents) {
        paid.set(event.expenseType, (paid.get(event.expenseType) ?? 0) + event.expenseCents);
      }
    }
    for (const [type, total] of paid) expenses.set(type, [...(expenses.get(type) ?? []), total]);

    const priceCents = cents(record.final_property_price_eur) ?? 0;
    const loanCents = cents(record.final_requested_loan_eur) ?? 0;
    const equityCents = cents(record.final_equity_amount_eur) ?? 0;
    const loanToValuePercent = Math.round(Number(record.lfinal_loan_to_value) * 100);
    ltv.push(loanToValuePercent);
    if (priceCents > 0) equity.push(Math.round((equityCents / priceCents) * 100));

    const story: MortgageStory = {
      events: list,
      outcome: {
        decision,
        rejectionReason: record.rejection_reason || null,
        priceCents,
        loanCents,
        equityCents,
        collateralCents: cents(record.final_collateral_value_eur) ?? 0,
        requiredMonthlyIncomeCents: cents(record.required_monthly_income_eur) ?? 0,
        loanToValuePercent,
      },
    };
    // Only customers who are in the database can be given their story.
    const ref = customerRef(record.customer_id ?? "");
    const exists = await db.query("SELECT 1 FROM customer_ledgers WHERE customer_ref = $1", [ref]);
    if (exists.length === 0) {
      unmatched += 1;
      continue;
    }
    // Sealed exactly as the app seals a customer's other state, so it reads back through the same door.
    await db.query(
      `INSERT INTO customer_state (customer_ref, kind, sealed_value) VALUES ($1, 'mortgage', $2)
       ON CONFLICT (customer_ref, kind) DO UPDATE SET sealed_value = EXCLUDED.sealed_value, updated_at = now()`,
      [ref, encryptField(JSON.stringify(story), customerKey(ref), "customer_state.mortgage")],
    );
    sealed += 1;
  }

  const total = outcomes.length;
  const stats: MortgageStats = {
    applications: total,
    approved,
    rejected: total - approved,
    reasons,
    days: { median: median(days), min: Math.min(...days), max: Math.max(...days) },
    medianEvents: median(counts),
    medianProperties: median(properties),
    medianLoanToValuePercent: median(ltv),
    medianEquityPercent: median(equity),
    stageDay: Object.fromEntries([...stageDays].map(([type, list]) => [type, median(list)])),
    stageShare: Object.fromEntries(
      [...stageDays].map(([type, list]) => [type, Math.round((list.length / total) * 100)]),
    ),
    expenses: Object.fromEntries(
      [...expenses].map(([type, list]) => [
        type,
        { applications: list.length, medianCents: median(list) },
      ]),
    ),
  };
  await db.query(
    `INSERT INTO app_settings (key, value) VALUES ('mortgage_stats', $1)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [JSON.stringify(stats)],
  );
  console.log(
    `Done: ${total} applications, ${sealed} customer stories sealed, ${unmatched} without a loaded customer.`,
  );
  process.exit(0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
