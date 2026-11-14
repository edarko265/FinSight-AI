import { z } from "zod";

/**
 * Voucher ladder shapes shared by the rewards API and the goals page. The
 * server calculates every figure; the UI only renders them. Money is integer
 * cents.
 */

const VOUCHER_TIER_IDS = ["bronze", "silver", "gold", "platinum", "diamond"] as const;
export type VoucherTierId = (typeof VOUCHER_TIER_IDS)[number];

const VOUCHER_KINDS = ["grocery", "fuel"] as const;
export type VoucherKind = (typeof VOUCHER_KINDS)[number];

/**
 * What a voucher is for: the group's own offers. A grocery voucher takes a percentage off one
 * product, a fuel voucher takes cents per litre off one top-up. Both are whole numbers.
 */
export type VoucherOption =
  | {
      /** `<tier>-<kind>`. */
      id: string;
      kind: "grocery";
      percentOff: number;
    }
  | {
      id: string;
      kind: "fuel";
      centsPerLitre: number;
    };

export interface VoucherTier {
  id: VoucherTierId;
  multiplier: number;
  targetCents: number;
  /** Relative to the evaluated month's saving (`VoucherLadder.savedCents`), never below 0. */
  remainingCents: number;
  /** 0 to 1. */
  progress: number;
  unlocked: boolean;
  options: VoucherOption[];
}

export interface VoucherSelection {
  /** YYYY-MM the voucher was picked for: the evaluated month. */
  month: string;
  tierId: VoucherTierId;
  optionId: string;
}

/** The public statistic the targets are built on, with what the UI needs to credit it. */
export interface VoucherSource {
  /** Stable id (e.g. "statfin-15ac") so the UI can show a localised name. */
  id: string;
  name: string;
  table: string;
  url: string;
  licence: string;
  /** Date the table was last updated (YYYY-MM-DD). */
  updated: string;
  /** The statistic is still marked provisional by the publisher. */
  provisional: boolean;
  year: number;
  /** The published national rate, as fetched. */
  ratePercent: number;
  /** The rate actually used: the national rate, but never below the floor. */
  baseRatePercent: number;
  /** True when the national rate was below the floor and the floor was used. */
  floorApplied: boolean;
}

export interface VoucherLadder {
  /** The evaluated month (YYYY-MM): the last completed month. */
  month: string;
  /** False when there is no income to measure against; the UI shows no targets. */
  available: boolean;
  incomeCents: number;
  /** Net saving in the evaluated month. Can be negative. */
  savedCents: number;
  source: VoucherSource;
  tiers: VoucherTier[];
  /** The stored pick as-is, if any. Check `selectedValid` before showing it as earned. */
  selected: VoucherSelection | null;
  /** The stored pick's tier is unlocked and the option belongs to that tier. */
  selectedValid: boolean;
}

const OPTION_ID = new RegExp(`^(${VOUCHER_TIER_IDS.join("|")})-(${VOUCHER_KINDS.join("|")})$`);

/** POST body for choosing a voucher. The month is set by the server. */
export const voucherSelectionSchema = z
  .object({
    tierId: z.enum(VOUCHER_TIER_IDS),
    optionId: z.string().regex(OPTION_ID),
  })
  .strict();
export type VoucherSelectionInput = z.infer<typeof voucherSelectionSchema>;

/** Validates a stored (decrypted) pick before it is trusted. */
export const voucherStoredSelectionSchema = z
  .object({
    month: z.string().regex(/^\d{4}-\d{2}$/),
    tierId: z.enum(VOUCHER_TIER_IDS),
    optionId: z.string().regex(OPTION_ID),
  })
  .strict();
