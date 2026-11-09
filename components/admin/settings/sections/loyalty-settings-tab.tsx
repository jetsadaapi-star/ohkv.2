"use client";

import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, Award, Coins, Gift, Wallet } from "lucide-react";
import Link from "@/components/language/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { NumberInput } from "@/components/ui/number-input";
import { Switch } from "@/components/ui/switch";
import { formatCurrency } from "@/lib/intl/money";
import { resolveCurrency } from "@/lib/intl/currencies";
import {
  DEFAULT_LOYALTY_RULES,
  LOYALTY_THRESHOLDS,
  loyaltyRulesOf,
} from "@/lib/customers/loyalty";
import type { Settings } from "@/components/admin/settings/types";
import {
  SettingList,
  SettingRow,
  SettingUnit,
} from "@/components/admin/settings/fields/setting-row";
import { SettingsTabHeader } from "./settings-tab-header";
import { StickySaveFooter } from "./sticky-save-footer";

const TIERS = ["silver", "gold", "platinum"] as const;

const TIER_DOT: Record<"bronze" | (typeof TIERS)[number], string> = {
  bronze: "bg-[#b0703c]",
  silver: "bg-slate-400",
  gold: "bg-amber-400",
  platinum: "bg-[color-mix(in_oklab,var(--primary)_70%,white)]",
};

/**
 * Settings → Loyalty points: the switch, how fast paid orders earn, how much
 * more each tier earns, and what points turn into as store credit.
 *
 * Every number is previewed in money as it is typed, since "25 per point" and
 * "100 points = 25" only mean something side by side.
 */
export function LoyaltySettingsTab(props: {
  settings: Settings;
  isSaving: boolean;
  isDirty: boolean;
  updateField: (path: string, value: unknown) => void;
  onSave: () => void | Promise<unknown>;
  onDiscard?: () => void;
}) {
  const t = useTranslations("admin.settings.loyalty");
  const tSettings = useTranslations("admin.settings");
  const stored = props.settings.loyalty;
  const rules = loyaltyRulesOf({ loyalty: stored });
  const enabled = Boolean(stored?.enabled);
  const locale = useLocale();
  const currency = props.settings.general?.defaultCurrency || "THB";
  const resolved = resolveCurrency(currency.toUpperCase());
  const money = (value: number) => formatCurrency(value, resolved.code, resolved.locale);
  const number = (value: number) => value.toLocaleString(locale);
  const set = (key: string, value: unknown) => props.updateField(`loyalty.${key}`, value);

  // What 1,000 spent earns and gives back, at the base rate.
  const sampleSpend = 1000;
  const samplePoints = Math.floor(sampleSpend / rules.spendPerPoint);
  const sampleCredit =
    Math.floor(samplePoints / rules.redeemPoints) * rules.redeemValue +
    ((samplePoints % rules.redeemPoints) / rules.redeemPoints) * rules.redeemValue;
  const backPercent = (rules.redeemValue / rules.redeemPoints / rules.spendPerPoint) * 100;

  return (
    <div className="space-y-4">
      <SettingsTabHeader
        icon={<Gift />}
        tone="rose"
        title={t("title")}
        description={t("description")}
        control={
          <Switch
            className="mt-1"
            checked={enabled}
            aria-label={t("title")}
            onCheckedChange={(checked) => set("enabled", checked)}
          />
        }
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <Summary icon={<Coins className="size-4" />} label={t("summary.earn")}>
            {t("summary.earnValue", { spend: money(rules.spendPerPoint) })}
          </Summary>
          <Summary icon={<Wallet className="size-4" />} label={t("summary.redeem")}>
            {t("summary.redeemValue", {
              points: number(rules.redeemPoints),
              credit: money(rules.redeemValue),
            })}
          </Summary>
          <Summary icon={<Award className="size-4" />} label={t("summary.back")}>
            {t("summary.backValue", { percent: backPercent.toFixed(2).replace(/\.?0+$/, "") })}
          </Summary>
        </div>
      </SettingsTabHeader>

      <Card>
        <CardHeader>
          <CardTitle>{t("earn.title")}</CardTitle>
          <CardDescription>{t("earn.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <SettingList>
            <SettingRow inputId="loyalty-spend" label={t("earn.spendPerPoint")} hint={t("earn.spendPerPointHint")}>
              <NumberInput
                id="loyalty-spend"
                className="w-28"
                min={0.01}
                max={1_000_000}
                step={0.01}
                value={stored?.spendPerPoint ?? DEFAULT_LOYALTY_RULES.spendPerPoint}
                whenEmpty={DEFAULT_LOYALTY_RULES.spendPerPoint}
                onValueChange={(next) => set("spendPerPoint", next ?? DEFAULT_LOYALTY_RULES.spendPerPoint)}
              />
              <SettingUnit>{t("earn.perPointUnit", { currency })}</SettingUnit>
            </SettingRow>
          </SettingList>
          <p className="rounded-lg bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
            {t("earn.example", {
              spend: money(sampleSpend),
              points: number(samplePoints),
              credit: money(Math.round(sampleCredit * 100) / 100),
            })}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("tiers.title")}</CardTitle>
          <CardDescription>{t("tiers.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <SettingList>
            <SettingRow
              label={
                <span className="inline-flex items-center gap-2">
                  <span className={`size-2.5 rounded-full ${TIER_DOT.bronze}`} />
                  {t("tiers.bronze")}
                </span>
              }
              hint={t("tiers.bronzeHint")}
            >
              <SettingUnit>{t("tiers.baseRate")}</SettingUnit>
            </SettingRow>
            {TIERS.map((tier) => (
              <SettingRow
                key={tier}
                inputId={`loyalty-bonus-${tier}`}
                label={
                  <span className="inline-flex items-center gap-2">
                    <span className={`size-2.5 rounded-full ${TIER_DOT[tier]}`} />
                    {t(`tiers.${tier}`)}
                  </span>
                }
                hint={t("tiers.reachAt", { points: number(LOYALTY_THRESHOLDS[tier]) })}
              >
                <span className="text-muted-foreground text-sm">+</span>
                <NumberInput
                  id={`loyalty-bonus-${tier}`}
                  className="w-20"
                  min={0}
                  max={1000}
                  step={1}
                  value={stored?.tierBonus?.[tier] ?? DEFAULT_LOYALTY_RULES.tierBonus[tier]}
                  whenEmpty={0}
                  onValueChange={(next) =>
                    set("tierBonus", { ...rules.tierBonus, [tier]: next ?? 0 })
                  }
                />
                <SettingUnit>%</SettingUnit>
              </SettingRow>
            ))}
          </SettingList>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("redeem.title")}</CardTitle>
          <CardDescription>{t("redeem.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <SettingList>
            <SettingRow inputId="loyalty-redeem-points" label={t("redeem.rate")} hint={t("redeem.rateHint")}>
              <NumberInput
                id="loyalty-redeem-points"
                className="w-20"
                min={1}
                max={1_000_000}
                step={1}
                value={stored?.redeemPoints ?? DEFAULT_LOYALTY_RULES.redeemPoints}
                whenEmpty={DEFAULT_LOYALTY_RULES.redeemPoints}
                onValueChange={(next) => set("redeemPoints", Math.max(1, Math.floor(next ?? DEFAULT_LOYALTY_RULES.redeemPoints)))}
              />
              <SettingUnit>{t("redeem.pointsEquals")}</SettingUnit>
              <NumberInput
                id="loyalty-redeem-value"
                aria-label={t("redeem.value")}
                className="w-20"
                min={0.01}
                max={1_000_000}
                step={0.01}
                value={stored?.redeemValue ?? DEFAULT_LOYALTY_RULES.redeemValue}
                whenEmpty={DEFAULT_LOYALTY_RULES.redeemValue}
                onValueChange={(next) => set("redeemValue", next ?? DEFAULT_LOYALTY_RULES.redeemValue)}
              />
              <SettingUnit>{currency}</SettingUnit>
            </SettingRow>
            <SettingRow inputId="loyalty-min" label={t("redeem.minimum")} hint={t("redeem.minimumHint")}>
              <NumberInput
                id="loyalty-min"
                className="w-24"
                min={1}
                max={1_000_000}
                step={1}
                value={stored?.minRedeemPoints ?? DEFAULT_LOYALTY_RULES.minRedeemPoints}
                whenEmpty={DEFAULT_LOYALTY_RULES.minRedeemPoints}
                onValueChange={(next) => set("minRedeemPoints", Math.max(1, Math.floor(next ?? DEFAULT_LOYALTY_RULES.minRedeemPoints)))}
              />
              <SettingUnit>{t("redeem.pointsUnit")}</SettingUnit>
            </SettingRow>
            <SettingRow inputId="loyalty-expiry" label={t("redeem.expiry")} hint={t("redeem.expiryHint")}>
              <NumberInput
                id="loyalty-expiry"
                className="w-24"
                min={0}
                max={3650}
                step={1}
                value={stored?.creditExpiryDays ?? DEFAULT_LOYALTY_RULES.creditExpiryDays}
                whenEmpty={0}
                onValueChange={(next) => set("creditExpiryDays", Math.max(0, Math.floor(next ?? 0)))}
              />
              <SettingUnit>{t("redeem.days")}</SettingUnit>
            </SettingRow>
          </SettingList>
          {(stored?.minRedeemPoints ?? DEFAULT_LOYALTY_RULES.minRedeemPoints) <
          (stored?.redeemPoints ?? DEFAULT_LOYALTY_RULES.redeemPoints) ? (
            <p className="text-sm text-destructive">{t("redeem.minimumTooLow")}</p>
          ) : null}
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            <li>• {t("notes.credit")}</li>
            <li>• {t("notes.refunds")}</li>
            <li>• {t("notes.tier")}</li>
          </ul>
          <Link
            href="/admin/customers"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            {t("links.customers")}
            <ArrowRight className="size-4 rtl:rotate-180" />
          </Link>
        </CardContent>
      </Card>

      <StickySaveFooter
        label={tSettings("general.save")}
        isSaving={props.isSaving}
        isDirty={props.isDirty}
        onSave={props.onSave}
        onDiscard={props.onDiscard}
      />
    </div>
  );
}

function Summary({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-background/60 p-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <span className="text-primary">{icon}</span>
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold">{children}</p>
    </div>
  );
}
