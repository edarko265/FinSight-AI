"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";

import { dockReducer, initialDockState, type DockMode } from "@/components/chat/dock-state";

export type { DockMode };

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
  /** A reply arrived while the sheet was closed. */
  unread: boolean;
  /** The coach is working on a reply. */
  pending: boolean;
  /** Messages in the current conversation. */
  count: number;
  /** Key of the current conversation; changes on restart. */
  conversation: number;
  /** Opens the floating coach, optionally asking a question or starting to listen or call. */
  open: (what?: Omit<DockRequest, "id">) => void;
  close: () => void;
  setMode: (mode: DockMode) => void;
  /** Called by the chat with its pending state and message count. */
  reportStatus: (status: { pending: boolean; count: number }) => void;
  /** Starts a fresh conversation. */
  restart: () => void;
}

const ChatDockContext = createContext<ChatDockValue>({
  mode: "closed",
  mounted: false,
  request: null,
  unread: false,
  pending: false,
  count: 0,
  conversation: 0,
  open: () => undefined,
  close: () => undefined,
  setMode: () => undefined,
  reportStatus: () => undefined,
  restart: () => undefined,
});

/** Holds the state of the floating coach for the whole signed-in area. */
export function ChatDockProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [state, dispatch] = useReducer(dockReducer, initialDockState);
  const [request, setRequest] = useState<DockRequest | null>(null);
  const nextId = useRef(1);

  const open = useCallback((what?: Omit<DockRequest, "id">) => {
    dispatch({ type: "open" });
    if (what) {
      setRequest({ id: nextId.current, ...what });
      nextId.current += 1;
    }
  }, []);
  const close = useCallback(() => dispatch({ type: "close" }), []);
  const setMode = useCallback((mode: DockMode) => dispatch({ type: "setMode", mode }), []);
  const reportStatus = useCallback(
    (status: { pending: boolean; count: number }) => dispatch({ type: "status", ...status }),
    [],
  );
  const restart = useCallback(() => {
    setRequest(null);
    dispatch({ type: "restart" });
  }, []);

  const { mode, mounted, unread, pending, count, conversation } = state;
  const value = useMemo(
    () => ({
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
    }),
    [
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
    ],
  );
  return <ChatDockContext.Provider value={value}>{children}</ChatDockContext.Provider>;
}

export const useChatDock = (): ChatDockValue => useContext(ChatDockContext);
