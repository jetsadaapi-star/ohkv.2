"use client";

import Image from "next/image";
import {
  AlertCircle,
  BadgeCheck,
  CalendarDays,
  ExternalLink,
  Mail,
  MapPin,
  Package,
  Percent,
  Phone,
  ShoppingBag,
  Store,
  UserRound,
  Wallet,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrency } from "@/providers/currency-provider";
import { VENDOR_STATUS } from "@/config/app.config";
import { kalasinDistrictLabel } from "@/config/kalasin-districts";
import { toneClass, type SectionTone } from "@/components/admin/customers/section-card";
import { cn } from "@/lib/utils";
import type { VendorHeaderData, VendorStats } from "./vendor-detail-types";

interface VendorDetailHeaderProps {
  data: VendorHeaderData;
  /** Commerce counts, loaded independently of the identity block. */
  stats: VendorStats | null;
  /** Live commission from the vendor form, so the KPI tracks unsaved edits. */
  commission?: number;
  /** Live verification flag from the form, for the same reason as commission. */
  verified?: boolean;
  /** Live values from the form for the identity block. */
  banner?: string;
  logo?: string;
  district?: string;
  ownerName?: string;
  phone?: string;
  /** Skeletonize the identity block (logo, store name, status, owner email). */
  loading?: boolean;
  /** Skeletonize only the KPI values. Defaults to `loading`. */
  statsLoading?: boolean;
  /** Set when the stats request failed, so zeros aren't shown as fact. */
  statsError?: boolean;
  /** Buttons for the right of the identity row. */
  actions?: React.ReactNode;
}

const STATUS_META: Record<string, { labelKey: string; className: string; dot: string }> = {
  [VENDOR_STATUS.APPROVED]: {
    labelKey: "statusApproved",
    className: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30",
    dot: "bg-emerald-500",
  },
  [VENDOR_STATUS.PENDING]: {
    labelKey: "statusPending",
    className: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30",
    dot: "bg-amber-500",
  },
  [VENDOR_STATUS.PAYMENT_REQUIRED]: {
    labelKey: "statusPaymentRequired",
    className: "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500/30",
    dot: "bg-blue-500",
  },
  [VENDOR_STATUS.SUSPENDED]: {
    labelKey: "statusSuspended",
    className: "bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/30",
    dot: "bg-red-500",
  },
  [VENDOR_STATUS.REJECTED]: {
    labelKey: "statusRejected",
    className: "bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/30",
    dot: "bg-red-500",
  },
};

function KpiTile({
  icon: Icon,
  tone,
  label,
  value,
  hint,
  loading,
  unavailable,
}: {
  icon: typeof Wallet;
  tone: SectionTone;
  label: string;
  value: string;
  /** Muted second line: what the headline figure leaves out. */
  hint?: string;
  loading?: boolean;
  /** Render a dash instead of a figure the request never delivered. */
  unavailable?: boolean;
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
          <p className="truncate text-lg font-bold leading-tight tabular-nums">{unavailable ? "—" : value}</p>
        )}
        {!loading && !unavailable && hint ? (
          <p className="truncate text-[11px] text-muted-foreground">{hint}</p>
        ) : null}
      </div>
    </div>
  );
}

function Chip({ icon: Icon, children, href }: { icon: typeof Mail; children: React.ReactNode; href?: string }) {
  const className =
    "inline-flex max-w-full items-center gap-1.5 rounded-full border bg-background px-3 py-1 text-sm text-muted-foreground";
  return href ? (
    <a href={href} className={cn(className, "transition-colors hover:text-foreground")}>
      <Icon className="size-3.5 shrink-0" />
      <span className="truncate">{children}</span>
    </a>
  ) : (
    <span className={className}>
      <Icon className="size-3.5 shrink-0" />
      <span className="truncate">{children}</span>
    </span>
  );
}

export function VendorDetailHeader({
  data,
  stats,
  commission,
  verified = false,
  banner,
  logo,
  district,
  ownerName,
  phone,
  loading = false,
  statsLoading,
  statsError = false,
  actions,
}: VendorDetailHeaderProps) {
  const t = useTranslations("admin.hc.vendorDetailHeader");
  const tv = useTranslations("admin.hc.vendorPage");
  const locale = useLocale();
  const { formatPrice } = useCurrency();
  const status = STATUS_META[data.status] ?? STATUS_META[VENDOR_STATUS.PENDING];
  const kpiLoading = statsLoading ?? loading;
  const counts = stats ?? {};
  const cancelledCount = counts.cancelledOrderCount ?? 0;
  const logoUrl = logo ?? data.logo;
  const since = data.createdAt
    ? new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(data.createdAt))
    : null;

  return (
    <div className="overflow-hidden rounded-3xl border bg-card shadow-sm">
      {/* Banner: the store's own, or a soft pattern */}
      <div className="relative h-28 bg-linear-to-r from-emerald-500/20 via-teal-400/15 to-amber-300/25 sm:h-36">
        {banner ? (
          <Image src={banner} alt="" fill sizes="(min-width:1024px) 1100px, 100vw" className="object-cover" />
        ) : (
          <span
            aria-hidden
            className="absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_1px_1px,rgba(15,118,110,0.25)_1px,transparent_0)] [background-size:18px_18px]"
          />
        )}
        {data.slug && !loading ? (
          <a
            href={`/vendors/${data.slug}`}
            target="_blank"
            rel="noreferrer"
            className="absolute end-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-sm backdrop-blur transition-colors hover:bg-white"
          >
            <ExternalLink className="size-3.5" />
            {tv("viewStorefront")}
          </a>
        ) : null}
      </div>

      <div className="px-5 pb-5 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 items-end gap-4">
            {loading ? (
              <Skeleton className="-mt-10 size-20 shrink-0 rounded-2xl ring-4 ring-card" />
            ) : (
              <div className="relative -mt-10 flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border bg-white shadow-md ring-4 ring-card">
                {logoUrl ? (
                  <Image src={logoUrl} alt={data.storeName || t("storeAlt")} fill sizes="80px" className="object-contain p-1" />
                ) : (
                  <Store className="size-8 text-muted-foreground" />
                )}
              </div>
            )}
            <div className="min-w-0 pb-0.5">
              {loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-7 w-48" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-2xl font-bold tracking-tight">{data.storeName || t("unknownStore")}</h2>
                  <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset", status.className)}>
                    <span className={cn("size-1.5 rounded-full", status.dot)} />
                    {t(status.labelKey)}
                  </span>
                  {/* Mirrors the storefront badge, and tracks the Profile switch live. */}
                  {verified ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-semibold text-sky-700 ring-1 ring-inset ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/30">
                      <BadgeCheck className="size-3.5" />
                      {t("verified")}
                    </span>
                  ) : null}
                </div>
              )}
            </div>
          </div>
          {actions && !loading ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
        </div>

        {!loading ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {district ? <Chip icon={MapPin}>{kalasinDistrictLabel(district, locale)}</Chip> : null}
            {ownerName ? <Chip icon={UserRound}>{ownerName}</Chip> : null}
            {data.ownerEmail ? <Chip icon={Mail} href={`mailto:${data.ownerEmail}`}>{data.ownerEmail}</Chip> : null}
            {phone ? <Chip icon={Phone} href={`tel:${phone.replace(/\s+/g, "")}`}>{phone}</Chip> : null}
            {since ? <Chip icon={CalendarDays}>{tv("joinedOn", { date: since })}</Chip> : null}
          </div>
        ) : null}

        {statsError && !kpiLoading ? (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-destructive/5 px-3 py-2 text-xs text-destructive">
            <AlertCircle className="size-3.5 shrink-0" />
            {t("statsError")}
          </div>
        ) : null}

        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiTile
            icon={Package}
            tone="sky"
            label={t("products")}
            value={(counts.productCount ?? 0).toLocaleString(locale)}
            loading={kpiLoading}
            unavailable={statsError && counts.productCount === undefined}
          />
          <KpiTile
            icon={ShoppingBag}
            tone="violet"
            label={t("orders")}
            value={(counts.orderCount ?? 0).toLocaleString(locale)}
            hint={cancelledCount > 0 ? t("cancelledCount", { count: cancelledCount }) : undefined}
            loading={kpiLoading}
            unavailable={statsError && counts.orderCount === undefined}
          />
          <KpiTile
            icon={Wallet}
            tone="emerald"
            label={t("totalSales")}
            value={formatPrice(counts.totalSales ?? 0)}
            loading={kpiLoading}
            unavailable={statsError && counts.totalSales === undefined}
          />
          <KpiTile icon={Percent} tone="amber" label={t("commission")} value={`${commission ?? 0}%`} loading={loading} />
        </div>
      </div>
    </div>
  );
}
