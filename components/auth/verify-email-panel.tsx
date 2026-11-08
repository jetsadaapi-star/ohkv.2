"use client";

import { useLocaleHref } from "@/hooks/use-locale-navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import Link from "@/components/language/link";
import { MailCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export function VerifyEmailPanel({ email, locale }: { email: string; locale: string }) {
  const t = useTranslations("storeText.verifyEmailPanel");
  const localeHref = useLocaleHref();
  const [address, setAddress] = useState(email);
  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const resend = async () => {
    if (!address) return;
    setIsSending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/auth/send-verification-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: address,
          callbackURL: localeHref(`/${locale}/email-verified`),
        }),
      });
      if (!response.ok) throw new Error();
      setMessage(t("resent"));
    } catch {
      setMessage(t("resendFailed"));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Card className="shadow-lg">
      <CardHeader className="text-center">
        <MailCheck className="mx-auto mb-2 h-10 w-10 text-store-link" />
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>
          {address
            ? t.rich("sentTo", { address, b: (chunks) => <strong>{chunks}</strong> })
            : t("sentToYourEmail")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-center text-sm text-muted-foreground">
        <p>{t("instructions")}</p>
        <Input
          type="email"
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          placeholder="you@example.com"
          aria-label={t("emailAddress")}
        />
        {message && <p className="rounded-md bg-muted p-3 text-foreground">{message}</p>}
      </CardContent>
      <CardFooter className="flex flex-col gap-2">
        <Button className="w-full" type="button" onClick={() => void resend()} disabled={isSending || !address}>
          {isSending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t("resend")}
        </Button>
        <Button className="w-full" variant="outline" asChild>
          <Link href="/login">{t("backToSignIn")}</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
