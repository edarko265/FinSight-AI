import type { VoucherTier, VoucherTierId } from "@/lib/contracts/rewards";

/** Below this share the ring shows nothing: a round cap alone would read as about 5%. */
export const RING_MIN_PROGRESS = 0.02;

/** stroke-dashoffset for a ring of the given circumference; progress is clamped to 0..1. */
export function ringOffset(length: number, progress: number): number {
  const clamped = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
  return clamped < RING_MIN_PROGRESS ? length : length * (1 - clamped);
}

/** The first locked tier in ladder order, the one to highlight as the next goal. */
export function nextTierId(tiers: readonly VoucherTier[]): VoucherTierId | undefined {
  return tiers.find((tier) => !tier.unlocked)?.id;
}

/** Text appended to the source year: the provisional note, or nothing. */
export function statusKey(provisional: boolean): "voucher.provisional" | null {
  return provisional ? "voucher.provisional" : null;
}
