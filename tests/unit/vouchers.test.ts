import { describe, expect, it } from "vitest";

import { canSelect, MIN_BASE_RATE, voucherLadder, VOUCHER_TIERS } from "@/lib/analytics/vouchers";
import type { VoucherSelection, VoucherSource } from "@/lib/contracts/rewards";

const source: VoucherSource = {
  name: "Test fixture",
  year: 2025,
  ratePercent: 5.9,
  baseRatePercent: 0,
};

function ladder(overrides: {
  incomeCents?: number;
  savedCents?: number;
  nationalRatePercent?: number;
  selection?: VoucherSelection | null;
}): ReturnType<typeof voucherLadder> {
  return voucherLadder({
    incomeCents: 300000,
    savedCents: 0,
    month: "2026-03",
    nationalRatePercent: 5,
    selection: null,
    source,
    ...overrides,
  });
}

describe("voucher ladder", () => {
  it("defines four tiers with multipliers 1 to 4", () => {
    expect(VOUCHER_TIERS.map((tier) => tier.multiplier)).toEqual([1, 2, 3, 4]);
    expect(VOUCHER_TIERS.every((tier) => tier.options.length >= 2)).toBe(true);
  });

  it("floors the base rate at 3% when the national rate is negative", () => {
    const result = ladder({ nationalRatePercent: -0.1 });
    expect(MIN_BASE_RATE).toBe(0.03);
    expect(result.source.baseRatePercent).toBe(3);
    expect(result.tiers.map((tier) => tier.targetCents)).toEqual([9000, 18000, 27000, 36000]);
  });

  it("uses the national rate when it is above the floor", () => {
    const result = ladder({ nationalRatePercent: 5.9 });
    expect(result.source.baseRatePercent).toBe(5.9);
    expect(result.tiers.map((tier) => tier.targetCents)).toEqual([17700, 35400, 53100, 70800]);
  });

  it("rounds each target once to whole cents", () => {
    const result = ladder({ incomeCents: 123457, nationalRatePercent: 3 });
    // 123457 * 0.03 = 3703.71 -> 3704; x2 = 7407.42 -> 7407, not 2 * 3704
    expect(result.tiers.map((tier) => tier.targetCents)).toEqual([3704, 7407, 11111, 14815]);
  });

  it("unlocks exactly at the target and not one cent below", () => {
    const at = ladder({ savedCents: 9000, nationalRatePercent: 0 });
    expect(at.tiers[0]).toMatchObject({ unlocked: true, remainingCents: 0, progress: 1 });
    expect(at.tiers[1]?.unlocked).toBe(false);

    const below = ladder({ savedCents: 8999, nationalRatePercent: 0 });
    expect(below.tiers[0]).toMatchObject({ unlocked: false, remainingCents: 1 });
    expect(below.tiers[0]?.progress).toBeCloseTo(8999 / 9000, 10);
  });

  it("clamps progress to 1 when savings exceed the target", () => {
    const result = ladder({ savedCents: 100000, nationalRatePercent: 0 });
    expect(result.tiers.every((tier) => tier.progress === 1 && tier.unlocked)).toBe(true);
  });

  it("unlocks nothing when income is zero or negative", () => {
    for (const incomeCents of [0, -5000]) {
      const result = ladder({ incomeCents, savedCents: 10000 });
      for (const tier of result.tiers) {
        expect(tier).toMatchObject({
          targetCents: 0,
          remainingCents: 0,
          progress: 0,
          unlocked: false,
        });
      }
    }
  });

  it("marks the selection only for an unlocked tier in the same month", () => {
    const pick: VoucherSelection = {
      month: "2026-03",
      tierId: "silver",
      optionId: "silver-cinema",
    };
    expect(ladder({ savedCents: 18000, nationalRatePercent: 0, selection: pick }).selected).toEqual(
      pick,
    );
    // silver is locked at 17999
    expect(
      ladder({ savedCents: 17999, nationalRatePercent: 0, selection: pick }).selected,
    ).toBeNull();
    // selection from another month does not carry over
    const old = { ...pick, month: "2026-02" };
    expect(
      ladder({ savedCents: 18000, nationalRatePercent: 0, selection: old }).selected,
    ).toBeNull();
  });

  it("validates selections with canSelect", () => {
    const result = ladder({ savedCents: 18000, nationalRatePercent: 0 });
    expect(canSelect(result, "bronze", "bronze-coffee")).toBe(true);
    expect(canSelect(result, "silver", "silver-cinema")).toBe(true);
    expect(canSelect(result, "gold", "gold-books")).toBe(false);
    expect(canSelect(result, "silver", "bronze-coffee")).toBe(false);
    expect(canSelect(result, "silver", "nope")).toBe(false);
  });
});
