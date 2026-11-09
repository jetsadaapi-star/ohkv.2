import { getTranslations, setRequestLocale } from "next-intl/server";
import { ChangePasswordCard } from "@/components/account/change-password-card";
import { TwoFactorManagementCard } from "@/components/account/two-factor-management-card";
import { PasskeyManagementCard } from "@/components/account/passkey-management-card";
import { RevokeSessionsCard } from "@/components/account/revoke-sessions-card";
import { DeleteAccountCard } from "@/components/account/delete-account-card";
import { isDemoModeEnabled, PROFILE_DEMO_MODE_MESSAGE } from "@/lib/demo-mode";
import { PhoneSignInCard } from "@/components/account/phone-sign-in-card";
import { getAccountSession } from "@/lib/customers/account-data";
import { getPhoneLoginConfig } from "@/lib/auth/phone-login";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function SecurityPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  const demoMode = {
    enabled: isDemoModeEnabled(),
    message: PROFILE_DEMO_MODE_MESSAGE,
  };
  // Sign in by texted code (Settings → SMS): offered to customers and vendors
  // while SMS can send. Admins and staff keep their email and second factor.
  const [session, phoneLogin] = await Promise.all([getAccountSession(), getPhoneLoginConfig()]);
  const sessionUser = session?.user as
    | { role?: string; phoneNumber?: string | null; phoneNumberVerified?: boolean | null }
    | undefined;
  const linkedPhone = sessionUser?.phoneNumberVerified ? sessionUser.phoneNumber || null : null;
  const showPhoneCard =
    phoneLogin.available &&
    (!sessionUser?.role || sessionUser.role === "customer" || sessionUser.role === "vendor");

  return (
    <div className="space-y-6">
      {/* Desktop only — the mobile identity strip already titles this page. */}
      <div className="hidden lg:block">
        <h1 className="text-xl font-bold sm:text-2xl">
          {t("account.security")}
        </h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          {t("account.securityDescription")}
        </p>
      </div>

      {/* Demo mode is the server's env flag, known here without a request. */}
      <ChangePasswordCard demoMode={demoMode} />

      {showPhoneCard || linkedPhone ? (
        <PhoneSignInCard config={phoneLogin} initialPhone={linkedPhone} />
      ) : null}

      {/* Two-Factor Authentication (personal preference; only shown when the
          administrator has enabled the 2FA feature). */}
      <TwoFactorManagementCard />

      {/* Passkeys: sign in with the face, a fingerprint or the screen lock. */}
      {demoMode.enabled ? null : <PasskeyManagementCard />}

      <RevokeSessionsCard />

      {/* Last, and apart: deleting the account cannot be undone. */}
      <DeleteAccountCard locale={locale} demoMode={demoMode} />
    </div>
  );
}
