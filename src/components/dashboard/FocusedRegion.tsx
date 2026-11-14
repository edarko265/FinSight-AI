"use client";

import { useEffect, useRef } from "react";

/**
 * Wrapper that takes focus when it mounts with `focus` set. After a retry the error, and the
 * button that was pressed, are gone; this keeps keyboard and screen reader focus on the
 * loading placeholder instead of dropping it to the page.
 */
export function FocusedRegion({
  focus,
  className = "",
  children,
}: {
  focus: boolean;
  className?: string;
  children: React.ReactNode;
}): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focus) ref.current?.focus();
  }, [focus]);
  return (
    <div ref={ref} tabIndex={-1} className={`outline-none ${className}`}>
      {children}
    </div>
  );
}
