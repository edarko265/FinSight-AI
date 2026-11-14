"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import type { KeyboardEvent, RefObject } from "react";

/**
 * Sheets that leave the bottom tab bar usable. The sheet and its dimming stop at the top edge
 * of the tab bar (0 high from md up), so they are not modal: nothing is made inert.
 */

/** Position of a bottom sheet: pinned above the tab bar, centred in the window from md up. */
export const TAB_SHEET_POSITION =
  "fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+var(--bottom-nav-h))] z-50 m-0 mx-auto w-full max-w-md rounded-t-3xl md:inset-y-0 md:my-auto md:h-fit md:max-w-lg md:rounded-3xl";
/** Largest height that still fits between the status bar and the tab bar. */
export const TAB_SHEET_MAX_H =
  "max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-var(--bottom-nav-h)-0.5rem)]";

/** Closes the sheet when the page changes, for example when a tab is tapped. */
export function useCloseOnNavigation(active: boolean, onClose: () => void): void {
  const pathname = usePathname();
  const last = useRef(pathname);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });
  useEffect(() => {
    if (last.current === pathname) return;
    last.current = pathname;
    if (active) close.current();
  }, [pathname, active]);
}

/**
 * Opens and closes a <dialog> for an `open` flag. Non-modal (`show`) by default; `modal` uses
 * `showModal` for flows that must be completed. Non-modal sheets also get Escape, focus return
 * and close-on-navigation. Returns a key handler to put on the dialog.
 */
export function useSheetDialog(
  ref: RefObject<HTMLDialogElement | null>,
  open: boolean,
  onDismiss: () => void,
  modal = false,
): (event: KeyboardEvent<HTMLDialogElement>) => void {
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      opener.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      if (modal) dialog.showModal();
      else dialog.show();
    }
    if (!open && dialog.open) {
      dialog.close();
      if (!modal) opener.current?.focus();
    }
  }, [ref, open, modal]);

  useCloseOnNavigation(open && !modal, onDismiss);

  return (event) => {
    if (modal || event.key !== "Escape") return;
    event.stopPropagation();
    onDismiss();
  };
}

/** Dimming behind a non-modal sheet; stops above the tab bar and closes the sheet when tapped. */
export function TabSheetBackdrop({ onClick }: { onClick: () => void }): React.JSX.Element {
  return (
    <div
      aria-hidden="true"
      onClick={onClick}
      className="fixed inset-x-0 top-0 bottom-[calc(env(safe-area-inset-bottom)+var(--bottom-nav-h))] z-40 bg-black/50 md:bottom-0"
    />
  );
}
