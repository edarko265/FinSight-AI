"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

import { callPossible } from "@/components/chat/call-possible";
import { useChatDock } from "@/components/chat/ChatDockProvider";
import { PinnableChat } from "@/components/chat/PinnableChat";
import { useOverview } from "@/components/providers/OverviewProvider";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import {
  ChatIcon,
  CloseIcon,
  CollapseIcon,
  ExpandIcon,
  NewChatIcon,
  PhoneIcon,
} from "@/components/ui/icons";

/** Pages that already are the coach, or take over the whole screen. */
const HIDDEN_ON = ["/chat", "/story"];

const HALF =
  "inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+var(--bottom-nav-h))] h-[50dvh] rounded-t-2xl border-t border-border shadow-2xl md:inset-x-auto md:right-6 md:bottom-6 md:h-[min(36rem,70dvh)] md:w-96 md:rounded-2xl md:border";
/** Full mode stops above the tab bar on phones; at md the tab bar is hidden, so it reaches the edge. */
const FULL =
  "inset-x-0 top-0 bottom-[calc(env(safe-area-inset-bottom)+var(--bottom-nav-h))] pt-[var(--safe-top)] md:bottom-0 md:pt-0";
/** Closed sheets stay mounted but slide out of view and out of the tab order. */
const CLOSED = "invisible translate-y-full pointer-events-none";
const SWIPE_PX = 60;
const HEADER_BUTTON = "flex size-11 items-center justify-center rounded-full text-muted";

/**
 * Drawn inside the app frame and placed against it, not against the browser window: the
 * frame is what follows the visible screen on a phone, so the button and the sheet sit just
 * above the tab bar wherever the phone puts it.
 *
 * The coach as one floating button on every page: it opens the coach as a half-screen
 * sheet, which can be expanded to full screen. Once opened it stays mounted, so closing the
 * popup or moving between pages does not end the conversation.
 */
export function ChatDock(): React.JSX.Element | null {
  const { t } = usePreferences();
  const { me } = useOverview();
  const pathname = usePathname();
  const {
    mode,
    mounted,
    request,
    unread,
    pending,
    count,
    conversation,
    open,
    close,
    setMode,
    reportStatus,
    restart,
  } = useChatDock();
  const swipeStart = useRef<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  const lastPath = useRef(pathname);
  const navigated = useRef(false);

  // Moving to another page (e.g. with a tab) closes the sheet so the page is visible.
  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    navigated.current = mode !== "closed";
    close();
  }, [pathname, mode, close]);

  const hidden = HIDDEN_ON.some((path) => pathname.startsWith(path));
  const shown = mode !== "closed" && !hidden;

  useEffect(() => {
    if (shown && !wasOpen.current) panelRef.current?.focus();
    // After navigating, focus stays where the user put it (the tab link).
    if (!shown && wasOpen.current && !navigated.current) buttonRef.current?.focus();
    if (shown) navigated.current = false;
    wasOpen.current = shown;
  }, [shown]);

  useEffect(() => {
    if (!shown) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (mode === "full") setMode("half");
      else close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shown, mode, setMode, close]);

  const onPointerDown = (event: ReactPointerEvent): void => {
    if ((event.target as HTMLElement).closest("button")) {
      swipeStart.current = null;
      return;
    }
    swipeStart.current = event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerCancel = (event: ReactPointerEvent): void => {
    swipeStart.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };
  const onPointerUp = (event: ReactPointerEvent): void => {
    if (swipeStart.current === null) return;
    const dy = event.clientY - swipeStart.current;
    onPointerCancel(event);
    if (dy <= -SWIPE_PX && mode === "half") setMode("full");
    else if (dy >= SWIPE_PX) {
      if (mode === "full") setMode("half");
      else close();
    }
  };

  if (hidden) return null;
  const full = mode === "full";
  const canCall = callPossible(me);
  const fabLabel = t(unread ? "dock.unread" : "dock.open");

  return (
    <>
      {mode === "closed" ? (
        <div className="absolute right-4 bottom-[calc(env(safe-area-inset-bottom)+var(--bottom-nav-h)+1rem)] z-30 md:right-6 md:bottom-6">
          <button
            ref={buttonRef}
            type="button"
            onClick={() => open()}
            aria-label={fabLabel}
            title={fabLabel}
            className="relative flex size-14 items-center justify-center rounded-full bg-primary text-on-primary shadow-lg"
          >
            {pending ? (
              <span
                aria-hidden="true"
                className="absolute inset-0 animate-ping rounded-full ring-2 ring-primary motion-reduce:animate-none"
              />
            ) : null}
            <ChatIcon className="size-6" />
            {unread ? (
              <span
                aria-hidden="true"
                className="absolute top-0 right-0 size-3.5 rounded-full border-2 border-background bg-accent"
              />
            ) : null}
          </button>
        </div>
      ) : null}

      {shown && !full ? (
        <div
          aria-hidden="true"
          onClick={close}
          className="absolute inset-x-0 top-0 bottom-[calc(env(safe-area-inset-bottom)+var(--bottom-nav-h))] z-40 bg-black/30 md:hidden"
        />
      ) : null}

      {mounted ? (
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="false"
          aria-label={t("nav.chat")}
          tabIndex={-1}
          className={`absolute z-40 flex flex-col overflow-hidden bg-background outline-none transition-[transform,visibility] duration-300 motion-reduce:transition-none ${
            shown ? "" : CLOSED
          } ${full ? FULL : HALF}`}
        >
          <div
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            className="shrink-0 touch-none border-b border-border bg-surface"
          >
            <div aria-hidden="true" className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-border" />
            <div className="flex items-center justify-between gap-2 px-4 pb-1">
              <h2 className="text-sm font-semibold">{t("nav.chat")}</h2>
              <div className="flex items-center gap-1">
                {count > 0 ? (
                  <button
                    type="button"
                    onClick={restart}
                    aria-label={t("dock.new")}
                    title={t("dock.new")}
                    className={HEADER_BUTTON}
                  >
                    <NewChatIcon className="size-5" />
                  </button>
                ) : null}
                {canCall ? (
                  <button
                    type="button"
                    onClick={() => open({ start: "call" })}
                    aria-label={t("dock.call")}
                    title={t("dock.call")}
                    className={`${HEADER_BUTTON} text-accent`}
                  >
                    <PhoneIcon className="size-5" />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setMode(full ? "half" : "full")}
                  aria-label={t(full ? "dock.collapse" : "dock.expand")}
                  title={t(full ? "dock.collapse" : "dock.expand")}
                  className={HEADER_BUTTON}
                >
                  {full ? <CollapseIcon className="size-5" /> : <ExpandIcon className="size-5" />}
                </button>
                <button
                  type="button"
                  onClick={close}
                  aria-label={t("dock.close")}
                  title={t("dock.close")}
                  className={HEADER_BUTTON}
                >
                  <CloseIcon className="size-5" />
                </button>
              </div>
            </div>
          </div>
          <div className={`flex min-h-0 flex-1 flex-col ${full ? "mx-auto w-full max-w-3xl" : ""}`}>
            <PinnableChat
              key={conversation}
              request={request ?? undefined}
              hideCallLink
              onStatus={reportStatus}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
