"use client";

import { useState } from "react";

import { adminSubmit } from "@/components/admin/admin-api";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { PasswordField } from "@/components/ui/PasswordField";
import { Wizard } from "@/components/ui/Wizard";
import type { MessageKey } from "@/lib/i18n/translate";

/** A member of staff changes their own password, proving they know the current one. */
export function ChangePassword({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}): React.JSX.Element {
  const { t } = usePreferences();
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState<MessageKey | null>(null);

  function close(): void {
    setCurrent("");
    setNext("");
    setError(null);
    onClose();
  }

  return (
    <Wizard
      open={open}
      title={t("admin.password.change")}
      finishLabel={t("common.save")}
      error={error ? t(error) : null}
      onClose={close}
      onFinish={async () => {
        setError(null);
        const result = await adminSubmit("/api/admin/me/password", "POST", { current, next });
        if (!result.ok) {
          setError(result.error === "wrong_password" ? "admin.password.wrong" : "toast.error");
          return false;
        }
        toast.notify("toast.saved");
        close();
        return true;
      }}
      steps={[
        {
          title: t("admin.password.current"),
          hint: t("admin.password.currentHint"),
          valid: current.length > 0,
          content: (
            <PasswordField
              id="own-password-current"
              label={t("admin.password.current")}
              value={current}
              onChange={setCurrent}
            />
          ),
        },
        {
          title: t("admin.password.next"),
          hint: t("admin.team.passwordHint"),
          valid: next.length >= 10 && next !== current,
          content: (
            <PasswordField
              id="own-password-next"
              label={t("admin.password.next")}
              value={next}
              onChange={setNext}
            />
          ),
        },
      ]}
    />
  );
}
