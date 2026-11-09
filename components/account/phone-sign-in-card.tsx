"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { displayPhone } from "@/lib/auth/phone-identity";
import { CheckCircle2, Smartphone } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PhoneLoginForm, type PhoneLoginConfig } from "@/components/auth/phone-login-form";

/**
 * Account → Security: the number this account signs in with by texted code.
 * Adding one proves it with a code first; another account's number is refused.
 */
export function PhoneSignInCard({
  config,
  initialPhone,
}: {
  config: PhoneLoginConfig;
  /** E.164, verified; null when none is linked. */
  initialPhone: string | null;
}) {
  const t = useTranslations("auth.phoneLogin");
  const [phone, setPhone] = useState(initialPhone);
  const [editing, setEditing] = useState(false);
  const display = phone ? displayPhone(phone) : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <Smartphone className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">{t("cardTitle")}</CardTitle>
            <CardDescription>{t("cardDescription")}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {phone && !editing ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30">
              <CheckCircle2 className="size-4" />
              <span className="tabular-nums">{display}</span>
            </span>
            <span className="text-xs text-muted-foreground">{t("linked")}</span>
            {config.available ? (
              <Button variant="outline" size="sm" className="ms-auto" onClick={() => setEditing(true)}>
                {t("changeLinked")}
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="max-w-sm space-y-3">
            <PhoneLoginForm
              config={config}
              mode="link"
              onLinked={(next) => {
                setPhone(next);
                setEditing(false);
              }}
            />
            {editing ? (
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                {t("cancel")}
              </Button>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
