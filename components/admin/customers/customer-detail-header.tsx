"use client";

import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Award,
  CalendarClock,
  CalendarDays,
  Clock,
  Mail,
  Phone,
  Receipt,
  ShoppingBag,
  Wallet,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrency } from "@/providers/currency-provider";
import { cn } from "@/lib/utils";
import { useLoyaltyEnabled } from "@/providers/app-settings-provider";
import { toneClass, type SectionTone } from "./section-card";
import type {
  CustomerHeaderData,
  CustomerStatus,
  LoyaltyTier,
} from "./customer-detail-types";

interface CustomerDetailHeaderProps {
  data: CustomerHeaderData;
  /** The phone shown in the contact row (from the form). */
  phone?: string;
  /** Skeletonize the identity block (avatar, name, badges, email). */
  loading?: boolean;
  /** Skeletonize only the KPI values. Defaults to `loading`. */
  statsLoading?: boolean;
  /** Buttons for the right of the identity row — the account email, today. */
  actions?: ReactNode;
}

function getInitials(name?: string) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return parts
    .map((part) => Array.from(part)[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const STATUS_META: Record<CustomerStatus, { key: string; className: string; dot: string }> = {
  active: { key: "statusActive", className: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30", dot: "bg-emerald-500" },
  inactive: { key: "statusInactive", className: "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-500/10 dark:text-slate-300 dark:ring-slate-500/30", dot: "bg-slate-400" },
  banned: { key: "statusBanned", className: "bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/30", dot: "bg-red-500" },
};

const TIER_META: Record<LoyaltyTier, { key: string; className: string }> = {
  bronze: { key: "tierBronze", className: "bg-amber-700/10 text-amber-800 ring-amber-700/20 dark:text-amber-400" },
  silver: { key: "tierSilver", className: "bg-slate-400/15 text-slate-700 ring-slate-400/30 dark:text-slate-300" },
  gold: { key: "tierGold", className: "bg-yellow-400/20 text-yellow-800 ring-yellow-500/30 dark:text-yellow-400" },
  platinum: { key: "tierPlatinum", className: "bg-indigo-500/15 text-indigo-700 ring-indigo-500/30 dark:text-indigo-300" },
};

/** "3 days ago" style, in the admin's language. */
export function useRelativeDate() {
  const t = useTranslations("admin.hc.customerDetail");
  return (date?: string) => {
    if (!date) return "—";
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return "—";
    const days = Math.floor((Date.now() - parsed.getTime()) / 86_400_000);
    if (days <= 0) return t("relToday");
    if (days === 1) return t("relYesterday");
    if (days < 7) return t("relDays", { count: days });
    if (days < 30) return t("relWeeks", { count: Math.floor(days / 7) });
    if (days < 365) return t("relMonths", { count: Math.floor(days / 30) });
    return t("relYears", { count: Math.floor(days / 365) });
  };
}

function KpiTile({
  icon: Icon,
  tone,
  label,
  value,
  loading,
}: {
  icon: typeof Wallet;
  tone: SectionTone;
  label: string;
  value: string;
  loading?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border bg-background/60 p-3.5">
      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", toneClass(tone))}>
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
        {loading ? (
          <Skeleton className="mt-1 h-5 w-16" />
        ) : (
          <p className="truncate text-lg font-bold tabular-nums leading-tight">{value}</p>
        )}
      </div>
    </div>
  );
}

export function CustomerDetailHeader({
  data,
  phone,
  loading = false,
  statsLoading,
  actions,
}: CustomerDetailHeaderProps) {
  const t = useTranslations("admin.hc.customerDetail");
  const locale = useLocale();
  const relative = useRelativeDate();
  const { formatPrice } = useCurrency();
  const status = STATUS_META[data.status] ?? STATUS_META.active;
  const tier = TIER_META[data.loyaltyTier] ?? TIER_META.bronze;
  // The tier badge and the points tile hide with the rest of loyalty (see
  // `useLoyaltyEnabled`).
  const loyaltyEnabled = useLoyaltyEnabled();
  const stats = data.stats || {};
  const kpiLoading = statsLoading ?? loading;
  const since = data.createdAt
    ? new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(data.createdAt))
    : null;

  return (
    <div className="overflow-hidden rounded-3xl border bg-card shadow-sm">
      {/* Banner */}
      <div className="relative h-24 bg-linear-to-r from-emerald-500/20 via-teal-400/15 to-sky-400/20 sm:h-28">
        <span
          aria-hidden
          className="absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_1px_1px,rgba(15,118,110,0.25)_1px,transparent_0)] [background-size:18px_18px]"
        />
      </div>

      <div className="px-5 pb-5 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 items-end gap-4">
            {loading ? (
              <Skeleton className="-mt-10 size-20 shrink-0 rounded-2xl ring-4 ring-card" />
            ) : (
              <Avatar className="-mt-10 size-20 shrink-0 rounded-2xl shadow-md ring-4 ring-card">
                <AvatarImage src={data.image} alt={data.name || ""} className="rounded-2xl" />
                <AvatarFallback className="rounded-2xl bg-linear-to-br from-emerald-500 to-teal-600 text-2xl font-bold text-white">
                  {getInitials(data.name)}
                </AvatarFallback>
              </Avatar>
            )}
            <div className="min-w-0 pb-0.5">
              {loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-7 w-48" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-2xl font-bold tracking-tight">
                    {data.name || t("unknownCustomer")}
                  </h2>
                  <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset", status.className)}>
                    <span className={cn("size-1.5 rounded-full", status.dot)} />
                    {t(status.key)}
                  </span>
                  {loyaltyEnabled ? (
                    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset", tier.className)}>
                      <Award className="size-3.5" />
                      {t(tier.key)}
                    </span>
                  ) : null}
                </div>
              )}
            </div>
          </div>
          {actions && !loading ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
          ) : null}
        </div>

        {!loading ? (
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            {data.email ? (
              <a
                href={`mailto:${data.email}`}
                className="inline-flex max-w-full items-center gap-1.5 rounded-full border bg-background px-3 py-1 text-muted-foreground transition-colors hover:text-foreground"
              >
                <Mail className="size-3.5 shrink-0" />
                <span className="truncate">{data.email}</span>
              </a>
            ) : null}
            {phone ? (
              <a
                href={`tel:${phone.replace(/\s+/g, "")}`}
                className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1 text-muted-foreground transition-colors hover:text-foreground"
              >
                <Phone className="size-3.5" />
                {phone}
              </a>
            ) : null}
            {since ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1 text-muted-foreground">
                <CalendarDays className="size-3.5" />
                {t("customerSince", { date: since })}
              </span>
            ) : null}
            {data.lastActiveAt ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1 text-muted-foreground">
                <Clock className="size-3.5" />
                {t("lastActive", { when: relative(data.lastActiveAt) })}
              </span>
            ) : null}
          </div>
        ) : null}

        <div
          className={cn(
            "mt-5 grid grid-cols-2 gap-3",
            loyaltyEnabled ? "lg:grid-cols-5" : "lg:grid-cols-4",
          )}
        >
          <KpiTile icon={Wallet} tone="emerald" label={t("kpiTotalSpent")} value={formatPrice(stats.totalSpent ?? 0)} loading={kpiLoading} />
          <KpiTile icon={ShoppingBag} tone="sky" label={t("kpiOrders")} value={(stats.totalOrders ?? 0).toLocaleString(locale)} loading={kpiLoading} />
          <KpiTile icon={Receipt} tone="violet" label={t("kpiAvgOrder")} value={formatPrice(stats.averageOrderValue ?? 0)} loading={kpiLoading} />
          <KpiTile
            icon={CalendarClock}
            tone="amber"
            label={t("kpiLastOrder")}
            value={stats.lastOrderDate ? relative(stats.lastOrderDate) : t("never")}
            loading={kpiLoading}
          />
          {loyaltyEnabled ? (
            <KpiTile icon={Award} tone="rose" label={t("kpiPoints")} value={(data.loyaltyPoints ?? 0).toLocaleString(locale)} loading={kpiLoading} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
