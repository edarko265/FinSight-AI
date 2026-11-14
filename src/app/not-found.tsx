"use client";

import Link from "next/link";

import { usePreferences } from "@/components/providers/PreferencesProvider";
import { Logo } from "@/components/ui/icons";

/** Shown for an address that does not exist. */
export default function NotFound(): React.JSX.Element {
  const { t } = usePreferences();
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 px-5 py-10 text-center">
      <Logo className="size-14" />
      <h1 className="text-xl font-semibold tracking-tight">{t("notFound.title")}</h1>
      <p className="text-sm text-muted">{t("notFound.body")}</p>
      <Link
        href="/"
        className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary"
      >
        {t("error.home")}
      </Link>
    </main>
  );
}
