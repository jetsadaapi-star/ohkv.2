"use client";

import Link from "@/components/language/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Suspense, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Heart,
  Loader2,
  PackageSearch,
  Shield,
  Sparkles,
  TicketPercent,
  UserPlus,
} from "lucide-react";
import { useAppSettings } from "@/providers/app-settings-provider";
import { SilkAuthShell } from "@/components/auth/silk-auth-shell";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  describeOAuthError,
  type Translate,
} from "@/lib/auth/auth-error-message";
import { sanitizeReturnPath } from "@/lib/auth/return-path";
import { useParams, useSearchParams } from "next/navigation";
import {
  DemoCredentialsList,
  LoginFields,
  LoginOAuthButtons,
  TwoFactorFields,
  useLoginForm,
  type DemoCredential,
  type OAuthEnabled,
} from "@/components/auth/login-form";

interface LoginPageProps {
  /** Resolved on the server so the buttons render in the initial HTML. */
  oauthEnabled: OAuthEnabled;
  /** Empty unless the deployment runs with DEMO_MODE — see `demoLoginCredentials`. */
  demoCredentials: DemoCredential[];
}

function LoginContent({ oauthEnabled, demoCredentials }: LoginPageProps) {
  const t = useTranslations();
  const ts = useTranslations("storeText.loginContent");
  const ls = useTranslations("auth.loginShowcase");
  const { storeName } = useAppSettings();
  const params = useParams();
  const locale = params.locale as string;
  const searchParams = useSearchParams();

  const [dismissedSearchErrorKey, setDismissedSearchErrorKey] = useState<
    string | null
  >(null);

  const showDemoCredentials = demoCredentials.length > 0;

  // A Google/Facebook sign-in that failed comes back here with `?error=`.
  const searchErrorCode = searchParams.get("error");
  const searchErrorRole = searchParams.get("role") || "";
  const searchErrorEmail = searchParams.get("email") || "";
  const searchErrorKey = searchErrorCode
    ? `${searchErrorCode}:${searchErrorRole}:${searchErrorEmail}`
    : null;
  const searchErrorMessage = describeOAuthError(
    {
      code: searchErrorCode,
      role: searchErrorRole,
      email: searchErrorEmail,
    },
    t as unknown as Translate,
  );

  const dismissSearchError = () => {
    if (searchErrorKey) {
      setDismissedSearchErrorKey(searchErrorKey);
    }
  };

  /**
   * `redirect` is this page's own convention, but most of the app links here
   * with `?callbackUrl=` (account pages, wishlist, become-vendor, chat). Both
   * are accepted so those return-to targets aren't silently dropped.
   * Sanitized to same-origin paths so a crafted link can't bounce a fresh
   * login to an external site.
   */
  const redirectParam = sanitizeReturnPath(
    searchParams.get("redirect") || searchParams.get("callbackUrl"),
  );

  const state = useLoginForm({
    locale,
    redirectTo: redirectParam,
    onAttempt: dismissSearchError,
  });

  const visibleError =
    state.error ||
    (searchErrorKey !== dismissedSearchErrorKey ? searchErrorMessage : null);

  // 2FA Verification Screen
  if (state.requires2FA) {
    return (
      <LoginShell>
        <div className="space-y-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
              <Shield className="size-7" />
            </span>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight">{t("auth.twoFactorTitle")}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{t("auth.twoFactorDescription")}</p>
            </div>
          </div>
          <TwoFactorFields state={state} error={state.error} />
          <Button variant="ghost" className="w-full gap-2 rounded-xl" onClick={state.cancel2FA}>
            <ArrowLeft className="size-4 rtl:-scale-x-100" />
            {t("auth.backToLogin")}
          </Button>
        </div>
      </LoginShell>
    );
  }

  const registerHref = `/${locale}/register${
    redirectParam ? `?redirect=${encodeURIComponent(redirectParam)}` : ""
  }`;

  return (
    <div className="auth-wide mx-auto w-full space-y-6">
      <LoginShell>
        <div className="space-y-7">
          <div>
            <p className="inline-flex items-center gap-1.5 rounded-full bg-primary/8 px-3 py-1 text-xs font-semibold text-primary ring-1 ring-inset ring-primary/15">
              <Sparkles className="size-3.5" />
              {t("auth.welcomeBack")}
            </p>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-[2rem]">{ls("title")}</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">{ls("subtitle", { store: storeName })}</p>
          </div>

          <LoginOAuthButtons state={state} oauthEnabled={oauthEnabled} />
          <LoginFields state={state} error={visibleError} />

          {/* Not a member yet — a soft invitation, not a second button race */}
          <Link
            href={registerHref}
            className="group flex items-center gap-3 rounded-2xl border border-dashed border-primary/30 bg-primary/[0.04] p-3.5 transition-colors hover:border-primary/50 hover:bg-primary/[0.07]"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-highlight text-highlight-foreground shadow-sm">
              <UserPlus className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{t("auth.noAccount")}</span>
              <span className="block text-xs text-muted-foreground">{ls("registerHint")}</span>
            </span>
            <span className="inline-flex shrink-0 items-center gap-1 text-sm font-bold text-primary">
              {t("auth.createAccount")}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100" />
            </span>
          </Link>
        </div>
      </LoginShell>

      {showDemoCredentials && (
        <Card className="mx-auto h-fit max-w-5xl gap-3 rounded-3xl px-2 py-4 shadow-lg">
          <CardHeader className="px-2 gap-1 text-center lg:text-left">
            <CardTitle className="text-base font-semibold">{ts("demoTitle")}</CardTitle>
            <CardDescription>{ts("demoDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="px-2">
            <DemoCredentialsList state={state} credentials={demoCredentials} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/** The silk panel with the sign-in story. */
function LoginShell({ children }: { children: React.ReactNode }) {
  const ls = useTranslations("auth.loginShowcase");
  const { storeName } = useAppSettings();
  return (
    <SilkAuthShell
      headline={ls("headline")}
      body={ls("body", { store: storeName })}
      perks={[
        { icon: PackageSearch, label: ls("perks.orders") },
        { icon: Heart, label: ls("perks.wishlist") },
        { icon: TicketPercent, label: ls("perks.coupons") },
      ]}
      footnote={ls("footnote")}
    >
      {children}
    </SilkAuthShell>
  );
}

function LoginFallback() {
  const ts = useTranslations("storeText.loginContent");
  return (
    <Card className="shadow-lg">
      <CardContent className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
        <p className="text-muted-foreground">{ts("loading")}</p>
      </CardContent>
    </Card>
  );
}

export function LoginPageClient(props: LoginPageProps) {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginContent {...props} />
    </Suspense>
  );
}
