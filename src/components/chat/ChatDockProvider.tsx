"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

export type DockMode = "closed" | "half" | "full";

export interface DockRequest {
  id: number;
  question?: string;
  start?: "listen" | "call";
}

interface ChatDockValue {
  mode: DockMode;
  /** True once the coach has been opened; from then on it stays mounted so the conversation survives. */
  mounted: boolean;
  request: DockRequest | null;
  /** Opens the floating coach, optionally asking a question or starting to listen or call. */
  open: (what?: Omit<DockRequest, "id">) => void;
  close: () => void;
  setMode: (mode: DockMode) => void;
}

const ChatDockContext = createContext<ChatDockValue>({
  mode: "closed",
  mounted: false,
  request: null,
  open: () => undefined,
  close: () => undefined,
  setMode: () => undefined,
});

/** Holds the state of the floating coach for the whole signed-in area. */
export function ChatDockProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [mode, setMode] = useState<DockMode>("closed");
  const [mounted, setMounted] = useState(false);
  const [request, setRequest] = useState<DockRequest | null>(null);
  const nextId = useRef(1);

  const open = useCallback((what?: Omit<DockRequest, "id">) => {
    setMounted(true);
    setMode((current) => (current === "full" ? "full" : "half"));
    if (what) {
      setRequest({ id: nextId.current, ...what });
      nextId.current += 1;
    }
  }, []);
  const close = useCallback(() => setMode("closed"), []);

  const value = useMemo(
    () => ({ mode, mounted, request, open, close, setMode }),
    [mode, mounted, request, open, close],
  );
  return <ChatDockContext.Provider value={value}>{children}</ChatDockContext.Provider>;
}

export const useChatDock = (): ChatDockValue => useContext(ChatDockContext);
