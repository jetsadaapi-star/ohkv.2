"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Fingerprint, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/auth-client";
import {
  isPasskeyCancel,
  passkeyErrorCode,
  passkeyErrorMessageKey,
  webAuthnSupport,
} from "@/lib/auth/passkey-errors";
import { cn } from "@/lib/utils";

type SignedIn = (role?: string) => void | Promise<void>;

/**
 * "Sign in with a passkey": Face ID, a fingerprint or the phone's screen lock,
 * no password. With `autofill` the browser also offers the account's passkey
 * in the email field's suggestions (conditional mediation), where it can.
 */
export function PasskeySignIn({
  onSignedIn,
  autofill = true,
  className,
}: {
  onSignedIn: SignedIn;
  autofill?: boolean;
  className?: string;
}) {
  const t = useTranslations("auth.passkey");
  const supported = useSyncExternalStore(webAuthnSupport.subscribe, webAuthnSupport.get, webAuthnSupport.server);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const signedIn = useRef(onSignedIn);
  useEffect(() => {
    signedIn.current = onSignedIn;
  });

  const describe = (code?: string, message?: string) => {
    const key = passkeyErrorMessageKey(code);
    return key ? t(`errors.${key}`) : message || t("errors.generic");
  };

  useEffect(() => {
    if (!webAuthnSupport.get() || !autofill) return;
    let cancelled = false;
    void (async () => {
      const conditional = await window.PublicKeyCredential.isConditionalMediationAvailable?.().catch(() => false);
      if (!conditional || cancelled) return;
      const result = await authClient.signIn.passkey({ autoFill: true }).catch(() => null);
      if (cancelled || !result) return;
      if (result.error) {
        if (!isPasskeyCancel(passkeyErrorCode(result.error))) setError(describe(passkeyErrorCode(result.error), result.error.message));
        return;
      }
      const role = (result.data as { user?: { role?: string } } | undefined)?.user?.role;
      await signedIn.current(role);
    })();
    return () => {
      cancelled = true;
    };
    // `describe` reads translations only; the request starts once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autofill]);

  if (!supported) return null;

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await authClient.signIn.passkey();
      if (result.error) {
        if (!isPasskeyCancel(passkeyErrorCode(result.error))) setError(describe(passkeyErrorCode(result.error), result.error.message));
        return;
      }
      const role = (result.data as { user?: { role?: string } } | undefined)?.user?.role;
      await signedIn.current(role);
    } catch {
      setError(t("errors.generic"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <Button
        type="button"
        variant="outline"
        onClick={() => void start()}
        disabled={busy}
        className="h-11 w-full gap-2 rounded-xl border-primary/25 text-sm font-semibold hover:bg-primary/5"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Fingerprint className="size-4.5 text-primary" />}
        {t("signIn")}
      </Button>
      {error ? (
        <p role="alert" className="text-center text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
