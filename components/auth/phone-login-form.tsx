"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, Loader2, MessageSquareText, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/auth-client";
import { displayPhone, toE164 } from "@/lib/auth/phone-identity";
import { cn } from "@/lib/utils";

export interface PhoneLoginConfig {
  available: boolean;
  allowSignUp: boolean;
  defaultCountry: string;
}

const RESEND_SECONDS = 60;
const CODE_LENGTH = 6;

/** The server's refusal, as a sentence in the visitor's language. */
function useOtpError() {
  const t = useTranslations("auth.phoneLogin.errors");
  return (error: { code?: string; status?: number } | null | undefined) => {
    const code = error?.code || "";
    const known = [
      "INVALID_PHONE_NUMBER",
      "PHONE_NUMBER_EXIST",
      "PHONE_LOGIN_DISABLED",
      "PHONE_NOT_REGISTERED",
      "PHONE_LOGIN_EMAIL_ONLY",
      "ACCOUNT_INACTIVE_OR_BANNED",
      "OTP_TOO_MANY",
      "OTP_SEND_FAILED",
      "INVALID_OTP",
      "OTP_EXPIRED",
      "OTP_NOT_FOUND",
      "TOO_MANY_ATTEMPTS",
    ];
    if (known.includes(code)) return t(code as never);
    if (error?.status === 429) return t("RATE_LIMITED");
    return t("generic");
  };
}

/**
 * Phone number, then the six-digit code texted to it.
 *
 * `signIn`: signs in (or, when the store allows it, makes a customer account
 * for a new number) and hands over to `onSignedIn`.
 * `link`: a signed-in customer adds the number to their account.
 */
export function PhoneLoginForm({
  config,
  mode = "signIn",
  onSignedIn,
  onLinked,
  className,
}: {
  config: PhoneLoginConfig;
  mode?: "signIn" | "link";
  onSignedIn?: (role?: string) => void | Promise<void>;
  onLinked?: (phoneNumber: string) => void;
  className?: string;
}) {
  const t = useTranslations("auth.phoneLogin");
  const describe = useOtpError();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [raw, setRaw] = useState("");
  const [phone, setPhone] = useState<{ e164: string; display: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wait, setWait] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);
  const country = config.defaultCountry || "TH";

  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait((n) => n - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  useEffect(() => {
    if (step === "code") codeRef.current?.focus();
  }, [step]);

  const sendCode = async (target?: { e164: string; display: string }) => {
    setError(null);
    let next = target;
    if (!next) {
      const e164 = toE164(raw, country);
      if (!e164) {
        setError(describe({ code: "INVALID_PHONE_NUMBER" }));
        return;
      }
      next = { e164, display: displayPhone(e164) };
    }
    setBusy(true);
    try {
      const result = await authClient.phoneNumber.sendOtp({ phoneNumber: next.e164 });
      if (result.error) {
        setError(describe(result.error));
        return;
      }
      setPhone(next);
      setCode("");
      setStep("code");
      setWait(RESEND_SECONDS);
    } catch {
      setError(describe(null));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (value: string) => {
    if (!phone || value.length !== CODE_LENGTH || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await authClient.phoneNumber.verify({
        phoneNumber: phone.e164,
        code: value,
        ...(mode === "link" ? { updatePhoneNumber: true, disableSession: true } : {}),
      });
      if (result.error) {
        setError(describe(result.error));
        setCode("");
        codeRef.current?.focus();
        return;
      }
      if (mode === "link") {
        onLinked?.(phone.e164);
        return;
      }
      const role = (result.data?.user as { role?: string } | undefined)?.role;
      await onSignedIn?.(role);
    } catch {
      setError(describe(null));
    } finally {
      setBusy(false);
    }
  };

  if (step === "code" && phone) {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="flex items-start gap-3 rounded-2xl bg-primary/[0.05] p-3 ring-1 ring-inset ring-primary/15">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <MessageSquareText className="size-4.5" />
          </span>
          <p className="text-sm">
            {t("codeSent")}
            <span className="block font-bold tabular-nums tracking-wide">{phone.display}</span>
          </p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void verify(code);
          }}
          className="space-y-3"
        >
          <label htmlFor="phone-otp" className="text-sm font-semibold">
            {t("codeLabel")}
          </label>
          <input
            id="phone-otp"
            ref={codeRef}
            value={code}
            onChange={(e) => {
              const next = e.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH);
              setCode(next);
              if (next.length === CODE_LENGTH) void verify(next);
            }}
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={CODE_LENGTH}
            placeholder="••••••"
            aria-invalid={Boolean(error)}
            className="h-14 w-full rounded-2xl border bg-background text-center font-mono text-2xl font-bold tracking-[0.6em] focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          {error ? (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={busy || code.length !== CODE_LENGTH} className="h-11 w-full rounded-xl text-base font-semibold">
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            {mode === "link" ? t("confirmLink") : t("confirm")}
          </Button>
        </form>
        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            onClick={() => {
              setStep("phone");
              setError(null);
            }}
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5 rtl:-scale-x-100" />
            {t("changeNumber")}
          </button>
          <button
            type="button"
            disabled={wait > 0 || busy}
            onClick={() => void sendCode(phone)}
            className="font-semibold text-primary disabled:font-normal disabled:text-muted-foreground"
          >
            {wait > 0 ? t("resendIn", { seconds: wait }) : t("resend")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void sendCode();
      }}
      className={cn("space-y-3", className)}
    >
      <label htmlFor="phone-number" className="text-sm font-semibold">
        {t("phoneLabel")}
      </label>
      <div className="flex h-12 items-center gap-2 rounded-2xl border bg-background px-3 focus-within:ring-2 focus-within:ring-primary/40">
        <Smartphone className="size-4.5 shrink-0 text-muted-foreground" />
        <input
          id="phone-number"
          type="tel"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          inputMode="tel"
          autoComplete="tel"
          placeholder={t("phonePlaceholder")}
          aria-invalid={Boolean(error)}
          className="h-full min-w-0 flex-1 bg-transparent text-base tracking-wide focus:outline-none"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {mode === "link" ? t("linkHint") : config.allowSignUp ? t("hintWithSignUp") : t("hint")}
      </p>
      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={busy || !raw.trim()} className="h-11 w-full rounded-xl text-base font-semibold">
        {busy ? <Loader2 className="size-4 animate-spin" /> : <MessageSquareText className="size-4" />}
        {t("sendCode")}
      </Button>
    </form>
  );
}
