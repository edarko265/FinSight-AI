"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef } from "react";
import type { RefObject } from "react";

import { isTopmostSheet, popSheet, pushSheet, type SheetStack } from "@/components/ui/sheet-stack";

/**
 * Sheets that leave the bottom tab bar usable. The sheet and its dimming stop at the top edge
 * of the tab bar (0 high from md up), so they are not modal: nothing is made inert.
 */

/** Position of a bottom sheet: pinned above the tab bar, centred in the window from md up (give it a height, or `md:h-fit`). */
export const TAB_SHEET_POSITION =
  "fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+var(--bottom-nav-h))] z-50 m-0 mx-auto w-full max-w-md rounded-t-3xl md:inset-y-0 md:my-auto md:max-w-lg md:rounded-3xl";
/** Largest height that still fits between the status bar and the tab bar. */
export const TAB_SHEET_MAX_H =
  "max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-var(--bottom-nav-h)-0.5rem)]";

/** Why a sheet is being closed; callers use it to tell a decision from a mere dismissal. */
export type DismissReason = "navigation" | "escape" | "backdrop" | "close";

let openSheets: SheetStack = [];

/** Closes the surface when the page changes, for example when a tab is tapped. */
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

/** Calls `onEscape` for Escape while this surface is the topmost open one, wherever focus is. */
export function useEscapeClose(active: boolean, onEscape: () => void): void {
  const id = useId();
  const handler = useRef(onEscape);
  useEffect(() => {
    handler.current = onEscape;
  });
  useEffect(() => {
    if (!active) return;
    openSheets = pushSheet(openSheets, id);
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (!isTopmostSheet(openSheets, id)) return;
      // Claimed here so the dock's window listener, which runs later, leaves it alone.
      event.preventDefault();
      handler.current();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      openSheets = popSheet(openSheets, id);
    };
  }, [active, id]);
}

/**
 * Opens and closes a <dialog> for an `open` flag. Non-modal (`show`) by default; `modal` uses
 * `showModal` for flows that must be completed. Non-modal sheets also get Escape, focus return
 * and close-on-navigation (focus then stays where the tap put it). Returns `dismiss`, which
 * calls `onDismiss` with the reason; use it for the backdrop too.
 */
export function useSheetDialog(
  ref: RefObject<HTMLDialogElement | null>,
  open: boolean,
  onDismiss: (reason: DismissReason) => void,
  modal = false,
): (reason: DismissReason) => void {
  const opener = useRef<HTMLElement | null>(null);
  const keepFocus = useRef(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      keepFocus.current = false;
      opener.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      if (modal) dialog.showModal();
      else dialog.show();
    }
    if (!open && dialog.open) {
      dialog.close();
      if (!modal && !keepFocus.current) opener.current?.focus();
    }
  }, [ref, open, modal]);

  const dismiss = useCallback(
    (reason: DismissReason): void => {
      if (reason === "navigation") keepFocus.current = true;
      onDismiss(reason);
    },
    [onDismiss],
  );

  useCloseOnNavigation(open && !modal, () => dismiss("navigation"));
  useEscapeClose(open && !modal, () => dismiss("escape"));
  return dismiss;
}

/** Dimming behind a non-modal sheet; stops above the tab bar (and right of the side rail) and closes the sheet when tapped. */
export function TabSheetBackdrop({ onClick }: { onClick: () => void }): React.JSX.Element {
  return (
    <div
      aria-hidden="true"
      onClick={onClick}
      className="fixed inset-x-0 top-0 bottom-[calc(env(safe-area-inset-bottom)+var(--bottom-nav-h))] z-40 bg-black/50 md:left-20 lg:left-60"
    />
  );
}
