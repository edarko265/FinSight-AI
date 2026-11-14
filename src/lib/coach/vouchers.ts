import "server-only";

import { lastCompletedMonth, monthKey } from "@/lib/analytics/periods";
import { voucherStoredSelectionSchema, type VoucherSelection } from "@/lib/contracts/rewards";
import { readState, writeState } from "@/lib/data/repository";

const KIND = "voucher-pick";

/**
 * The customer's voucher pick for the evaluated month (the last completed month, from the demo
 * clock), or null. A stored value that fails validation, or one for another month, is ignored.
 */
export async function readVoucherPick(
  customerRef: string,
  asOf: string,
): Promise<VoucherSelection | null> {
  let stored: unknown;
  try {
    stored = await readState<unknown>(customerRef, KIND);
  } catch (error) {
    // Undecryptable or corrupt: treat as no pick. Never log the value.
    console.error("voucher pick: could not read:", error instanceof Error ? error.name : "error");
    return null;
  }
  const parsed = voucherStoredSelectionSchema.safeParse(stored);
  if (!parsed.success) return null;
  return parsed.data.month === monthKey(lastCompletedMonth(asOf).startInclusive)
    ? parsed.data
    : null;
}

/** One pick per customer: choosing again replaces it. */
export async function writeVoucherPick(customerRef: string, pick: VoucherSelection): Promise<void> {
  await writeState(customerRef, KIND, pick);
}

/** Removing the pick stores nothing; `readVoucherPick` then returns null. */
export async function clearVoucherPick(customerRef: string): Promise<void> {
  await writeState(customerRef, KIND, null);
}
