import type { Transaction } from "@/lib/data/types";
import { parseDecimalToCents } from "@/lib/money";

const MONTHS: Record<string, string> = {
  JAN: "01",
  FEB: "02",
  MAR: "03",
  APR: "04",
  MAY: "05",
  JUN: "06",
  JUL: "07",
  AUG: "08",
  SEP: "09",
  OCT: "10",
  NOV: "11",
  DEC: "12",
};

const TIMESTAMP = /^(\d{2})([A-Z]{3})(\d{2}):(\d{2}):(\d{2}):(\d{2})$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const TRANSACTION_HEADERS = [
  "customer_id",
  "bank_account_id",
  "tx_date",
  "tx_timestamp",
  "category",
  "tx_amount_eur",
  "balance_after_eur",
  "transaction_type",
  "merchant_id",
  "mcc_code",
] as const;

export class SourceRowError extends Error {
  constructor(
    message: string,
    readonly row: number,
  ) {
    super(`Row ${row}: ${message}`);
    this.name = "SourceRowError";
  }
}

/**
 * Parses a source timestamp such as "03OCT24:09:04:04" into a local date and
 * time. Two-digit years are read as 20YY: the dataset covers 2024-2026. No
 * timezone is supplied, so none is invented.
 */
export function parseSourceTimestamp(raw: string): { date: string; time: string } {
  const match = TIMESTAMP.exec(raw.trim().toUpperCase());
  if (!match) throw new Error(`Unrecognised timestamp "${raw}"`);
  const [, day, monthName = "", year, hours, minutes, seconds] = match;
  const month = MONTHS[monthName];
  if (!month) throw new Error(`Unrecognised month in "${raw}"`);
  return { date: `20${year}-${month}-${day}`, time: `${hours}:${minutes}:${seconds}` };
}

/** Normalises amounts printed with long float tails (e.g. "3138.668255808") to cents. */
function toCents(raw: string): number {
  return parseDecimalToCents(raw);
}

export function parseTransactionRow(record: Record<string, string>, row: number): Transaction {
  try {
    const date = record.tx_date ?? "";
    if (!ISO_DATE.test(date)) throw new Error(`Unrecognised date "${date}"`);
    const stamp = parseSourceTimestamp(record.tx_timestamp ?? "");
    if (stamp.date !== date) throw new Error("Date and timestamp disagree");
    const category = (record.category ?? "").trim();
    const type = (record.transaction_type ?? "").trim();
    if (!category || !type) throw new Error("Missing category or transaction type");
    return {
      row,
      date,
      time: stamp.time,
      amountCents: toCents(record.tx_amount_eur ?? ""),
      balanceCents: toCents(record.balance_after_eur ?? ""),
      category,
      type,
      merchantId: record.merchant_id?.trim() || null,
      mcc: record.mcc_code?.trim() || null,
    };
  } catch (error) {
    throw new SourceRowError(error instanceof Error ? error.message : "Invalid row", row);
  }
}
