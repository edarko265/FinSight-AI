import { describe, expect, it } from "vitest";

import { nextTierId, offerText, ringOffset } from "@/components/goals/voucher-view";
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

});

describe("offerText", () => {
  const t = (key: string): string => key;
  it("formats grocery percent and fuel cents per locale", () => {
    const grocery = offerText({ id: "silver-grocery", kind: "grocery", percentOff: 10 }, t, "en");
    expect(grocery.params.percent).toBe("10%");
    expect(grocery.titleKey).toBe("voucher.kind.grocery.title");
    expect(offerText({ id: "x", kind: "grocery", percentOff: 10 }, t, "fi").params.percent).toMatch(
      /^10\s%$/,
    );
    const fuel = offerText({ id: "gold-fuel", kind: "fuel", centsPerLitre: 15 }, t, "sv");
    expect(fuel.params.cents).toBe("15");
    expect(fuel.params.brand).toBe("voucher.brand.fuel");
  });
});
