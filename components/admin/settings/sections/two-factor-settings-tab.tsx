"use client";

import { Fingerprint, ShieldCheck, Store, UserCog, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { SettingList } from "@/components/admin/settings/fields/setting-row";
import { FeatureRow } from "@/components/admin/settings/fields/feature-row";
import { SectionTitle } from "@/components/admin/form-sections";
import type { Settings } from "@/components/admin/settings/types";
import { useFallbackTranslator } from "@/hooks/use-fallback-translator";
import { SettingsTabHeader } from "./settings-tab-header";
import { StickySaveFooter } from "./sticky-save-footer";

/**
 * Settings → Two-factor: the switch that lets accounts use an authenticator
 * app at all, in the page's heading, and which roles must. A role's switch
 * reads off (and cannot be turned on) while the master switch is off — a
 * requirement nobody can meet would lock that role out.
 */
export function TwoFactorSettingsTab(props: {
  settings: Settings;
  isSaving: boolean;
  isDirty: boolean;
  updateField: (path: string, value: unknown) => void;
  onSave: () => void | Promise<unknown>;
}) {
  const t = useTranslations();
  const tSafe = useFallbackTranslator(t);
  const security = props.settings.security;
  const masterEnabled = Boolean(security.twoFactorEnabled);

  const roles = [
    {
      key: "twoFactorRequiredForAdmin" as const,
      icon: UserCog,
      title: t("admin.settings.twoFactor.admin"),
      description: tSafe(
        "admin.settings.twoFactor.adminHint",
        "Administrators confirm every sign-in with a code from their authenticator app.",
      ),
    },
    {
      key: "twoFactorRequiredForVendors" as const,
      icon: Store,
      title: t("admin.settings.twoFactor.vendor"),
      description: tSafe(
        "admin.settings.twoFactor.vendorHint",
        "Shop owners on the marketplace confirm their sign-in the same way.",
      ),
    },
    {
      key: "twoFactorRequiredForStaff" as const,
      icon: Users,
      title: t("admin.settings.twoFactor.staff"),
      description: tSafe(
        "admin.settings.twoFactor.staffHint",
        "Team members who work in the dashboard or at the till.",
      ),
    },
  ];
  const requiredCount = masterEnabled
    ? roles.filter((role) => Boolean(security[role.key])).length
    : 0;

  return (
    <div className="space-y-4">
      <SettingsTabHeader
        icon={<ShieldCheck />}
        tone="emerald"
        title={t("admin.settings.twoFactor.title")}
        description={t("admin.settings.twoFactor.description")}
        control={
          <Switch
            className="mt-1"
            checked={masterEnabled}
            aria-label={t("admin.settings.twoFactor.enable")}
            onCheckedChange={(v) => props.updateField("security.twoFactorEnabled", v)}
          />
        }
      >
        <p className="text-muted-foreground text-sm">
          {masterEnabled
            ? tSafe(
                "admin.settings.twoFactor.requiredCount",
                `Required for ${requiredCount} of 3 roles`,
                { count: requiredCount },
              )
            : t("admin.settings.twoFactor.enableFirstHint")}
        </p>
      </SettingsTabHeader>

      <Card>
        <CardHeader>
          <SectionTitle icon={<Users />} tone="emerald">
            {tSafe("admin.settings.twoFactor.rolesTitle", "Who must use it")}
          </SectionTitle>
          <CardDescription>
            {tSafe(
              "admin.settings.twoFactor.rolesHint",
              "Accounts in the roles switched on here must enter a code from an authenticator app when they sign in.",
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SettingList>
            {roles.map((role) => (
              <FeatureRow
                key={role.key}
                icon={role.icon}
                title={role.title}
                description={role.description}
                checked={masterEnabled && Boolean(security[role.key])}
                disabled={!masterEnabled}
                onCheckedChange={(v) => props.updateField(`security.${role.key}`, v)}
              />
            ))}
          </SettingList>
        </CardContent>
      </Card>

      {/* Passkeys stand apart from the codes above: their own switch, on
          unless turned off (lib/auth/passkey-login.ts). */}
      <Card>
        <CardHeader>
          <SectionTitle icon={<Fingerprint />} tone="emerald">
            {t("admin.settings.twoFactor.passkey.title")}
          </SectionTitle>
          <CardDescription>{t("admin.settings.twoFactor.passkey.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <SettingList>
            <FeatureRow
              icon={Fingerprint}
              title={t("admin.settings.twoFactor.passkey.enable")}
              description={t("admin.settings.twoFactor.passkey.enableHint")}
              checked={security.passkeyEnabled !== false}
              onCheckedChange={(v) => props.updateField("security.passkeyEnabled", v)}
            />
          </SettingList>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            <li>• {t("admin.settings.twoFactor.passkey.noteWho")}</li>
            <li>• {t("admin.settings.twoFactor.passkey.noteSecurity")}</li>
            <li>• {t("admin.settings.twoFactor.passkey.noteDomain")}</li>
          </ul>
        </CardContent>
      </Card>

      <StickySaveFooter
        label={t("admin.settings.twoFactor.save")}
        isSaving={props.isSaving}
        isDirty={props.isDirty}
        onSave={props.onSave}
      />
    </div>
  );
}
