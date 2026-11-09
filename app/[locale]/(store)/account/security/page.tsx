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
import { AccountPageHeader } from "@/components/account/account-ui";
import { SecurityOverview } from "@/components/account/security-overview";
import { Shield } from "lucide-react";

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

  // The cards are shared with the admin and seller profiles; here they wear
  // the account's look — rounder, with the gold thread along the top.
  const cards =
    "[&_[data-slot=card]]:relative [&_[data-slot=card]]:overflow-hidden [&_[data-slot=card]]:rounded-2xl [&_[data-slot=card]]:shadow-[0_8px_24px_-14px_color-mix(in_oklab,var(--primary)_22%,transparent)] [&_[data-slot=card]]:before:absolute [&_[data-slot=card]]:before:inset-x-0 [&_[data-slot=card]]:before:top-0 [&_[data-slot=card]]:before:h-[3px] [&_[data-slot=card]]:before:bg-[linear-gradient(90deg,var(--primary),var(--highlight)_55%,var(--primary))] [&_[data-slot=card]]:before:opacity-70 [&_input]:rounded-xl [&_[data-slot=button]]:rounded-xl";

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <AccountPageHeader
        icon={<Shield />}
        title={t("account.security")}
        description={t("account.securityDescription")}
      />

      <SecurityOverview phoneAvailable={showPhoneCard} phoneLinked={Boolean(linkedPhone)} />

      <div className={`grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px] ${cards}`}>
        <div className="space-y-5">
          {/* Demo mode is the server's env flag, known here without a request. */}
          <ChangePasswordCard demoMode={demoMode} />

          {/* Two-Factor Authentication (personal preference; only shown when
              the administrator has enabled the 2FA feature). */}
          <TwoFactorManagementCard />

          {/* Passkeys: sign in with the face, a fingerprint or the screen lock. */}
          {demoMode.enabled ? null : <PasskeyManagementCard />}
        </div>

        <div className="space-y-5">
          {showPhoneCard || linkedPhone ? (
            <PhoneSignInCard config={phoneLogin} initialPhone={linkedPhone} />
          ) : null}

          <RevokeSessionsCard />

          {/* Last, and apart: deleting the account cannot be undone. */}
          <DeleteAccountCard locale={locale} demoMode={demoMode} />
        </div>
      </div>
    </div>
  );
}
