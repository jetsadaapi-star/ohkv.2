"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowDownRight, ArrowUpRight, Crown, Gift, Loader2, Minus, Plus, Sparkles, Wallet } from "lucide-react";
import Link from "@/components/language/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { invalidateResources, useSuspenseResource } from "@/hooks/use-suspense-resource";
import { formatCurrency } from "@/lib/intl/money";
import { resolveCurrency } from "@/lib/intl/currencies";
import { pointsToCredit, type LoyaltyRules } from "@/lib/customers/loyalty";
import { KHIT_TILE, SILK_GRADIENT } from "@/components/auth/silk-pattern";
import { cn } from "@/lib/utils";
import type { LoyaltyTier } from "@/types";

type HistoryRow = {
  id: string;
  type: "earn" | "reverse" | "redeem" | "adjust";
  points: number;
  orderId?: string;
  orderNumber?: string;
  creditAmount?: number;
  currency?: string;
  bonusPercent?: number;
  note?: string;
  createdAt: string;
};

type Overview = {
  enabled: boolean;
  rules: LoyaltyRules;
  currency: string;
  balance: number;
  lifetimePoints: number;
  tier: LoyaltyTier;
  tierBonusPercent: number;
  next: { tier: LoyaltyTier; at: number; remaining: number } | null;
  thresholds: Record<LoyaltyTier, number>;
  redeemable: number;
  redeemableCredit: number;
  history: HistoryRow[];
};

const URL = "/api/user/loyalty";

const TIER_STYLE: Record<LoyaltyTier, string> = {
  bronze: "bg-[#b0703c]/15 text-[#8a5228] ring-[#b0703c]/30 dark:text-[#e3a978]",
  silver: "bg-slate-200/70 text-slate-700 ring-slate-300 dark:bg-slate-700/40 dark:text-slate-200",
  gold: "bg-amber-100 text-amber-800 ring-amber-300 dark:bg-amber-900/40 dark:text-amber-200",
  platinum: "bg-primary/10 text-primary ring-primary/30",
};

/**
 * The shopper's loyalty points (Settings → Loyalty points): the balance and
 * its worth, the tier and the way to the next, turning points into store
 * credit, and the history.
 *
 * Suspends until the first answer — render it inside `<ClientSuspense>`.
 */
export function CustomerLoyalty() {
  const t = useTranslations("account.loyalty");
  const locale = useLocale();
  const { data, mutate, refresh } = useSuspenseResource<Overview>(URL);
  const [busy, setBusy] = useState(false);

  const overview = data;
  const rules = overview?.rules;
  const step = rules?.redeemPoints ?? 100;
  const [chosen, setChosen] = useState<number | null>(null);
  if (!overview || !rules) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">{t("unavailable")}</CardContent>
      </Card>
    );
  }

  const currency = resolveCurrency(overview.currency);
  const money = (value: number) => formatCurrency(value, currency.code, currency.locale);
  const number = (value: number) => value.toLocaleString(locale);
  const points = Math.min(overview.redeemable, Math.max(rules.minRedeemPoints, chosen ?? overview.redeemable));
  const canRedeem = overview.redeemable > 0;
  const progress = overview.next
    ? Math.min(
        100,
        ((overview.lifetimePoints - overview.thresholds[overview.tier]) /
          Math.max(1, overview.next.at - overview.thresholds[overview.tier])) *
          100,
      )
    : 100;

  const redeem = async () => {
    if (!canRedeem || busy) return;
    setBusy(true);
    try {
      const response = await fetch(`${URL}/redeem`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ points }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.success) {
        // Most often the balance moved in another tab: show what is there now.
        toast.error(t("redeemFailed"));
        await refresh();
        setChosen(null);
        return;
      }
      mutate(body.data.overview);
      setChosen(null);
      invalidateResources((url) => url.startsWith("/api/user/store-credit"));
      toast.success(t("redeemed", { points: number(body.data.points), credit: money(body.data.credit) }));
    } catch {
      toast.error(t("redeemFailed"));
    } finally {
      setBusy(false);
    }
  };

  const describe = (row: HistoryRow) => {
    if (row.type === "earn") {
      if (row.note === "refund_reversed") return t("history.refundUndone", { order: row.orderNumber || "" });
      return row.orderNumber ? t("history.earn", { order: row.orderNumber }) : t("history.earnPlain");
    }
    if (row.type === "reverse") return t("history.reverse", { order: row.orderNumber || "" });
    if (row.type === "redeem") {
      return t("history.redeem", { credit: money(row.creditAmount ?? 0) });
    }
    return t("history.adjust");
  };

  return (
    <div className="space-y-6">
      {/* The balance, in the store's silk. */}
      <div
        className="relative overflow-hidden rounded-3xl p-5 text-white shadow-lg sm:p-6"
        style={{ background: SILK_GRADIENT }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{ backgroundImage: KHIT_TILE }}
        />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-white/80">{t("balance")}</p>
            <p className="mt-1 text-4xl font-extrabold tabular-nums tracking-tight sm:text-5xl">
              {number(overview.balance)}
              <span className="ms-2 text-base font-semibold text-white/80">{t("pointsUnit")}</span>
            </p>
            <p className="mt-1 text-sm text-white/85">
              {t("worth", { credit: money(pointsToCredit(overview.balance, rules)) })}
            </p>
          </div>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold ring-1 ring-inset",
              "bg-white/15 text-white ring-white/30",
            )}
          >
            <Crown className="size-4" />
            {t(`tiers.${overview.tier}`)}
            {overview.tierBonusPercent > 0 ? (
              <span className="rounded-full bg-[var(--highlight)] px-1.5 text-[11px] text-[#3b2410]">
                +{overview.tierBonusPercent}%
              </span>
            ) : null}
          </span>
        </div>
        <div className="relative mt-5">
          <div className="h-2 overflow-hidden rounded-full bg-white/20">
            <div className="h-full rounded-full bg-[var(--highlight)]" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-2 text-xs text-white/85">
            {overview.next
              ? t("toNext", { points: number(overview.next.remaining), tier: t(`tiers.${overview.next.tier}`) })
              : t("topTier")}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="size-4.5 text-primary" />
              {t("redeemTitle")}
            </CardTitle>
            <CardDescription>
              {t("redeemRate", { points: number(rules.redeemPoints), credit: money(rules.redeemValue) })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {canRedeem ? (
              <>
                <div className="flex items-center justify-between gap-3 rounded-2xl border p-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t("less")}
                    disabled={points <= rules.minRedeemPoints || busy}
                    onClick={() => setChosen(Math.max(rules.minRedeemPoints, points - step))}
                  >
                    <Minus className="size-4" />
                  </Button>
                  <div className="text-center">
                    <p className="text-2xl font-bold tabular-nums">{number(points)}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("becomes", { credit: money(pointsToCredit(points, rules)) })}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t("more")}
                    disabled={points + step > overview.redeemable || busy}
                    onClick={() => setChosen(Math.min(overview.redeemable, points + step))}
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
                <Button type="button" className="h-11 w-full rounded-xl" disabled={busy} onClick={() => void redeem()}>
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <Gift className="size-4" />}
                  {t("redeemButton", { credit: money(pointsToCredit(points, rules)) })}
                </Button>
                <p className="text-xs text-muted-foreground">
                  {rules.creditExpiryDays > 0
                    ? t("creditExpires", { days: number(rules.creditExpiryDays) })
                    : t("creditNoExpiry")}{" "}
                  <Link href="/account/store-credit" className="font-medium text-primary hover:underline">
                    {t("seeCredit")}
                  </Link>
                </p>
              </>
            ) : (
              <p className="rounded-2xl bg-muted/60 p-4 text-sm text-muted-foreground">
                {t("notEnough", {
                  points: number(Math.max(0, rules.minRedeemPoints - overview.balance)),
                  minimum: number(rules.minRedeemPoints),
                })}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="size-4.5 text-primary" />
              {t("howTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm">
              <li className="flex gap-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                {t("howEarn", { spend: money(rules.spendPerPoint) })}
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                {t("howRedeem", { points: number(rules.redeemPoints), credit: money(rules.redeemValue) })}
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                {t("howRefund")}
              </li>
            </ul>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(["bronze", "silver", "gold", "platinum"] as const).map((tier) => (
                <div
                  key={tier}
                  className={cn(
                    "rounded-xl px-2.5 py-2 text-center ring-1 ring-inset",
                    TIER_STYLE[tier],
                    tier === overview.tier && "ring-2",
                  )}
                >
                  <p className="text-xs font-bold">{t(`tiers.${tier}`)}</p>
                  <p className="text-[11px] opacity-80">
                    {tier === "bronze"
                      ? t("tierStart")
                      : t("tierAt", { points: number(overview.thresholds[tier]) })}
                  </p>
                  <p className="text-[11px] font-semibold">
                    {tier === "bronze" ? t("tierBase") : `+${rules.tierBonus[tier]}%`}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("historyTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          {overview.history.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t("historyEmpty")}</p>
          ) : (
            <ul className="divide-y">
              {overview.history.map((row) => {
                const gain = row.points > 0;
                return (
                  <li key={row.id} className="flex items-center gap-3 py-3">
                    <span
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-xl",
                        gain ? "bg-emerald-500/10 text-emerald-600" : "bg-primary/10 text-primary",
                      )}
                    >
                      {gain ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {row.orderId && row.type !== "redeem" ? (
                          <Link href={`/account/orders/${row.orderId}`} className="hover:underline">
                            {describe(row)}
                          </Link>
                        ) : (
                          describe(row)
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(row.createdAt).toLocaleDateString(locale, {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                        {row.bonusPercent ? ` · ${t("history.bonus", { percent: row.bonusPercent })}` : ""}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 text-sm font-bold tabular-nums",
                        gain ? "text-emerald-600" : "text-foreground",
                      )}
                    >
                      {gain ? "+" : ""}
                      {number(row.points)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
