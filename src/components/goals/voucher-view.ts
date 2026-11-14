import type { VoucherOption, VoucherTier, VoucherTierId } from "@/lib/contracts/rewards";
import { LOCALE_INFO, type Locale } from "@/lib/i18n/config";
import type { MessageKey } from "@/lib/i18n/translate";

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

export interface OfferText {
  /** Message keys: what the voucher is, and the chosen-voucher sentence. */
  titleKey: MessageKey;
  chosenKey: MessageKey;
  /** Placeholder values for the keys above, already formatted for the locale. */
  params: Record<string, string>;
}

/** Wording for an offer. Numbers go through Intl; the unit lives in the messages. */
export function offerText(
  option: VoucherOption,
  t: (key: MessageKey) => string,
  locale: Locale,
): OfferText {
  const intl = LOCALE_INFO[locale].intl;
  if (option.kind === "grocery") {
    return {
      titleKey: "voucher.kind.grocery.title",
      chosenKey: "voucher.kind.grocery.chosen",
      params: {
        percent: new Intl.NumberFormat(intl, { style: "percent" }).format(option.percentOff / 100),
        brand: t("voucher.brand.grocery"),
      },
    };
  }
  return {
    titleKey: "voucher.kind.fuel.title",
    chosenKey: "voucher.kind.fuel.chosen",
    params: {
      brand: t("voucher.brand.fuel"),
      cents: new Intl.NumberFormat(intl).format(option.centsPerLitre),
    },
  };
}
