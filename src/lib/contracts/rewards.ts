import { z } from "zod";

/**
 * Voucher ladder shapes shared by the rewards API and the goals page. The
 * server calculates every figure; the UI only renders them. Money is integer
 * cents.
 */

export const VOUCHER_TIER_IDS = ["bronze", "silver", "gold", "platinum"] as const;
export type VoucherTierId = (typeof VOUCHER_TIER_IDS)[number];

export interface VoucherOption {
  id: string;
  kind: string;
  valueCents: number;
}

export interface VoucherTier {
  id: VoucherTierId;
  multiplier: number;
  targetCents: number;
  savedCents: number;
  remainingCents: number;
  /** 0 to 1. */
  progress: number;
  unlocked: boolean;
  options: VoucherOption[];
}

export interface VoucherSelection {
  /** YYYY-MM the voucher was picked for. */
  month: string;
  tierId: VoucherTierId;
  optionId: string;
}

/** The public statistic the targets are built on. */
export interface VoucherSource {
  name: string;
  year: number;
  ratePercent: number;
  /** The rate actually used: the national rate, but never below the floor. */
  baseRatePercent: number;
}

export interface VoucherLadder {
  month: string;
  incomeCents: number;
  savedCents: number;
  source: VoucherSource;
  tiers: VoucherTier[];
  selected: VoucherSelection | null;
}

/** POST body for choosing a voucher. The month is set by the server. */
export const voucherSelectionSchema = z
  .object({
    tierId: z.enum(VOUCHER_TIER_IDS),
    optionId: z.string().min(1).max(40),
  })
  .strict();
export type VoucherSelectionInput = z.infer<typeof voucherSelectionSchema>;
