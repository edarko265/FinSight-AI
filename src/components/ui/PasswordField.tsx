"use client";

import { useState } from "react";

import { usePreferences } from "@/components/providers/PreferencesProvider";
import { EyeIcon, EyeOffIcon } from "@/components/ui/icons";

/** A password field with an eye button to show what was typed. */
export function PasswordField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}): React.JSX.Element {
  const { t } = usePreferences();
  const [shown, setShown] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={shown ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete="current-password"
          autoFocus
          className="w-full rounded-xl border border-border bg-surface py-3 pr-12 pl-4 text-base outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
        <button
          type="button"
          onClick={() => setShown((current) => !current)}
          aria-label={t(shown ? "login.hidePassword" : "login.showPassword")}
          aria-pressed={shown}
          className="absolute inset-y-0 right-0 flex items-center px-3.5 text-muted"
        >
          {shown ? <EyeOffIcon className="size-5" /> : <EyeIcon className="size-5" />}
        </button>
      </div>
    </div>
  );
}
