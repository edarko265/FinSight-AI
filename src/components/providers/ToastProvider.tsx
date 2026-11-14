"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

import { usePreferences } from "@/components/providers/PreferencesProvider";
import { CloseIcon } from "@/components/ui/icons";
import type { MessageKey, MessageParams } from "@/lib/i18n/translate";

type Tone = "success" | "error";
interface Toast {
  id: number;
  text: string;
  tone: Tone;
}

interface ToastValue {
  /** Confirms that something was done, for example saved or deleted. */
  notify: (key: MessageKey, params?: MessageParams) => void;
  /** Says that something failed. */
  fail: (key?: MessageKey) => void;
}

const ToastContext = createContext<ToastValue>({ notify: () => undefined, fail: () => undefined });
const LIFETIME_MS = 3500;

/** Short confirmations shown at the bottom of the screen and read out by screen readers. */
export function ToastProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { t } = usePreferences();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (text: string, tone: Tone) => {
      const id = nextId.current;
      nextId.current += 1;
      setToasts((current) => [...current.slice(-2), { id, text, tone }]);
      window.setTimeout(() => dismiss(id), LIFETIME_MS);
    },
    [dismiss],
  );

  const value = useMemo<ToastValue>(
    () => ({
      notify: (key, params) => push(t(key, params), "success"),
      fail: (key = "toast.error") => push(t(key), "error"),
    }),
    [push, t],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto flex w-full max-w-sm items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm font-medium shadow-lg ${
              toast.tone === "success" ? "bg-brand text-on-brand" : "bg-warning text-surface"
            }`}
          >
            <span>{toast.text}</span>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label={t("toast.dismiss")}
              className="-m-1 shrink-0 rounded-full p-1 opacity-80"
            >
              <CloseIcon className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastValue {
  return useContext(ToastContext);
}
