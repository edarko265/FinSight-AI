"use client";

import { PendingLabel } from "@/components/ui/Spinner";

/**
 * Text button for one row action. While `pending` it is `aria-disabled` (focus stays put) and
 * ignores clicks; `active` marks the button whose action is running so only it shows the label.
 */
export function RowButton({
  onClick,
  pending,
  active = true,
  pendingLabel,
  className,
  children,
}: {
  onClick: () => void;
  pending: boolean;
  active?: boolean;
  pendingLabel: string;
  className: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <button
      type="button"
      aria-disabled={pending}
      onClick={() => {
        if (!pending) onClick();
      }}
      className={`${className} ${pending ? "opacity-60" : ""}`}
    >
      {pending && active ? <PendingLabel>{pendingLabel}</PendingLabel> : children}
    </button>
  );
}
