import { describe, expect, it } from "vitest";

import snapshot from "@/lib/analytics/saving-rate-data.json";
import {
  canSelect,
  MIN_BASE_RATE_TENTHS,
  voucherLadder,
  VOUCHER_TIERS,
} from "@/lib/analytics/vouchers";
import {
  voucherSelectionSchema,
  voucherStoredSelectionSchema,
  type VoucherSelection,
} from "@/lib/contracts/rewards";

const source = {
  id: "statfin-15ac",
  name: "Test fixture",
  table: "15ac",
  url: "https://example.test/15ac",
  licence: "CC BY 4.0",
  updated: "2026-09-18",
  provisional: true,
  year: 2025,
  ratePercent: 5.9,
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

const targets = (result: ReturnType<typeof voucherLadder>): number[] =>
  result.tiers.map((tier) => tier.targetCents);

describe("voucher ladder", () => {
  it("defines three tiers with multipliers 1 to 3", () => {
    expect(VOUCHER_TIERS.map((tier) => tier.multiplier)).toEqual([1, 2, 3]);
    expect(VOUCHER_TIERS.map((tier) => tier.id)).toEqual(["bronze", "silver", "gold"]);
    expect(
      VOUCHER_TIERS.map((tier) =>
        tier.options.map((o) => (o.kind === "grocery" ? o.percentOff : o.centsPerLitre)),
      ),
    ).toEqual([
      [5, 5],
      [10, 10],
      [15, 15],
    ]);
    expect(
      VOUCHER_TIERS.every((tier) => tier.options.map((o) => o.kind).join() === "grocery,fuel"),
    ).toBe(true);
  });

  it("floors the base rate at 3% when the national rate is negative", () => {
    const result = ladder({ nationalRatePercent: -0.1 });
    expect(MIN_BASE_RATE_TENTHS).toBe(30);
    expect(result.source).toMatchObject({
      baseRatePercent: 3,
      floorApplied: true,
      ratePercent: 5.9,
    });
    expect(targets(result)).toEqual([9000, 18000, 27000]);
  });

  it("switches from the floor to the national rate at 3.0 versus 2.9", () => {
    const at = ladder({ nationalRatePercent: 3.0 });
    expect(at.source).toMatchObject({ baseRatePercent: 3, floorApplied: false });
    const below = ladder({ nationalRatePercent: 2.9 });
    expect(below.source).toMatchObject({ baseRatePercent: 3, floorApplied: true });
    expect(targets(below)).toEqual(targets(at));
    expect(ladder({ nationalRatePercent: 3.1 }).source.baseRatePercent).toBe(3.1);
  });

  it("uses the national rate when it is above the floor", () => {
    const result = ladder({ nationalRatePercent: 5.9 });
    expect(result.source).toMatchObject({ baseRatePercent: 5.9, floorApplied: false });
    expect(targets(result)).toEqual([17700, 35400, 53100]);
  });

  it("rounds each target once to whole cents", () => {
    const result = ladder({ incomeCents: 123457, nationalRatePercent: 3 });
    // 123457 * 0.03 = 3703.71 -> 3704; x2 = 7407.42 -> 7407, not 2 * 3704
    expect(targets(result)).toEqual([3704, 7407, 11111]);
  });

  it("rounds half a cent up", () => {
    // 50 cents * 3% = 1.5 -> 2; x3 = 4.5 -> 5
    const result = ladder({ incomeCents: 50, nationalRatePercent: 0 });
    expect(targets(result)).toEqual([2, 3, 5]);
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

  it("keeps negative saving raw on the ladder but clamps tier progress", () => {
    const result = ladder({ savedCents: -2500, nationalRatePercent: 0 });
    expect(result.savedCents).toBe(-2500);
    expect(result.tiers[0]).toMatchObject({ progress: 0, unlocked: false, remainingCents: 9000 });
  });

  it("is unavailable and unlocks nothing when income is zero or negative", () => {
    for (const incomeCents of [0, -5000]) {
      const result = ladder({ incomeCents, savedCents: 10000 });
      expect(result.available).toBe(false);
      for (const tier of result.tiers) {
        expect(tier).toMatchObject({
          targetCents: 0,
          remainingCents: 0,
          progress: 0,
          unlocked: false,
        });
      }
    }
    expect(ladder({}).available).toBe(true);
  });

  it("throws on non-integer money and non-finite rates", () => {
    expect(() => ladder({ incomeCents: Number.NaN })).toThrow();
    expect(() => ladder({ incomeCents: 1000.5 })).toThrow();
    expect(() => ladder({ savedCents: 10.25 })).toThrow();
    expect(() => ladder({ savedCents: Number.POSITIVE_INFINITY })).toThrow();
    expect(() => ladder({ nationalRatePercent: Number.NaN })).toThrow();
  });

  it("returns the stored pick as-is and flags whether it is still valid", () => {
    const pick: VoucherSelection = {
      month: "2026-03",
      tierId: "silver",
      optionId: "silver-fuel",
    };
    const valid = ladder({ savedCents: 18000, nationalRatePercent: 0, selection: pick });
    expect(valid.selected).toEqual(pick);
    expect(valid.selectedValid).toBe(true);

    // silver is locked at 17999: the pick is kept but invalid
    const locked = ladder({ savedCents: 17999, nationalRatePercent: 0, selection: pick });
    expect(locked.selected).toEqual(pick);
    expect(locked.selectedValid).toBe(false);

    expect(ladder({ savedCents: 18000 }).selectedValid).toBe(false);
  });

  it("rejects an option that does not belong to an unlocked tier", () => {
    const unknown: VoucherSelection = {
      month: "2026-03",
      tierId: "silver",
      optionId: "silver-yacht",
    };
    const result = ladder({ savedCents: 18000, nationalRatePercent: 0, selection: unknown });
    expect(result.selectedValid).toBe(false);
    expect(canSelect(result, "silver", "silver-yacht")).toBe(false);
  });

  it("validates new picks with canSelect", () => {
    const result = ladder({ savedCents: 18000, nationalRatePercent: 0 });
    expect(canSelect(result, "bronze", "bronze-grocery")).toBe(true);
    expect(canSelect(result, "silver", "silver-fuel")).toBe(true);
    expect(canSelect(result, "gold", "gold-grocery")).toBe(false);
    expect(canSelect(result, "silver", "bronze-fuel")).toBe(false);
    expect(canSelect(result, "silver", "nope")).toBe(false);
  });

  it("gives every option id a schema-valid tier-kind shape", () => {
    for (const tier of VOUCHER_TIERS) {
      for (const option of tier.options) {
        expect(
          voucherSelectionSchema.safeParse({ tierId: tier.id, optionId: option.id }).success,
        ).toBe(true);
        expect(option.id).toBe(`${tier.id}-${option.kind}`);
      }
    }
  });
});

describe("voucher schemas", () => {
  it("is strict about the POST body", () => {
    expect(
      voucherSelectionSchema.safeParse({ tierId: "gold", optionId: "gold-fuel" }).success,
    ).toBe(true);
    expect(
      voucherSelectionSchema.safeParse({ tierId: "gold", optionId: "gold-yacht" }).success,
    ).toBe(false);
    expect(voucherSelectionSchema.safeParse({ tierId: "tin", optionId: "gold-fuel" }).success).toBe(
      false,
    );
    expect(
      voucherSelectionSchema.safeParse({ tierId: "gold", optionId: "gold-fuel", month: "2026-03" })
        .success,
    ).toBe(false);
  });

  it("reads a stored pick with a retired tier or option id as no pick", () => {
    for (const old of [
      { tierId: "bronze", optionId: "bronze-coffee" },
      { tierId: "gold", optionId: "gold-books" },
      { tierId: "platinum", optionId: "platinum-groceries" },
    ]) {
      expect(voucherStoredSelectionSchema.safeParse({ month: "2026-03", ...old }).success).toBe(
        false,
      );
    }
  });

  it("validates a stored pick", () => {
    const pick = { month: "2026-03", tierId: "gold", optionId: "gold-fuel" };
    expect(voucherStoredSelectionSchema.safeParse(pick).success).toBe(true);
    expect(voucherStoredSelectionSchema.safeParse({ ...pick, month: "March" }).success).toBe(false);
    expect(voucherStoredSelectionSchema.safeParse({ ...pick, extra: 1 }).success).toBe(false);
  });
});

describe("saving-rate snapshot", () => {
  it("has the committed shape", () => {
    expect(snapshot.source).toMatchObject({
      table: "15ac",
      licence: "CC BY 4.0",
      url: expect.stringMatching(/^https:\/\//),
      updated: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
    expect(snapshot.source.name.length).toBeGreaterThan(0);
    expect(Number.isInteger(snapshot.year)).toBe(true);
    expect(typeof snapshot.provisional).toBe("boolean");
    expect(snapshot.ratePercent).toBeGreaterThan(-20);
    expect(snapshot.ratePercent).toBeLessThan(40);
    const latest = snapshot.history[snapshot.history.length - 1];
    expect(latest).toMatchObject({ year: snapshot.year, ratePercent: snapshot.ratePercent });
    for (const entry of snapshot.history) {
      expect(Number.isInteger(entry.year)).toBe(true);
      expect(Number.isFinite(entry.ratePercent)).toBe(true);
      expect(typeof entry.provisional).toBe("boolean");
    }
  });
});
