"use client";

import { useLocale, useTranslations } from "next-intl";
import { Award, Gauge } from "lucide-react";
import { NumberInput } from "@/components/ui/number-input";
import { Label } from "@/components/ui/label";
import { SectionCard } from "../section-card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type {
  CustomerFormValues,
  CustomerTabProps,
  LoyaltyTier,
} from "../customer-detail-types";

interface LoyaltyTabProps extends CustomerTabProps {
  lifetimePoints: number;
}

const TIER_ORDER: LoyaltyTier[] = ["bronze", "silver", "gold", "platinum"];

/** Message keys (admin.hc.customerDetail). */
const TIER_LABEL: Record<LoyaltyTier, string> = {
  bronze: "tierBronze",
  silver: "tierSilver",
  gold: "tierGold",
  platinum: "tierPlatinum",
};

export function LoyaltyTab({
  form,
  setField,
  readOnly,
  lifetimePoints,
}: LoyaltyTabProps) {
  const t = useTranslations("admin.hc.customerDetail");
  const locale = useLocale();
  const tierIndex = TIER_ORDER.indexOf(form.loyaltyTier);
  const progress =
    tierIndex >= 0 ? ((tierIndex + 1) / TIER_ORDER.length) * 100 : 0;

  return (
    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-3">
      <SectionCard icon={Award} tone="rose" title={t("loyaltyTitle")} description={t("loyaltyDescription")} className="lg:col-span-2">
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("loyaltyTier")}</Label>
              <Select
                value={form.loyaltyTier}
                disabled={readOnly}
                onValueChange={(value) => setField("loyaltyTier", value as CustomerFormValues["loyaltyTier"])}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("selectTier")} />
                </SelectTrigger>
                <SelectContent>
                  {TIER_ORDER.map((tier) => (
                    <SelectItem key={tier} value={tier}>
                      {t(TIER_LABEL[tier])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-loyalty-points">{t("pointsBalance")}</Label>
              <NumberInput
                id="customer-loyalty-points"
                min={0}
                step={1}
                value={form.loyaltyPoints}
                whenEmpty={0}
                normalize={Math.trunc}
                onValueChange={(next) => setField("loyaltyPoints", next ?? 0)}
                disabled={readOnly}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{t("tierProgress")}</span>
              <span className="text-muted-foreground">{t(TIER_LABEL[form.loyaltyTier])}</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full rounded-full bg-linear-to-r from-amber-500 via-rose-500 to-indigo-500 transition-all")}
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-muted-foreground">
              {TIER_ORDER.map((tier) => (
                <span key={tier}>{t(TIER_LABEL[tier])}</span>
              ))}
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard icon={Gauge} tone="violet" title={t("summary")} description={t("summaryDescription")}>
        <div className="space-y-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground">{t("currentBalance")}</p>
            <p className="text-2xl font-bold tabular-nums">
              {form.loyaltyPoints.toLocaleString(locale)}
              <span className="ml-1 text-sm font-normal text-muted-foreground">{t("pts")}</span>
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">{t("lifetimePoints")}</p>
            <p className="text-2xl font-bold tabular-nums">
              {(lifetimePoints ?? 0).toLocaleString(locale)}
              <span className="ml-1 text-sm font-normal text-muted-foreground">{t("pts")}</span>
            </p>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
