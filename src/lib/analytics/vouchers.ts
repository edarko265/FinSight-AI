import type {
  VoucherLadder,
  VoucherOption,
  VoucherSelection,
  VoucherSource,
  VoucherTier,
  VoucherTierId,
} from "@/lib/contracts/rewards";

export const VOUCHER_TIERS: readonly {
  id: VoucherTierId;
  multiplier: number;
  options: readonly VoucherOption[];
}[] = [
  {
    id: "bronze",
    multiplier: 1,
    options: [
      { id: "bronze-coffee", kind: "coffee", valueCents: 500 },
      { id: "bronze-groceries", kind: "groceries", valueCents: 500 },
    ],
  },
  {
    id: "silver",
    multiplier: 2,
    options: [
      { id: "silver-coffee", kind: "coffee", valueCents: 1000 },
      { id: "silver-groceries", kind: "groceries", valueCents: 1000 },
      { id: "silver-cinema", kind: "cinema", valueCents: 1000 },
    ],
  },
  {
    id: "gold",
    multiplier: 3,
    options: [
      { id: "gold-groceries", kind: "groceries", valueCents: 2000 },
      { id: "gold-cinema", kind: "cinema", valueCents: 2000 },
      { id: "gold-books", kind: "books", valueCents: 2000 },
    ],
  },
  {
    id: "platinum",
    multiplier: 4,
    options: [
      { id: "platinum-groceries", kind: "groceries", valueCents: 4000 },
      { id: "platinum-cinema", kind: "cinema", valueCents: 4000 },
      { id: "platinum-books", kind: "books", valueCents: 4000 },
    ],
  },
];

/**
 * The national household saving rate can be near zero or negative, which would make every target 0.
 * Held as integer tenths of a percent so display and maths use the same number.
 */
export const MIN_BASE_RATE_TENTHS = 30;

export interface VoucherLadderInput {
  incomeCents: number;
  /** Net saving in `month`; may be negative. */
  savedCents: number;
  /** The evaluated month: the last completed month, passed in from the demo clock by the caller. */
  month: string;
  nationalRatePercent: number;
  /** The stored pick for `month`, if any. */
  selection: VoucherSelection | null;
  source: Omit<VoucherSource, "baseRatePercent" | "floorApplied">;
}

export function voucherLadder(input: VoucherLadderInput): VoucherLadder {
  const { incomeCents, savedCents, month, selection, source } = input;
  if (!Number.isSafeInteger(incomeCents)) throw new Error("incomeCents must be a safe integer");
  if (!Number.isSafeInteger(savedCents)) throw new Error("savedCents must be a safe integer");
  if (!Number.isFinite(input.nationalRatePercent))
    throw new Error("nationalRatePercent must be finite");

  const nationalTenths = Math.round(input.nationalRatePercent * 10);
  const tenths = Math.max(nationalTenths, MIN_BASE_RATE_TENTHS);
  const available = incomeCents > 0;
  const saved = Math.max(0, savedCents);

  const tiers: VoucherTier[] = VOUCHER_TIERS.map((tier) => {
    // Round once per tier so the target is a whole number of cents.
    const targetCents = available ? Math.round((incomeCents * tenths * tier.multiplier) / 1000) : 0;
    return {
      id: tier.id,
      multiplier: tier.multiplier,
      targetCents,
      remainingCents: Math.max(0, targetCents - saved),
      progress: targetCents > 0 ? Math.min(1, saved / targetCents) : 0,
      unlocked: targetCents > 0 && saved >= targetCents,
      options: tier.options.map((option) => ({ ...option })),
    };
  });

  return {
    month,
    available,
    incomeCents,
    savedCents,
    source: {
      ...source,
      baseRatePercent: tenths / 10,
      floorApplied: nationalTenths < MIN_BASE_RATE_TENTHS,
    },
    tiers,
    selected: selection,
    selectedValid: selection !== null && canSelectIn(tiers, selection.tierId, selection.optionId),
  };
}

function canSelectIn(tiers: VoucherTier[], tierId: VoucherTierId, optionId: string): boolean {
  const tier = tiers.find((candidate) => candidate.id === tierId);
  return Boolean(tier?.unlocked && tier.options.some((option) => option.id === optionId));
}

/** The rule for new picks: the tier is unlocked and the option belongs to it. */
export function canSelect(ladder: VoucherLadder, tierId: VoucherTierId, optionId: string): boolean {
  return canSelectIn(ladder.tiers, tierId, optionId);
}
