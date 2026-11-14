"use client"; // Error boundaries must be Client Components

import Link from "next/link";
import { useEffect } from "react";

import { usePreferences } from "@/components/providers/PreferencesProvider";
import { Logo } from "@/components/ui/icons";

/** Shown when a page fails to render. Says so plainly and offers a way forward; no technical detail. */
export default function PageError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}): React.JSX.Element {
  const { t } = usePreferences();
  useEffect(() => {
    console.error("page error:", error instanceof Error ? error.name : "error");
  }, [error]);
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 px-5 py-10 text-center">
      <Logo className="size-14" />
      <h1 className="text-xl font-semibold tracking-tight">{t("error.title")}</h1>
      <p className="text-sm text-muted">{t("error.body")}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => retry()}
          className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary"
        >
          {t("admin.retry")}
        </button>
        <Link
          href="/"
          className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold"
        >
          {t("error.home")}
        </Link>
      </div>
    </main>
  );
}
