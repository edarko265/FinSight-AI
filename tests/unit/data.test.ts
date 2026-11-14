import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";

import { applyEntries, ENTRY_ROW_BASE, type Entry } from "@/lib/data/entries";
import { openLedger, openProfile, sealLedger, sealProfile } from "@/lib/data/ledger-codec";
import { parseSourceTimestamp, parseTransactionRow, SourceRowError } from "@/lib/data/source-parse";
import type { Transaction } from "@/lib/data/types";
import { translate } from "@/lib/i18n/translate";
import { en } from "@/lib/i18n/messages/en";
import { fi } from "@/lib/i18n/messages/fi";
import { sv } from "@/lib/i18n/messages/sv";
import { CryptoError, deriveCustomerKey } from "@/lib/security/crypto";

const RECORD = {
  customer_id: "TEST00001",
  bank_account_id: "ACC1",
  tx_date: "2024-10-03",
  tx_timestamp: "03OCT24:09:04:04",
  category: "Groceries",
  tx_amount_eur: "-32.51",
  balance_after_eur: "3080.7",
  transaction_type: "purchase",
  merchant_id: "",
  mcc_code: "5411",
};

describe("source parsing", () => {
  it("parses the bank's timestamp format without inventing a timezone", () => {
    expect(parseSourceTimestamp("03OCT24:09:04:04")).toEqual({
      date: "2024-10-03",
      time: "09:04:04",
    });
    expect(() => parseSourceTimestamp("2024-10-03 09:04")).toThrow();
    expect(() => parseSourceTimestamp("03XYZ24:09:04:04")).toThrow();
  });

  it("turns a row into integer cents and keeps empty merchant fields as null", () => {
    expect(parseTransactionRow(RECORD, 7)).toEqual({
      row: 7,
      date: "2024-10-03",
      time: "09:04:04",
      amountCents: -3251,
      balanceCents: 308070,
      category: "Groceries",
      type: "purchase",
      merchantId: null,
      mcc: "5411",
    });
  });

  it("rejects a malformed row and names the row number", () => {
    expect(() => parseTransactionRow({ ...RECORD, tx_amount_eur: "12.345" }, 9)).toThrow(
      SourceRowError,
    );
    expect(() => parseTransactionRow({ ...RECORD, tx_date: "2024-10-04" }, 9)).toThrow(/Row 9/);
  });
});

describe("ledger encryption", () => {
  const master = { id: "k1", key: randomBytes(32) };
  const key = deriveCustomerKey(master, "ref-a");
  const ledger: Transaction[] = [
    parseTransactionRow(RECORD, 1),
    parseTransactionRow({ ...RECORD, category: "Health" }, 2),
  ];

  it("round-trips a ledger and a profile", () => {
    expect(openLedger(sealLedger(ledger, key), key)).toEqual(ledger);
    const profile = { customerId: "TEST00001", accountId: "ACC1", age: 40, postalCode: "00100" };
    expect(openProfile(sealProfile(profile, key), key)).toEqual(profile);
  });

  it("stores nothing readable and cannot be opened with another customer's key", () => {
    const sealed = sealLedger(ledger, key);
    expect(sealed).not.toContain("Groceries");
    expect(sealed).not.toContain("3251");
    expect(() => openLedger(sealed, deriveCustomerKey(master, "ref-b"))).toThrow(CryptoError);
  });
});

describe("translations", () => {
  it("has the same keys and placeholders in every language", () => {
    const placeholders = (text: string): string[] =>
      [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1] ?? "").sort();
    for (const [key, english] of Object.entries(en)) {
      for (const other of [fi, sv]) {
        const translated = (other as Record<string, string>)[key];
        expect(translated, key).toBeTruthy();
        expect(placeholders(translated ?? ""), key).toEqual(placeholders(english));
      }
    }
    expect(Object.keys(fi).sort()).toEqual(Object.keys(en).sort());
    expect(Object.keys(sv).sort()).toEqual(Object.keys(en).sort());
  });

  it("fills in parameters", () => {
    expect(translate("fi", "evidence.count", { count: 3 })).toBe("3 tapahtumaa");
  });
});

describe("income and expenses the customer records", () => {
  const tx = (
    row: number,
    date: string,
    amountCents: number,
    balanceCents: number,
  ): Transaction => ({
    row,
    date,
    time: "09:00:00",
    amountCents,
    balanceCents,
    category: "Groceries",
    type: "purchase",
    merchantId: null,
    mcc: "5411",
  });
  const main = [tx(1, "2026-09-01", -1000, 9000), tx(2, "2026-09-10", -500, 8500)];
  const entry = (over: Partial<Entry>): Entry => ({
    id: "entry-1",
    row: ENTRY_ROW_BASE + 1,
    kind: "expense",
    cents: 2000,
    date: "2026-09-05",
    category: "Restaurants",
    note: "",
    ...over,
  });

  it("leaves the history alone when nothing is recorded", () => {
    expect(applyEntries(main, [], "2026-09-15")).toEqual(main);
  });

  it("carries an expense through every balance after it", () => {
    const out = applyEntries(main, [entry({})], "2026-09-15");
    expect(out.map((item) => item.balanceCents)).toEqual([9000, 7000, 6500]);
    expect(out[1]).toMatchObject({ manual: true, amountCents: -2000, type: "purchase" });
  });

  it("adds income to the balance, salary as salary and the rest as other income", () => {
    const out = applyEntries(
      main,
      [
        entry({ kind: "income", category: "salary", cents: 10_000, date: "2026-09-15" }),
        entry({ id: "entry-2", row: ENTRY_ROW_BASE + 2, kind: "income", category: "gift" }),
      ],
      "2026-09-15",
    );
    expect(out.at(-1)).toMatchObject({ type: "salary", balanceCents: 8500 + 2000 + 10_000 });
    expect(out[1]).toMatchObject({ type: "other_income", balanceCents: 11_000 });
  });

  it("ignores an entry dated after today, and starts from zero with no history", () => {
    expect(applyEntries(main, [entry({ date: "2026-09-16" })], "2026-09-15")).toEqual(main);
    expect(applyEntries([], [entry({})], "2026-09-15")[0]?.balanceCents).toBe(-2000);
  });
});
