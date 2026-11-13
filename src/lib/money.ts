/**
 * Money is handled as integer cents everywhere. Decimal strings from source
 * files are parsed without ever passing through a binary float.
 */

const DECIMAL_PATTERN = /^([+-])?(\d+)(?:\.(\d+))?$/;

export class MoneyParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoneyParseError";
  }
}

/**
 * Parses a decimal amount such as "-12.5" or "1043.07" into integer cents.
 * Rejects more than two non-zero decimal places and values outside the safe
 * integer range instead of rounding silently.
 */
export function parseDecimalToCents(input: string): number {
  const match = DECIMAL_PATTERN.exec(input.trim());
  if (!match) {
    throw new MoneyParseError("Amount is not a plain decimal number");
  }

  const [, sign, whole = "0", fraction = ""] = match;
  if (/[1-9]/.test(fraction.slice(2))) {
    throw new MoneyParseError("Amount has more than two decimal places");
  }

  const cents = BigInt(whole) * 100n + BigInt(fraction.slice(0, 2).padEnd(2, "0"));
  if (cents > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new MoneyParseError("Amount is outside the supported range");
  }

  const value = Number(cents);
  return sign === "-" && value !== 0 ? -value : value;
}

const EUR_FORMATTER = new Intl.NumberFormat("fi-FI", { style: "currency", currency: "EUR" });

/** Formats integer cents for display. Formatting happens only at the UI boundary. */
export function formatEur(cents: number): string {
  if (!Number.isSafeInteger(cents)) {
    throw new RangeError("Cents must be a safe integer");
  }
  return EUR_FORMATTER.format(cents / 100);
}
