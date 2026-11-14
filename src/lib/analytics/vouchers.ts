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

/** The national household saving rate can be near zero or negative, which would make every target 0. */
export const MIN_BASE_RATE = 0.03;

export interface VoucherLadderInput {
  incomeCents: number;
  savedCents: number;
  month: string;
  nationalRatePercent: number;
  selection: VoucherSelection | null;
  source: VoucherSource;
}

export function baseRate(nationalRatePercent: number): number {
  return Math.max(nationalRatePercent / 100, MIN_BASE_RATE);
}

export function voucherLadder(input: VoucherLadderInput): VoucherLadder {
  const { incomeCents, savedCents, month, selection, source } = input;
  const rate = baseRate(input.nationalRatePercent);
  const saved = Math.max(0, savedCents);

  const tiers: VoucherTier[] = VOUCHER_TIERS.map((tier) => {
    // Round once per tier so the target is a whole number of cents.
    const targetCents = incomeCents > 0 ? Math.round(incomeCents * rate * tier.multiplier) : 0;
    const progress = targetCents > 0 ? Math.min(1, Math.max(0, saved / targetCents)) : 0;
    return {
      id: tier.id,
      multiplier: tier.multiplier,
      targetCents,
      savedCents: saved,
      remainingCents: Math.max(0, targetCents - saved),
      progress,
      unlocked: targetCents > 0 && saved >= targetCents,
      options: tier.options.map((option) => ({ ...option })),
    };
  });

  const picked = selection && selection.month === month ? selection : null;
  const selected = picked && canSelectIn(tiers, picked.tierId, picked.optionId) ? picked : null;

  return {
    month,
    incomeCents,
    savedCents: saved,
    // The rate in use is derived here so it can never disagree with the targets.
    source: { ...source, baseRatePercent: Math.round(rate * 1000) / 10 },
    tiers,
    selected,
  };
}

function canSelectIn(tiers: VoucherTier[], tierId: VoucherTierId, optionId: string): boolean {
  const tier = tiers.find((candidate) => candidate.id === tierId);
  return Boolean(tier?.unlocked && tier.options.some((option) => option.id === optionId));
}

/** True when the tier is unlocked and the option belongs to it. */
export function canSelect(ladder: VoucherLadder, tierId: VoucherTierId, optionId: string): boolean {
  return canSelectIn(ladder.tiers, tierId, optionId);
}
