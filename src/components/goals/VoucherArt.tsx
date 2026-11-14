import type { VoucherKind, VoucherTierId } from "@/lib/contracts/rewards";

/**
 * Tier accents, defined once. Mid-tone colours that keep at least 3:1 against both the light and
 * the dark surface; text on the cards always uses the theme foreground, never these.
 */
export const TIER_COLOUR: Record<VoucherTierId, string> = {
  bronze: "#c27a3a",
  silver: "#7a8794",
  gold: "#b8860b",
};

/** Flat illustration for a voucher kind, drawn in the theme colours. Decorative only. */
export function VoucherArt({
  kind,
  className,
}: {
  kind: VoucherKind;
  className?: string;
}): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {kind === "grocery" ? (
        <>
          <path d="M9 19h30l-3 21H12z" fill="var(--accent-soft)" />
          <path d="M16 19l5-9M32 19l-5-9" />
          <path d="M20 10c3-4 7-4 9 0-3 2-7 2-9 0z" fill="currentColor" />
          <circle cx="19" cy="29" r="3.5" />
          <path d="M27 26h6M27 32h6" />
        </>
      ) : null}
      {kind === "fuel" ? (
        <>
          <rect x="10" y="8" width="18" height="32" rx="2" fill="var(--accent-soft)" />
          <path d="M14 14h10v8H14z" />
          <path d="M7 40h24" />
          <path d="M28 18h4a3 3 0 0 1 3 3v11a3 3 0 0 0 6 0V16l-4-4" />
        </>
      ) : null}
    </svg>
  );
}
