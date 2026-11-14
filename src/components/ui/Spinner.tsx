const SIZES = { sm: "h-4 w-4", md: "h-5 w-5" } as const;

/** Small inline spinner that takes the text colour. Decorative: pair it with a text label. */
export function Spinner({
  size = "sm",
  className = "",
}: {
  size?: keyof typeof SIZES;
  className?: string;
}): React.JSX.Element {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className={`${SIZES[size]} shrink-0 animate-spin ${className}`}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** Button contents while an action runs: spinner plus text such as "Saving…". */
export function PendingLabel({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <span className="inline-flex items-center justify-center gap-2">
      <Spinner />
      <span>{children}</span>
    </span>
  );
}
