"use client";

import { useLocaleHref } from "@/hooks/use-locale-navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { AlertCircle, Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WarningBanner } from "@/components/ui/warning-banner";
import type { EmailVerificationStatus } from "@/lib/auth/email-verification-policy";

export function EmailVerificationNotice({
  email,
  status,
  locale,
}: {
  email: string;
  status?: EmailVerificationStatus;
  locale: string;
}) {
  const t = useTranslations("storeText.emailVerificationNotice");
  const localeHref = useLocaleHref();
  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (status !== "grace_pending") return null;

  const resend = async () => {
    setIsSending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/auth/send-verification-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          callbackURL: localeHref(`/${locale}/email-verified`),
        }),
      });
      if (!response.ok) throw new Error();
      setMessage(t("sent"));
    } catch {
      setMessage(t("sendFailed"));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <WarningBanner
      icon={AlertCircle}
      title={t("title")}
      action={
        <Button
          type="button"
          variant="outline"
          className="shrink-0 bg-background"
          disabled={isSending}
          onClick={() => void resend()}
        >
          {isSending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <MailCheck className="mr-2 h-4 w-4" />
          )}
          {t("verifyEmail")}
        </Button>
      }
    >
      <p>{t("description", { email })}</p>
      {message && <p className="mt-1 font-medium">{message}</p>}
    </WarningBanner>
  );
}
