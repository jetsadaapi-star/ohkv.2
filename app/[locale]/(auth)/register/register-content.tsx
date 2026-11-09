"use client";

import { Suspense } from "react";
import Link from "@/components/language/link";
import { useParams, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ArrowRight,
  Loader2,
  LogIn,
  PackageSearch,
  Smartphone,
  Sparkles,
  Store,
  TicketPercent,
  Zap,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { SilkAuthShell } from "@/components/auth/silk-auth-shell";
import { sanitizeReturnPath } from "@/lib/auth/return-path";
import { useAppSettings, useMultiVendorMode } from "@/providers/app-settings-provider";
import type { OAuthEnabled } from "@/components/auth/login-form";
import {
  RegisterFields,
  RegisterOAuthButtons,
  RegisterTermsNotice,
  useRegisterForm,
} from "@/components/auth/register-form";

interface RegisterPageProps {
  /** Resolved on the server so the buttons render in the initial HTML. */
  oauthEnabled: OAuthEnabled;
  emailVerificationRequired: boolean;
  /** Settings → SMS allows a new account by a texted code. */
  phoneSignUp?: boolean;
}

function RegisterContent({
  oauthEnabled,
  emailVerificationRequired,
  phoneSignUp,
}: RegisterPageProps) {
  const t = useTranslations();
  const params = useParams();
  const locale = params.locale as string;
  const searchParams = useSearchParams();
  // Return-to target handed over from the login page (or a guarded page), so
  // a guest who registers instead of signing in still lands where they meant
  // to go. Same-origin paths only.
  const redirectParam = sanitizeReturnPath(
    searchParams.get("redirect") || searchParams.get("callbackUrl"),
  );
  const { isMultiVendor } = useMultiVendorMode();
  const { storeName } = useAppSettings();
  const rs = useTranslations("auth.registerShowcase");

  const state = useRegisterForm({
    locale,
    emailVerificationRequired,
    redirectTo: redirectParam,
  });

  const loginHref = `/${locale}/login${
    redirectParam ? `?redirect=${encodeURIComponent(redirectParam)}` : ""
  }`;

  return (
    <SilkAuthShell
      headline={rs("headline")}
      body={rs("body", { store: storeName })}
      perks={[
        { icon: Zap, label: rs("perks.checkout") },
        { icon: PackageSearch, label: rs("perks.orders") },
        { icon: TicketPercent, label: rs("perks.coupons") },
      ]}
      footnote={rs("footnote")}
    >
      <div className="space-y-7">
        <div>
          <p className="inline-flex items-center gap-1.5 rounded-full bg-primary/8 px-3 py-1 text-xs font-semibold text-primary ring-1 ring-inset ring-primary/15">
            <Sparkles className="size-3.5" />
            {rs("eyebrow")}
          </p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-[2rem]">
            {t("auth.createAccount")}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{t("auth.createAccountDescription")}</p>
        </div>

        <div>
          <RegisterOAuthButtons state={state} oauthEnabled={oauthEnabled} />
          {phoneSignUp ? (
            <Link
              href={`/${locale}/login?method=phone${redirectParam ? `&redirect=${encodeURIComponent(redirectParam)}` : ""}`}
              className="mb-4 flex items-center gap-3 rounded-2xl border bg-background p-3 transition-colors hover:border-primary/40 hover:bg-primary/[0.03]"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Smartphone className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{t("auth.phoneLogin.signUpWithPhone")}</span>
                <span className="block text-xs text-muted-foreground">{t("auth.phoneLogin.signUpWithPhoneHint")}</span>
              </span>
              <ArrowRight className="size-4 text-primary rtl:-scale-x-100" />
            </Link>
          ) : null}
          <RegisterFields state={state} />
        </div>

        <RegisterTermsNotice />

        <div className="grid gap-3">
          {/* Already a member */}
          <Link
            href={loginHref}
            className="group flex items-center gap-3 rounded-2xl border border-dashed border-primary/30 bg-primary/[0.04] p-3.5 transition-colors hover:border-primary/50 hover:bg-primary/[0.07]"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <LogIn className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{t("auth.hasAccount")}</span>
              <span className="block text-xs text-muted-foreground">{rs("loginHint")}</span>
            </span>
            <span className="inline-flex shrink-0 items-center gap-1 text-sm font-bold text-primary">
              {t("auth.signIn")}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100" />
            </span>
          </Link>

          {/* Want to sell instead */}
          {isMultiVendor && (
            <Link
              href="/become-vendor"
              className="group flex items-center gap-3 rounded-2xl border border-highlight/40 bg-highlight/10 p-3.5 transition-colors hover:bg-highlight/15"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-highlight text-highlight-foreground shadow-sm">
                <Store className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{t("auth.wantToSell")}</span>
                <span className="block text-xs text-muted-foreground">{rs("sellHint")}</span>
              </span>
              <span className="inline-flex shrink-0 items-center gap-1 text-sm font-bold text-primary">
                {t("auth.becomeVendor")}
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100" />
              </span>
            </Link>
          )}
        </div>
      </div>
    </SilkAuthShell>
  );
}

function RegisterFallback() {
  return (
    <Card className="shadow-lg">
      <CardContent className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
        <p className="text-muted-foreground">…</p>
      </CardContent>
    </Card>
  );
}

export function RegisterPageClient(props: RegisterPageProps) {
  return (
    <Suspense fallback={<RegisterFallback />}>
      <RegisterContent {...props} />
    </Suspense>
  );
}
