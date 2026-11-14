"use client";

import { useCallback, useEffect, useState } from "react";

import { api } from "@/lib/api-client";

export type NotificationState = "unsupported" | "blocked" | "off" | "on";

const ASKED_KEY = "fs_notify_asked";

function supported(): boolean {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

function decodeKey(base64: string): ArrayBuffer {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = window.atob(padded);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes.buffer;
}

/** Whether the first-use question has been shown on this device. */
export function wasAsked(): boolean {
  try {
    return window.localStorage.getItem(ASKED_KEY) === "1";
  } catch {
    return true;
  }
}

export function markAsked(): void {
  try {
    window.localStorage.setItem(ASKED_KEY, "1");
  } catch {
    // Without storage the question may be shown again next visit; nothing else depends on it.
  }
}

/**
 * Device notifications for this browser: whether they are on, and switching
 * them on or off. Switching on asks the device for permission, registers the
 * service worker and stores the subscription (sealed) with the customer.
 */
export function useNotifications() {
  const [state, setState] = useState<NotificationState>("off");

  const refresh = useCallback(async () => {
    if (!supported()) return setState("unsupported");
    if (Notification.permission === "denied") return setState("blocked");
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    setState(Notification.permission === "granted" && subscription ? "on" : "off");
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read the browser's notification state once on mount
    void refresh();
  }, [refresh]);

  /** Returns true when notifications ended up switched on. */
  const enable = useCallback(async (): Promise<boolean> => {
    if (!supported()) return false;
    markAsked();
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      if ((await Notification.requestPermission()) !== "granted") {
        await refresh();
        return false;
      }
      const { publicKey } = await api<{ publicKey: string | null }>("/api/push");
      if (!publicKey) return false;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeKey(publicKey),
        }));
      await api("/api/push", { method: "POST", json: subscription.toJSON() });
      setState("on");
      return true;
    } catch {
      await refresh();
      return false;
    }
  }, [refresh]);

  const disable = useCallback(async (): Promise<void> => {
    markAsked();
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await api("/api/push", {
          method: "DELETE",
          json: { endpoint: subscription.endpoint },
        }).catch(() => undefined);
        await subscription.unsubscribe();
      }
    } finally {
      await refresh();
    }
  }, [refresh]);

  return { state, enable, disable };
}

/** Shows the unread count on the app's home-screen icon, where the device supports it. */
export function setAppBadge(count: number): void {
  const nav = navigator as Navigator & {
    setAppBadge?: (count: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  };
  if (count > 0) void nav.setAppBadge?.(count).catch(() => undefined);
  else void nav.clearAppBadge?.().catch(() => undefined);
}

const LAST_UNREAD_KEY = "fs_last_unread";

/**
 * Raises a notification on this device when there are more unread insights
 * than last time. Done by the app itself, so the customer's figures never
 * pass through a push service.
 */
export async function notifyNewInsights(
  unread: number,
  title: string,
  body: string,
): Promise<void> {
  let previous = 0;
  try {
    previous = Number(window.localStorage.getItem(LAST_UNREAD_KEY) ?? "0");
    window.localStorage.setItem(LAST_UNREAD_KEY, String(unread));
  } catch {
    return;
  }
  if (unread <= previous || !supported() || Notification.permission !== "granted") return;
  const registration = await navigator.serviceWorker.getRegistration();
  await registration
    ?.showNotification(title, {
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: "insights",
      data: { url: "/insights" },
    })
    .catch(() => undefined);
}
