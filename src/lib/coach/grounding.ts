import type { ToolResult } from "@/lib/coach/tools";

/**
 * Checks that every euro amount in the model's wording is one the calculations
 * actually produced. The model is told to repeat figures exactly; this is the
 * check that it did. An answer with an unsupported amount is not shown.
 */
const AMOUNT = /(?:€\s*(\d[\d\s.,  ]*\d|\d))|(?:(\d[\d\s.,  ]*\d|\d)\s*(?:€|euro\w*|eur\b))/gi;

/** Reads "1 011,45", "1,011.45", "1011.45" or "1011" as cents; null if it is not a number. */
export function parseAmountToCents(raw: string): number | null {
  const compact = raw.replace(/[\s  ]/g, "");
  const lastSeparator = Math.max(compact.lastIndexOf(","), compact.lastIndexOf("."));
  const decimals = lastSeparator === -1 ? 0 : compact.length - lastSeparator - 1;
  const hasDecimals = decimals === 1 || decimals === 2;
  const whole = (hasDecimals ? compact.slice(0, lastSeparator) : compact).replace(/[.,]/g, "");
  const fraction = hasDecimals ? compact.slice(lastSeparator + 1).padEnd(2, "0") : "00";
  if (!/^\d+$/.test(whole) || !/^\d{2}$/.test(fraction)) return null;
  return Number(whole) * 100 + Number(fraction);
}

/** Every amount the tools returned, in cents, including the ones written into their own text. */
function supportedAmounts(results: readonly ToolResult[]): Set<number> {
  const supported = new Set<number>();
  const add = (cents: number): void => {
    supported.add(Math.abs(cents));
  };
  for (const result of results) {
    for (const fact of result.facts) add(fact.valueCents);
    for (const point of result.card?.chart.points ?? []) add(point.valueCents);
    for (const text of [result.text, result.lesson ?? "", result.card?.basis ?? ""]) {
      for (const match of text.matchAll(AMOUNT)) {
        const cents = parseAmountToCents(match[1] ?? match[2] ?? "");
        if (cents !== null) add(cents);
      }
    }
  }
  return supported;
}

export interface GroundingCheck {
  grounded: boolean;
  /** Amounts in the text that no calculation produced. */
  unsupported: string[];
}

export function checkGrounding(text: string, results: readonly ToolResult[]): GroundingCheck {
  const supported = supportedAmounts(results);
  const unsupported: string[] = [];
  for (const match of text.matchAll(AMOUNT)) {
    const raw = match[1] ?? match[2] ?? "";
    const cents = parseAmountToCents(raw);
    if (cents === null) continue;
    // An exact match, or the same figure rounded to whole euros ("about 1,011 euros").
    const exact = supported.has(cents);
    const rounded =
      cents % 100 === 0 && [...supported].some((value) => Math.round(value / 100) * 100 === cents);
    if (!exact && !rounded) unsupported.push(raw.trim());
  }
  return { grounded: unsupported.length === 0, unsupported };
}
