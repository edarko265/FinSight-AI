import { describe, expect, it } from "vitest";

import { nextTierId, ringOffset, statusKey } from "@/components/goals/voucher-view";
import type { VoucherTier } from "@/lib/contracts/rewards";

const tier = (id: VoucherTier["id"], unlocked: boolean): VoucherTier => ({
  id,
  multiplier: 1,
  targetCents: 100,
  remainingCents: 0,
  progress: 0,
  unlocked,
  options: [],
});

describe("voucher view helpers", () => {
  it("clamps the ring and hides tiny progress", () => {
    expect(ringOffset(100, 0)).toBe(100);
    expect(ringOffset(100, 0.01)).toBe(100);
    expect(ringOffset(100, 0.5)).toBe(50);
    expect(ringOffset(100, 1.7)).toBe(0);
    expect(ringOffset(100, -1)).toBe(100);
    expect(ringOffset(100, Number.NaN)).toBe(100);
  });

  it("finds the first locked tier", () => {
    const tiers = [tier("bronze", true), tier("silver", false), tier("gold", false)];
    expect(nextTierId(tiers)).toBe("silver");
    expect(nextTierId([tier("bronze", true)])).toBeUndefined();
  });

  it("names the provisional status only when it applies", () => {
    expect(statusKey(true)).toBe("voucher.provisional");
    expect(statusKey(false)).toBeNull();
  });
});
