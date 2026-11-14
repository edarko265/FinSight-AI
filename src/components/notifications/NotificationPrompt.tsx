"use client";

import { useEffect, useState } from "react";

import { markAsked, useNotifications, wasAsked } from "@/components/notifications/useNotifications";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { Wizard } from "@/components/ui/Wizard";

/**
 * Asked once, the first time the app is used on a device: would you like
 * notifications? Explains what they are for before the device's own
 * permission question appears. Can be changed later in Settings.
 */
export function NotificationPrompt(): React.JSX.Element | null {
  const { t } = usePreferences();
  const toast = useToast();
  const { state, enable } = useNotifications();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (state !== "off" || wasAsked()) return;
    // Let the first screen settle before asking.
    const timer = window.setTimeout(() => setOpen(true), 2500);
    return () => window.clearTimeout(timer);
  }, [state]);

  if (!open) return null;
  return (
    <Wizard
      open
      title={t("notify.prompt.title")}
      finishLabel={t("notify.prompt.allow")}
      onClose={() => setOpen(false)}
      onDismiss={(reason) => {
        // Only an explicit decline is remembered; a tab tap, Escape or backdrop tap asks again next session.
        if (reason === "close") markAsked();
        setOpen(false);
      }}
      onFinish={async () => {
        const on = await enable();
        setOpen(false);
        toast.notify(on ? "notify.on" : "notify.off");
      }}
      steps={[
        {
          title: t("notify.prompt.step"),
          hint: t("notify.prompt.hint"),
          valid: true,
          content: (
            <ul className="flex flex-col gap-2.5 text-sm">
              {(["notify.prompt.point.private", "notify.prompt.point.next"] as const).map((key) => (
                <li key={key} className="flex gap-2.5">
                  <span
                    className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent"
                    aria-hidden="true"
                  />
                  <span>{t(key)}</span>
                </li>
              ))}
            </ul>
          ),
        },
      ]}
    />
  );
}
