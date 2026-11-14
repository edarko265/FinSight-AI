"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";

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
  "inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+3.5rem)] h-[50dvh] rounded-t-2xl border-t border-border shadow-2xl md:inset-x-auto md:right-6 md:bottom-6 md:h-[min(36rem,70dvh)] md:w-96 md:rounded-2xl md:border";
const FULL = "inset-0 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]";
/** Closed sheets stay mounted but slide out of view and out of the tab order. */
const CLOSED = "invisible translate-y-full pointer-events-none";
const SWIPE_PX = 60;
const HEADER_BUTTON = "flex size-11 items-center justify-center rounded-full text-muted";

/**
 * The coach as one floating button on every page: it opens the coach as a half-screen
 * sheet, which can be expanded to full screen. Once opened it stays mounted, so closing the
 * popup or moving between pages does not end the conversation.
 */
export function ChatDock(): React.JSX.Element | null {
  const { t } = usePreferences();
  const { me } = useOverview();
  const pathname = usePathname();
  const { mode, mounted, request, unread, pending, conversation, open, close, setMode, reportStatus, restart } =
    useChatDock();
  const swipeStart = useRef<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  const hidden = HIDDEN_ON.some((path) => pathname.startsWith(path));
  const shown = mode !== "closed" && !hidden;

  useEffect(() => {
    if (shown && !wasOpen.current) panelRef.current?.focus();
    if (!shown && wasOpen.current) buttonRef.current?.focus();
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
    swipeStart.current = (event.target as HTMLElement).closest("button") ? null : event.clientY;
  };
  const onPointerUp = (event: ReactPointerEvent): void => {
    if (swipeStart.current === null) return;
    const dy = event.clientY - swipeStart.current;
    swipeStart.current = null;
    if (dy <= -SWIPE_PX && mode === "half") setMode("full");
    else if (dy >= SWIPE_PX) {
      if (mode === "full") setMode("half");
      else close();
    }
  };

  // In full mode the dialog is modal, so Tab must not leave it.
  const trapTab = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== "Tab" || mode !== "full") return;
    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])',
      ),
    );
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === event.currentTarget)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  if (hidden) return null;
  const full = mode === "full";
  const canCall = Boolean(me?.voiceAgentEnabled && me.aiConsent);
  const fabLabel = t(unread ? "dock.unread" : "dock.open");

  return (
    <>
      {mode === "closed" ? (
        <div className="fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-30 md:right-6 md:bottom-6">
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
        <div aria-hidden="true" onClick={close} className="fixed inset-0 z-40 bg-black/30 md:hidden" />
      ) : null}

      {mounted ? (
        <div
          ref={panelRef}
          role="dialog"
          aria-modal={full}
          aria-label={t("nav.chat")}
          tabIndex={-1}
          onKeyDown={trapTab}
          className={`fixed z-40 flex flex-col overflow-hidden bg-background outline-none transition-transform duration-300 motion-reduce:transition-none ${
            shown ? "" : CLOSED
          } ${full ? FULL : HALF}`}
        >
          <div
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            className="shrink-0 touch-none border-b border-border bg-surface"
          >
            <div aria-hidden="true" className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-border" />
            <div className="flex items-center justify-between gap-2 px-4 pb-1">
              <h2 className="text-sm font-semibold">{t("nav.chat")}</h2>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={restart}
                  aria-label={t("dock.new")}
                  title={t("dock.new")}
                  className={HEADER_BUTTON}
                >
                  <NewChatIcon className="size-5" />
                </button>
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
