import type { VoucherKind, VoucherTierId } from "@/lib/contracts/rewards";

/**
 * Tier accents, defined once. Mid-tone colours that keep at least 3:1 against both the light and
 * the dark surface; text on the cards always uses the theme foreground, never these.
 */
export const TIER_COLOUR: Record<VoucherTierId, string> = {
  bronze: "#c27a3a",
  silver: "#7a8794",
  gold: "#b8860b",
  platinum: "#3f8fb0",
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
      {kind === "coffee" ? (
        <>
          <path
            d="M11 18h24v10a10 10 0 0 1-10 10h-4a10 10 0 0 1-10-10z"
            fill="var(--accent-soft)"
          />
          <path d="M35 21h3a4 4 0 0 1 0 8h-4" />
          <path d="M18 8c-2 2 2 3 0 6M25 8c-2 2 2 3 0 6" />
        </>
      ) : null}
      {kind === "groceries" ? (
        <>
          <path d="M10 18h28l-2 22H12z" fill="var(--accent-soft)" />
          <path d="M18 18v-3a6 6 0 0 1 12 0v3" />
          <circle cx="24" cy="29" r="4" />
        </>
      ) : null}
      {kind === "cinema" ? (
        <>
          <path
            d="M6 16h36v5a3 3 0 0 0 0 6v5H6v-5a3 3 0 0 0 0-6z"
            fill="var(--accent-soft)"
            transform="translate(0 2)"
          />
          <path d="M30 18v16" strokeDasharray="2 3" />
          <path d="M16 23l5 3-5 3z" fill="currentColor" />
        </>
      ) : null}
      {kind === "books" ? (
        <>
          <rect x="8" y="30" width="32" height="8" rx="1.5" fill="var(--accent-soft)" />
          <rect x="11" y="21" width="28" height="9" rx="1.5" fill="var(--accent-soft)" />
          <path d="M14 12l4-1 5 10-4 1z" fill="var(--accent-soft)" />
          <path d="M15 34h6M18 25h6" />
        </>
      ) : null}
    </svg>
  );
}
