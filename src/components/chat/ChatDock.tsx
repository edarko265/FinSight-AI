"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { useChatDock } from "@/components/chat/ChatDockProvider";
import { PinnableChat } from "@/components/chat/PinnableChat";
import { useOverview } from "@/components/providers/OverviewProvider";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import {
  ChatIcon,
  CloseIcon,
  CollapseIcon,
  ExpandIcon,
  MicIcon,
  PhoneIcon,
} from "@/components/ui/icons";

/** Pages that already are the coach, or take over the whole screen. */
const HIDDEN_ON = ["/chat", "/story"];

const HALF =
  "inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+3.5rem)] h-[50dvh] rounded-t-2xl border-t border-border shadow-2xl md:inset-x-auto md:right-6 md:bottom-6 md:h-[min(36rem,70dvh)] md:w-96 md:rounded-2xl md:border";
const FULL = "inset-0 pt-[env(safe-area-inset-top)]";

/**
 * The coach as floating buttons on every page: the chat button opens it as a half-screen
 * popup, which can be expanded to full screen. Once opened it stays mounted, so closing the
 * popup or moving between pages does not end the conversation.
 */
export function ChatDock(): React.JSX.Element | null {
  const { t } = usePreferences();
  const { me } = useOverview();
  const pathname = usePathname();
  const { mode, mounted, request, open, close, setMode } = useChatDock();
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

  if (hidden) return null;
  const full = mode === "full";

  return (
    <>
      {mode === "closed" ? (
        <div className="fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-30 flex flex-col items-end gap-3 md:right-6 md:bottom-6">
          {me?.voiceAgentEnabled && me.aiConsent ? (
            <button
              type="button"
              onClick={() => open({ start: "call" })}
              aria-label={t("dock.call")}
              title={t("dock.call")}
              className="flex size-11 items-center justify-center rounded-full border border-border bg-surface text-accent shadow-lg"
            >
              <PhoneIcon className="size-5" />
            </button>
          ) : null}
          {me?.voiceEnabled ? (
            <button
              type="button"
              onClick={() => open({ start: "listen" })}
              aria-label={t("dock.listen")}
              title={t("dock.listen")}
              className="flex size-11 items-center justify-center rounded-full border border-border bg-surface text-accent shadow-lg"
            >
              <MicIcon className="size-5" />
            </button>
          ) : null}
          <button
            ref={buttonRef}
            type="button"
            onClick={() => open()}
            aria-label={t("dock.open")}
            title={t("dock.open")}
            className="flex size-14 items-center justify-center rounded-full bg-primary text-on-primary shadow-lg"
          >
            <ChatIcon className="size-6" />
          </button>
        </div>
      ) : null}

      {mounted ? (
        <div
          ref={panelRef}
          role="dialog"
          aria-modal={full}
          aria-label={t("nav.chat")}
          tabIndex={-1}
          hidden={!shown}
          className={`fixed z-40 flex-col overflow-hidden bg-background outline-none ${
            shown ? "flex" : ""
          } ${full ? FULL : HALF}`}
        >
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-surface px-4 py-2">
            <h2 className="text-sm font-semibold">{t("nav.chat")}</h2>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setMode(full ? "half" : "full")}
                aria-label={t(full ? "dock.collapse" : "dock.expand")}
                title={t(full ? "dock.collapse" : "dock.expand")}
                className="flex size-9 items-center justify-center rounded-full text-muted"
              >
                {full ? <CollapseIcon className="size-5" /> : <ExpandIcon className="size-5" />}
              </button>
              <button
                type="button"
                onClick={close}
                aria-label={t("dock.close")}
                title={t("dock.close")}
                className="flex size-9 items-center justify-center rounded-full text-muted"
              >
                <CloseIcon className="size-5" />
              </button>
            </div>
          </div>
          <div className={`flex min-h-0 flex-1 flex-col ${full ? "mx-auto w-full max-w-3xl" : ""}`}>
            <PinnableChat request={request ?? undefined} />
          </div>
        </div>
      ) : null}
    </>
  );
}
