"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  Activity,
  BarChart3,
  CheckCircle2,
  Info,
  LineChart,
  Tags,
  TriangleAlert,
} from "lucide-react";
import { SecretInput } from "@/components/admin/settings/fields/secret-input";
import { credentialMeta } from "@/components/admin/settings/fields/use-credential-meta";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import type { Settings } from "@/components/admin/settings/types";
import { EnvSourceHint } from "@/components/admin/settings/fields/env-source-hint";
import { SectionTitle } from "@/components/admin/form-sections";
import { SocialGlyph } from "@/components/icons/social-brand-icons";
import { cn } from "@/lib/utils";
import { SettingsTabHeader } from "./settings-tab-header";
import { StickySaveFooter } from "./sticky-save-footer";

type TrackerKey = "googleAnalyticsId" | "googleTagManagerId" | "facebookPixelId" | "tiktokPixelId";

/**
 * The four tags the storefront prints, each with the shape its ID takes.
 * The shape is a hint only — a store may know better — so a mismatch warns
 * and never blocks the save.
 */
const TRACKERS: Array<{
  key: TrackerKey;
  name: string;
  tile: string;
  icon: ReactNode;
  pattern: RegExp;
  example: string;
}> = [
  {
    key: "googleAnalyticsId",
    name: "Google Analytics 4",
    tile: "bg-[#F9AB00] text-white",
    icon: <BarChart3 className="size-[18px]" />,
    pattern: /^G-[A-Z0-9]{4,}$/i,
    example: "G-XXXXXXXXXX",
  },
  {
    key: "googleTagManagerId",
    name: "Google Tag Manager",
    tile: "bg-[#246FDB] text-white",
    icon: <Tags className="size-[18px]" />,
    pattern: /^GTM-[A-Z0-9]{4,}$/i,
    example: "GTM-XXXXXXX",
  },
  {
    key: "facebookPixelId",
    name: "Meta Pixel",
    tile: "bg-[#0866FF] text-white",
    icon: <SocialGlyph platform="facebook" className="size-[18px]" />,
    pattern: /^\d{10,20}$/,
    example: "123456789012345",
  },
  {
    key: "tiktokPixelId",
    name: "TikTok Pixel",
    tile: "bg-black text-white dark:bg-white dark:text-black",
    icon: <SocialGlyph platform="tiktok" className="size-[18px]" />,
    pattern: /^[A-Z0-9]{12,30}$/i,
    example: "C1234567890ABCDEF",
  },
];

export function AnalyticsSettingsTab(props: {
  settings: Settings;
  isSaving: boolean;
  isDirty: boolean;
  updateNestedField: (path: string, value: unknown) => void;
  onSave: () => void | Promise<unknown>;
}) {
  const t = useTranslations("admin.settings.analytics");
  const { settings, isSaving, isDirty, updateNestedField, onSave } = props;
  const analytics = settings.analytics;
  const envAnalytics = settings._meta?.envSources?.analytics;

  const plausibleKey = credentialMeta(settings, "analytics.plausibleApiKey");
  const plausibleOn = Boolean(analytics?.plausibleDomain?.trim());
  const activeCount =
    TRACKERS.filter((tracker) => analytics?.[tracker.key]?.trim() || envAnalytics?.[tracker.key]).length +
    (plausibleOn ? 1 : 0);

  return (
    <div className="space-y-4">
      <SettingsTabHeader
        icon={<LineChart />}
        tone="orange"
        title={t("title")}
        description={t("description")}
        meta={
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
              activeCount > 0
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                : "border-border bg-muted text-muted-foreground",
            )}
          >
            <Activity className="h-3.5 w-3.5" />
            {t("activeCount", { count: activeCount })}
          </span>
        }
      />

      <Card>
        <CardHeader>
          <SectionTitle icon={<Tags />} tone="amber">
            {t("trackersTitle")}
          </SectionTitle>
          <CardDescription>{t("trackersHint")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Tracking IDs print in every storefront page's HTML, so they are
              plain fields; only the Plausible API key below is a secret. */}
          <div className="grid gap-3 md:grid-cols-2">
            {TRACKERS.map((tracker) => {
              const value = analytics?.[tracker.key] || "";
              const fromEnv = Boolean(envAnalytics?.[tracker.key]);
              const trimmed = value.trim();
              const active = Boolean(trimmed) || fromEnv;
              const mismatch = Boolean(trimmed) && !tracker.pattern.test(trimmed);
              return (
                <div
                  key={tracker.key}
                  className={cn(
                    "space-y-3 rounded-2xl border p-4 transition-colors",
                    active && !mismatch && "border-emerald-500/30 bg-emerald-500/[0.03]",
                    mismatch && "border-amber-500/40 bg-amber-500/[0.04]",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-xl shadow-sm",
                        active ? tracker.tile : "bg-muted text-muted-foreground shadow-none",
                      )}
                      aria-hidden
                    >
                      {tracker.icon}
                    </span>
                    <Label htmlFor={tracker.key} className="min-w-0 flex-1 text-sm font-semibold">
                      {tracker.name}
                    </Label>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                        active
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      <span className={cn("size-1.5 rounded-full", active ? "bg-emerald-500" : "bg-muted-foreground/50")} />
                      {active ? t("statusActive") : t("statusOff")}
                    </span>
                  </div>
                  <Input
                    id={tracker.key}
                    value={value}
                    onChange={(e) => updateNestedField(`analytics.${tracker.key}`, e.target.value)}
                    placeholder={tracker.example}
                    spellCheck={false}
                    autoComplete="off"
                    className="font-mono"
                  />
                  {mismatch ? (
                    <p className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                      <TriangleAlert className="size-3.5 shrink-0" />
                      {t("formatMismatch", { name: tracker.name, example: tracker.example })}
                    </p>
                  ) : null}
                  <EnvSourceHint show={fromEnv} />
                </div>
              );
            })}
          </div>
          <p className="flex items-start gap-2 rounded-xl border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            {t("publicNote")}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1.5">
              <SectionTitle icon={<Activity />} tone="indigo">
                {t("plausibleTitle")}
              </SectionTitle>
              <CardDescription>{t("plausibleHint")}</CardDescription>
            </div>
            {plausibleOn ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="size-3" />
                {t("statusActive")}
              </span>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="plausibleDomain">{t("plausibleDomain")}</Label>
              <Input
                id="plausibleDomain"
                value={analytics?.plausibleDomain || ""}
                onChange={(e) => updateNestedField("analytics.plausibleDomain", e.target.value)}
                placeholder={t("plausibleDomainPlaceholder")}
                spellCheck={false}
              />
              <p className="text-xs text-muted-foreground">{t("plausibleDomainHelp")}</p>
            </div>
            <div className="space-y-2">
              <SecretInput
                id="plausibleApiKey"
                label={t("plausibleApiKey")}
                value={analytics?.plausibleApiKey || ""}
                onChange={(v) => updateNestedField("analytics.plausibleApiKey", v)}
                onClear={() => updateNestedField("analytics.plausibleApiKey", null)}
                secretSet={plausibleKey.set}
                maskedHint={plausibleKey.hint}
                placeholderWhenUnset={t("plausibleApiKeyPlaceholder")}
              />
              <p className="text-xs text-muted-foreground">{t("plausibleApiKeyHelp")}</p>
              <EnvSourceHint show={Boolean(envAnalytics?.plausibleApiKey)} />
            </div>
          </div>

          <div
            className={cn(
              "space-y-3 rounded-xl border p-3.5",
              analytics?.plausibleSelfHosted && "border-indigo-500/30 bg-indigo-500/[0.04]",
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label htmlFor="plausibleSelfHosted" className="text-sm font-medium">
                  {t("plausibleSelfHosted")}
                </Label>
                <p className="mt-0.5 text-xs text-muted-foreground">{t("selfHostedHint")}</p>
              </div>
              <Switch
                id="plausibleSelfHosted"
                checked={analytics?.plausibleSelfHosted || false}
                onCheckedChange={(checked) => updateNestedField("analytics.plausibleSelfHosted", checked)}
              />
            </div>
            {analytics?.plausibleSelfHosted ? (
              <div className="space-y-2">
                <Label htmlFor="plausibleBaseUrl">{t("plausibleBaseUrl")}</Label>
                <Input
                  id="plausibleBaseUrl"
                  type="url"
                  value={analytics?.plausibleBaseUrl || ""}
                  onChange={(e) => updateNestedField("analytics.plausibleBaseUrl", e.target.value)}
                  placeholder={t("plausibleBaseUrlPlaceholder")}
                />
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <StickySaveFooter label={t("save")} isSaving={isSaving} isDirty={isDirty} onSave={onSave} />
    </div>
  );
}
