import { Suspense } from "react";
import {
  BadgeCheck,
  Clock3,
  HandCoins,
  PackageCheck,
  ReceiptText,
} from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { VENDOR_PERMISSIONS } from "@/config/permissions.config";
import { requireVendorAreaAccess } from "@/lib/access/vendor-area-guard";
import { requireApprovedVendorByUserId } from "@/lib/access/vendor-guard";
import {
  VendorOrdersBoard,
  VendorOrdersBoardSkeleton,
} from "@/components/vendor/orders/vendor-orders-board";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { parsePageQuery } from "@/lib/api/validate";
import { serializeRows } from "@/lib/api/list-query";
import { OrderListQuerySchema } from "@/lib/validations";
import { fetchVendorOrderList } from "@/lib/vendors/vendor-order-list";
import { getVendorOrderTotals } from "@/lib/vendors/vendor-order-metrics";
import { getStoreMoneyFormatter } from "@/lib/intl/server-currency";

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

interface VendorOrdersStats {
  totalOrders: number;
  openOrders: number;
  paidOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
}

export default async function VendorOrdersPage({
  params,
  searchParams,
}: PageProps) {
  const { locale } = await params;
  const search = await searchParams;
  setRequestLocale(locale);
  const access = await requireVendorAreaAccess({
    locale,
    required: [VENDOR_PERMISSIONS.VIEW_ORDERS],
  });
  const vendor = await requireApprovedVendorByUserId(access.session.user.id);
  const canEditOrder =
    access.vendorPermissions.includes(VENDOR_PERMISSIONS.MANAGE_ORDERS) ||
    access.vendorPermissions.includes(VENDOR_PERMISSIONS.EDIT_ORDERS);
  const canDeleteOrder =
    access.vendorPermissions.includes(VENDOR_PERMISSIONS.MANAGE_ORDERS) ||
    access.vendorPermissions.includes(VENDOR_PERMISSIONS.DELETE_ORDERS);
  const canCreateOrder =
    access.vendorPermissions.includes(VENDOR_PERMISSIONS.MANAGE_ORDERS) ||
    access.vendorPermissions.includes(VENDOR_PERMISSIONS.CREATE_ORDERS);

  // Started once: the tiles stream on their own beside the order list.
  const statsPromise = Promise.all([getVendorOrdersStats(String(vendor._id)), getStoreMoneyFormatter()]);

  return (
    <div className="space-y-5">
      <Suspense fallback={<OrderStatsSkeleton />}>
        <OrderStatsSection statsPromise={statsPromise} locale={locale} />
      </Suspense>
      <Suspense fallback={<VendorOrdersBoardSkeleton />}>
        <VendorOrdersTableSection
          locale={locale}
          searchParams={search}
          vendorId={String(vendor._id)}
          canEditOrder={canEditOrder}
          canDeleteOrder={canDeleteOrder}
          canCreateOrder={canCreateOrder}
        />
      </Suspense>
    </div>
  );
}

async function OrderStatsSection({
  statsPromise,
  locale,
}: {
  statsPromise: Promise<[VendorOrdersStats, (amount: number) => string]>;
  locale: string;
}) {
  const [[stats, formatCurrency], t] = await Promise.all([
    statsPromise,
    getTranslations({ locale, namespace: "admin.hc.vendorOrders" }),
  ]);
  const number = new Intl.NumberFormat(locale);
  const tiles = [
    { key: "total", value: number.format(stats.totalOrders), icon: ReceiptText, tone: "from-slate-50 ring-slate-200 text-slate-700 dark:from-slate-500/10", iconTone: "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900" },
    { key: "open", value: number.format(stats.openOrders), icon: Clock3, tone: "from-amber-50 ring-amber-200 text-amber-700 dark:from-amber-500/10", iconTone: "bg-amber-500 text-white" },
    { key: "paid", value: number.format(stats.paidOrders), icon: BadgeCheck, tone: "from-emerald-50 ring-emerald-200 text-emerald-700 dark:from-emerald-500/10", iconTone: "bg-emerald-500 text-white" },
    { key: "revenue", value: formatCurrency(stats.totalRevenue), icon: HandCoins, tone: "from-violet-50 ring-violet-200 text-violet-700 dark:from-violet-500/10", iconTone: "bg-violet-500 text-white" },
    { key: "average", value: formatCurrency(stats.averageOrderValue), icon: PackageCheck, tone: "from-sky-50 ring-sky-200 text-sky-700 dark:from-sky-500/10", iconTone: "bg-sky-500 text-white" },
  ] as const;
  return (
    <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 sm:pb-0 xl:grid-cols-5 [&::-webkit-scrollbar]:hidden">
      {tiles.map(({ key, value, icon: Icon, tone, iconTone }) => (
        <div key={key} className={cn("flex min-w-[10rem] shrink-0 snap-start items-center gap-3 rounded-2xl bg-linear-to-br to-white p-3 ring-1 ring-inset sm:min-w-0 sm:p-4 dark:to-card", tone)}>
          <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl shadow-sm sm:size-10", iconTone)}>
            <Icon className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium opacity-80">{t(`stat.${key}`)}</p>
            <p className="truncate text-lg font-extrabold tracking-tight text-foreground tabular-nums sm:text-xl">{value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function OrderStatsSkeleton() {
  return (
    <div className="flex gap-3 overflow-hidden sm:grid sm:grid-cols-3 xl:grid-cols-5">
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} className="h-[64px] min-w-[10rem] rounded-2xl sm:h-[72px]" />
      ))}
    </div>
  );
}

/**
 * The strip's counters, from the module the vendor dashboard reads too — so
 * "Total Revenue" here and on the dashboard is one number.
 */
async function getVendorOrdersStats(vendorId: string): Promise<VendorOrdersStats> {
  const totals = await getVendorOrderTotals(vendorId);

  return {
    totalOrders: totals.totalOrders,
    openOrders: totals.openOrders,
    paidOrders: totals.paidOrders,
    totalRevenue: totals.totalRevenue,
    averageOrderValue:
      totals.paidOrders > 0 ? totals.totalRevenue / totals.paidOrders : 0,
  };
}

async function VendorOrdersTableSection({
  locale,
  searchParams,
  vendorId,
  canEditOrder,
  canDeleteOrder,
  canCreateOrder,
}: {
  locale: string;
  searchParams: { [key: string]: string | string[] | undefined };
  vendorId: string;
  canEditOrder: boolean;
  canDeleteOrder: boolean;
  canCreateOrder: boolean;
}) {
  // Parsed with the schema the API route uses, so the page and the endpoint
  // can never read one query string two different ways.
  const query = parsePageQuery(searchParams, OrderListQuerySchema);
  const view =
    typeof searchParams.view === "string" ? searchParams.view : "all";
  const list = await fetchVendorOrderList({ ...query, view }, vendorId);

  return (
    <VendorOrdersBoard
      canEditOrder={canEditOrder}
      canDeleteOrder={canDeleteOrder}
      canCreateOrder={canCreateOrder}
      data={serializeRows(list.items)}
      pagination={{
        page: list.page,
        limit: list.limit,
        total: list.total,
        totalPages: list.totalPages,
      }}
    />
  );
}
