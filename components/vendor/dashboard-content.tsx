"use client";

import Link from "@/components/language/link";
import { AppImage } from "@/components/ui/app-image";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  ClipboardList,
  DollarSign,
  FileText,
  Heart,
  LayoutDashboard,
  Package,
  PackageCheck,
  PackageX,
  ShoppingCart,
  Plus,
  TrendingUp,
  Truck,
  Undo2,
  ChevronRight,
  Settings,
  User,
} from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { VendorPageHeader } from "@/components/vendor/vendor-page-header";
import type { StatusHue } from "@/components/vendor/status-tone";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/providers/currency-provider";
import { DashboardOrdersChart } from "@/components/admin/dashboard-orders-chart";
import { DashboardPeriodPicker } from "@/components/admin/dashboard-period-picker";
import {
  OrdersChartSkeleton,
  RecentOrdersSkeleton,
} from "@/components/admin/dashboard-skeleton";
import { getPaymentMethodMeta } from "@/components/common/payment-method-meta";
import { VendorFulfillmentBadge } from "@/components/vendor/vendor-fulfillment-badge";
import { truncateByWords } from "@/lib/utils";
import type {
  VendorAttention,
  VendorDashboardData,
  VendorRecentOrder,
} from "@/lib/vendors/vendor-dashboard-types";

/** The page's resolved period (`resolveDashboardPeriod`), as the picker takes it. */
interface VendorDashboardPeriod {
  /** A named period, or "custom" when dates were picked. */
  key: string;
  /** "YYYY-MM-DD" bounds, empty for "All time". */
  from: string;
  to: string;
}

/** What `GET /api/vendor/analytics` reads the period from. */
function periodQuery({ key, from, to }: VendorDashboardPeriod) {
  return (
    key === "custom"
      ? new URLSearchParams({ from, to })
      : new URLSearchParams({ period: key })
  ).toString();
}

/**
 * The vendor's dashboard. Every figure comes from `GET /api/vendor/analytics`,
 * which reads the same module (`lib/vendors/vendor-order-metrics.ts`) as the
 * vendor orders page, so the cards, the chart and the recent orders agree with
 * the order list rather than each computing their own version of it.
 *
 * The period picker is the admin dashboard's, and holds the period in the URL
 * the same way; the cards and the chart follow it, the recent orders do not.
 */
export function VendorDashboardContent({
  setupMode = false,
  period,
}: {
  setupMode?: boolean;
  period: VendorDashboardPeriod;
}) {
  const t = useTranslations();
  const th = useTranslations("admin.hc.vendorDashboardContent");
  const intlLocale = useLocale();
  const params = useParams();
  const locale = (params.locale as string) || intlLocale || "en";
  const { formatPrice } = useCurrency();

  const query = periodQuery(period);
  // The last response and the period it answered, so a period change can tell
  // "still loading the new one" from "loaded" without a loading flag to reset.
  const [loaded, setLoaded] = useState<{
    query: string;
    data: VendorDashboardData | null;
  } | null>(null);

  useEffect(() => {
    if (setupMode) return;
    let cancelled = false;
    async function fetchAnalytics() {
      let data: VendorDashboardData | null = null;
      try {
        const res = await fetch(`/api/vendor/analytics?${query}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success) {
            data = json.data;
          }
        }
      } catch (error) {
        console.error("Failed to fetch analytics:", error);
      }
      // A slower answer to a period the vendor has already moved off.
      if (!cancelled) setLoaded({ query, data });
    }
    fetchAnalytics();
    return () => {
      cancelled = true;
    };
  }, [setupMode, query]);

  if (setupMode) {
    const setupActions = [
      {
        href: "/vendor/products/new",
        icon: <Plus className="size-5" />,
        title: th("addProductTitle"),
        description: th("addProductDescription"),
      },
      {
        href: "/vendor/products",
        icon: <Package className="size-5" />,
        title: th("prepareCatalogTitle"),
        description: th("prepareCatalogDescription"),
      },
      {
        href: "/vendor/settings",
        icon: <Settings className="size-5" />,
        title: th("configureStoreTitle"),
        description: th("configureStoreDescription"),
      },
    ];

    return (
      <div className="space-y-6">
        <VendorPageHeader
          icon={<Settings />}
          title={th("setupTitle")}
          description={th("setupDescription")}
        />
        <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <div className="border-b bg-linear-to-r from-emerald-50 to-white px-5 py-4 dark:from-emerald-500/10 dark:to-card">
            <h3 className="font-bold text-foreground">{th("setupChecklist")}</h3>
          </div>
          <ol className="divide-y">
            {setupActions.map((action, index) => (
              <li key={action.href}>
                <Link
                  href={action.href}
                  className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-emerald-50/50 dark:hover:bg-emerald-500/5"
                >
                  <span className="relative flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                    {action.icon}
                    <span className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-bold text-white ring-2 ring-card">
                      {index + 1}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-foreground">
                      {action.title}
                    </span>
                    <span className="mt-0.5 block text-sm leading-5 text-muted-foreground">
                      {action.description}
                    </span>
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ol>
        </section>
      </div>
    );
  }

  // The answer to THIS period, if it has come. Until then the cards and the
  // chart show their skeletons; the header stays mounted so the open picker
  // does not vanish under the click that changed it.
  const current = loaded?.query === query ? loaded : null;
  const data = current?.data ?? null;
  // Not period-driven, so the last answer keeps them on screen meanwhile.
  const recentOrders = (current ?? loaded)?.data?.recentOrders;

  const stats = data?.stats;
  const tiles: StatTile[] = stats
    ? [
        {
          id: "revenue",
          label: t("vendor.totalRevenue"),
          value: formatPrice(stats.totalRevenue),
          icon: <DollarSign />,
          hue: "emerald",
          // Revenue is money collected. What unpaid orders are still worth sits
          // beside it, so an order awaiting cash on delivery is not just missing.
          subLabel:
            stats.awaitingPayment > 0
              ? t("vendor.awaitingPayment", { amount: formatPrice(stats.awaitingPayment) })
              : undefined,
        },
        {
          id: "net",
          label: t("vendor.netEarnings"),
          value: formatPrice(stats.netEarnings),
          icon: <TrendingUp />,
          hue: "teal",
        },
        {
          id: "orders",
          label: t("vendor.totalOrders"),
          value: stats.totalOrders.toLocaleString(locale),
          icon: <ShoppingCart />,
          hue: "sky",
          // The orders page's "Open Orders" figure.
          subLabel:
            stats.openOrders > 0
              ? t("vendor.openOrdersCount", { count: stats.openOrders.toLocaleString(locale) })
              : undefined,
        },
        {
          id: "products",
          label: t("vendor.activeProducts"),
          value: stats.activeProducts.toLocaleString(locale),
          icon: <Package />,
          hue: "violet",
        },
        ...(stats.followers !== undefined
          ? [
              {
                id: "followers",
                label: t("vendor.followers"),
                value: stats.followers.toLocaleString(locale),
                icon: <Heart />,
                hue: "rose" as const,
              },
            ]
          : []),
      ]
    : [];

  return (
    <div className="space-y-5">
      <VendorPageHeader
        icon={<LayoutDashboard />}
        title={t("common.dashboard")}
        description={t("vendor.dashboardSubtitle")}
        actions={
          <>
            <DashboardPeriodPicker period={period.key} from={period.from} to={period.to} />
            <Button asChild variant="outline" className="rounded-full">
              <Link href="/vendor/orders">
                <ShoppingCart className="h-4 w-4" />
                {t("vendor.viewOrders")}
              </Link>
            </Button>
            <Button asChild className="rounded-full bg-emerald-600 text-white hover:bg-emerald-700">
              <Link href="/vendor/products/new">
                <Plus className="h-4 w-4" />
                {t("vendor.addProduct")}
              </Link>
            </Button>
          </>
        }
      />

      {current && !data ? (
        <div className="rounded-2xl border border-dashed py-12 text-center text-muted-foreground">
          {t("vendor.unableToLoadData")}
        </div>
      ) : (
        <>
          {data ? <StatTiles tiles={tiles} /> : <StatTilesSkeleton />}

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0">
              {data ? <DashboardOrdersChart series={data.chart} area="vendor" /> : <OrdersChartSkeleton />}
            </div>
            {/* First on a phone: what is waiting matters more than the chart. */}
            <div className="order-first space-y-5 xl:order-none">
              <AttentionPanel attention={(current ?? loaded)?.data?.attention} />
              <QuickActions />
            </div>
          </div>

          {recentOrders ? (
            <VendorRecentOrders orders={recentOrders} formatPrice={formatPrice} />
          ) : (
            <RecentOrdersSkeleton />
          )}
        </>
      )}
    </div>
  );
}

interface StatTile {
  id: string;
  label: string;
  value: string;
  icon: ReactNode;
  hue: "emerald" | "teal" | "sky" | "violet" | "rose";
  subLabel?: string;
}

const TILE_TONE: Record<StatTile["hue"], { tile: string; icon: string }> = {
  emerald: { tile: "from-emerald-50 ring-emerald-200 text-emerald-700 dark:from-emerald-500/10", icon: "bg-emerald-500" },
  teal: { tile: "from-teal-50 ring-teal-200 text-teal-700 dark:from-teal-500/10", icon: "bg-teal-500" },
  sky: { tile: "from-sky-50 ring-sky-200 text-sky-700 dark:from-sky-500/10", icon: "bg-sky-500" },
  violet: { tile: "from-violet-50 ring-violet-200 text-violet-700 dark:from-violet-500/10", icon: "bg-violet-500" },
  rose: { tile: "from-rose-50 ring-rose-200 text-rose-700 dark:from-rose-500/10", icon: "bg-rose-500" },
};

/** The period's figures: one colourful tile each, a swipeable row on phones. */
function StatTiles({ tiles }: { tiles: StatTile[] }) {
  return (
    <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-[repeat(auto-fit,minmax(12rem,1fr))] sm:overflow-visible sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden">
      {tiles.map((tile) => {
        const tone = TILE_TONE[tile.hue];
        return (
          <div
            key={tile.id}
            className={cn(
              "flex min-w-[11rem] shrink-0 snap-start flex-col gap-3 rounded-2xl bg-linear-to-br to-white p-4 ring-1 ring-inset sm:min-w-0 dark:to-card",
              tone.tile,
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-xs font-semibold opacity-90">{tile.label}</p>
              <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg text-white shadow-sm [&_svg]:size-4", tone.icon)}>
                {tile.icon}
              </span>
            </div>
            <div className="min-w-0">
              <p className="truncate text-2xl font-extrabold tracking-tight text-foreground tabular-nums">{tile.value}</p>
              <p className="mt-0.5 h-4 truncate text-xs text-muted-foreground">{tile.subLabel ?? ""}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StatTilesSkeleton() {
  return (
    <div className="flex gap-3 overflow-hidden sm:grid sm:grid-cols-[repeat(auto-fit,minmax(12rem,1fr))]">
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} className="h-[108px] min-w-[11rem] rounded-2xl" />
      ))}
    </div>
  );
}

/**
 * What is waiting on the vendor now, each row opening the list that holds it
 * already filtered. Rows with nothing waiting fall quiet; with nothing at all
 * the panel says so instead of listing zeros.
 */
function AttentionPanel({ attention }: { attention?: VendorAttention }) {
  const t = useTranslations("admin.hc.vendorHome.attention");
  const rows: Array<{ key: keyof VendorAttention; href: string; icon: ReactNode; tone: string }> = [
    { key: "toFulfill", href: "/vendor/orders?view=unfulfilled", icon: <Truck />, tone: "bg-sky-500" },
    { key: "returnsToReview", href: "/vendor/returns", icon: <Undo2 />, tone: "bg-rose-500" },
    { key: "quotesToReply", href: "/vendor/quotes?stage=needs_reply", icon: <FileText />, tone: "bg-amber-500" },
    { key: "lowStock", href: "/vendor/products?stock=low", icon: <AlertTriangle />, tone: "bg-orange-500" },
    { key: "outOfStock", href: "/vendor/products?stock=out", icon: <PackageX />, tone: "bg-slate-600" },
  ];
  const waiting = attention ? rows.filter((row) => attention[row.key] > 0) : [];

  return (
    <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <h3 className="flex items-center gap-2 font-bold text-foreground">
          <ClipboardList className="size-4 text-emerald-600" />
          {t("title")}
        </h3>
        {attention && waiting.length > 0 ? (
          <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
            {waiting.reduce((sum, row) => sum + attention[row.key], 0).toLocaleString()}
          </span>
        ) : null}
      </div>
      {!attention ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-11 rounded-xl" />
          ))}
        </div>
      ) : waiting.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15">
            <CheckCircle2 className="size-6" />
          </span>
          <p className="font-semibold text-foreground">{t("allClear")}</p>
          <p className="text-xs text-muted-foreground">{t("allClearHint")}</p>
        </div>
      ) : (
        <ul className="divide-y">
          {waiting.map((row) => (
            <li key={row.key}>
              <Link
                href={row.href}
                className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
              >
                <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl text-white shadow-sm [&_svg]:size-4", row.tone)}>
                  {row.icon}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{t(row.key)}</span>
                <span className="text-lg font-extrabold tabular-nums text-foreground">
                  {attention[row.key].toLocaleString()}
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function QuickActions() {
  const t = useTranslations("admin.hc.vendorHome.quick");
  const actions = [
    { href: "/vendor/products/new", label: t("addProduct"), icon: <Plus />, tone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
    { href: "/vendor/orders/create", label: t("createOrder"), icon: <ShoppingCart />, tone: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300" },
    { href: "/vendor/inventory", label: t("inventory"), icon: <Boxes />, tone: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300" },
    { href: "/vendor/settings", label: t("settings"), icon: <Settings />, tone: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
  ];
  return (
    <section className="rounded-2xl border bg-card p-4 shadow-sm">
      <h3 className="mb-3 font-bold text-foreground">{t("title")}</h3>
      <div className="grid grid-cols-2 gap-2">
        {actions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="flex flex-col items-center gap-2 rounded-xl border bg-background px-2 py-3 text-center text-xs font-semibold text-foreground transition-colors hover:border-emerald-300 hover:bg-emerald-50/50 dark:hover:bg-emerald-500/5"
          >
            <span className={cn("flex size-9 items-center justify-center rounded-xl [&_svg]:size-4", action.tone)}>
              {action.icon}
            </span>
            {action.label}
          </Link>
        ))}
      </div>
    </section>
  );
}

/** A consignment's colour: waiting warm, moving blue, done green. */
function orderHue(status: string): StatusHue {
  switch (status) {
    case "pending":
      return "amber";
    case "processing":
      return "sky";
    case "shipped":
      return "indigo";
    case "delivered":
      return "emerald";
    case "cancelled":
      return "slate";
    default:
      return "violet";
  }
}

function VendorRecentOrders({
  orders,
  formatPrice,
}: {
  orders: VendorRecentOrder[];
  formatPrice: (amount: number) => string;
}) {
  const t = useTranslations();

  return (
    <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-lg font-bold tracking-tight text-foreground">
          {t("vendor.recentOrders")}
        </h3>
        <Link
          href="/vendor/orders"
          className="inline-flex items-center gap-0.5 rounded-full px-2 py-1 text-sm font-medium text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
        >
          {t("admin.dashboardPage.viewAllOrders")}
          <ChevronRight className="size-4" />
        </Link>
      </div>

      <div className="mt-4 space-y-2.5">
        {orders.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-muted-foreground">
            {t("admin.dashboardPage.noRecentOrders")}
          </div>
        ) : (
          orders.map((order) => (
            <VendorRecentOrderCard
              key={order._id}
              order={order}
              formatPrice={formatPrice}
            />
          ))
        )}
      </div>
    </section>
  );
}

/**
 * One recent order, showing what the vendor order list shows for the same
 * order: this vendor's lines and quantity, the customer, the consignment's
 * fulfilment badge and the "Net sales" figure.
 */
/** A recent order card's tint: the list rows' hue on a card's leading edge. */
const RECENT_TONE: Record<StatusHue, string> = {
  amber: "border-s-amber-400 bg-amber-50/50 dark:bg-amber-500/5",
  orange: "border-s-orange-400 bg-orange-50/50 dark:bg-orange-500/5",
  sky: "border-s-sky-400 bg-sky-50/50 dark:bg-sky-500/5",
  indigo: "border-s-indigo-400 bg-indigo-50/50 dark:bg-indigo-500/5",
  violet: "border-s-violet-400 bg-violet-50/50 dark:bg-violet-500/5",
  emerald: "border-s-emerald-400 bg-emerald-50/40 dark:bg-emerald-500/5",
  teal: "border-s-teal-400 bg-teal-50/40 dark:bg-teal-500/5",
  rose: "border-s-rose-400 bg-rose-50/40 dark:bg-rose-500/5",
  slate: "border-s-slate-300 bg-slate-50/60 dark:bg-slate-500/5",
};

export function VendorRecentOrderCard({
  order,
  formatPrice,
}: {
  order: VendorRecentOrder;
  formatPrice: (amount: number) => string;
}) {
  const t = useTranslations();
  const paymentMeta = getPaymentMethodMeta(t, order.paymentMethod);
  const productName = order.primaryItemName;
  const customerName = order.walkIn
    ? t("admin.orderDetails.walkInCustomer")
    : order.customerName || t("vendor.ordersTable.guest");
  const amountLabel = t("vendor.ordersTable.columns.netSales");
  const fallbackName = t("admin.dashboardPage.orderLabel", {
    orderNumber: order.orderNumber,
  });
  // The mobile layout gives the name a full-width row, so it can afford more
  // words than the narrow desktop column.
  const displayProductName = productName
    ? truncateByWords(productName, 5)
    : fallbackName;
  const mobileProductName = productName
    ? truncateByWords(productName, 8)
    : fallbackName;
  const qtyLabel = `${order.itemCount} ${
    order.itemCount === 1
      ? t("admin.dashboardPage.pc")
      : t("admin.dashboardPage.pcs")
  }`;

  return (
    <Link
      href={`/vendor/orders/${order._id}`}
      className={cn(
        "block rounded-xl border border-border border-s-4 px-4 py-3 transition-shadow hover:shadow-md sm:grid sm:grid-cols-2 sm:items-center sm:gap-4 lg:grid-cols-[minmax(260px,2.1fr)_1.1fr_0.6fr_0.8fr_1fr_0.7fr]",
        RECENT_TONE[orderHue(order.pickupStatus ? "" : order.status)],
      )}
    >
      {/* Mobile: compact summary — image + name + price on one row, then a
          single meta line. Replaces the six stacked label/value rows that the
          desktop grid collapses into below `sm`. */}
      <div className="sm:hidden">
        <div className="flex items-start gap-3">
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
            {order.primaryItemImage ? (
              <AppImage
                src={order.primaryItemImage}
                alt={productName || order.orderNumber}
                fill
                className="object-cover"
                sizes="48px"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
                <PackageCheck className="size-4" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <p className="line-clamp-2 min-w-0 text-sm font-medium leading-snug text-foreground">
                {mobileProductName}
              </p>
              <p className="shrink-0 text-base font-semibold text-foreground">
                {formatPrice(order.netSales)}
              </p>
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-xs text-muted-foreground">
                {order.orderNumber}
              </span>
              <VendorFulfillmentBadge
                status={order.status}
                pickupStatus={order.pickupStatus}
                className="px-1.5 py-0.5 text-[11px]"
              />
            </div>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <User className="size-3.5" />
            <span className="text-foreground">{customerName}</span>
          </span>
          <span aria-hidden="true">·</span>
          <span className="text-foreground">{qtyLabel}</span>
          <span aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-1">
            <paymentMeta.Icon className="size-3.5" />
            <span className="text-foreground">{paymentMeta.label}</span>
          </span>
        </div>
      </div>

      <div className="hidden items-center gap-3 sm:flex sm:col-span-2 lg:col-span-1">
        <div className="relative h-16 w-16 overflow-hidden rounded-lg border border-border bg-muted">
          {order.primaryItemImage ? (
            <AppImage
              src={order.primaryItemImage}
              alt={productName || order.orderNumber}
              fill
              className="object-cover"
              sizes="64px"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
              <PackageCheck className="size-5" />
            </div>
          )}
        </div>
        <div className="min-w-0">
          <p
            className="truncate text-sm font-medium text-foreground"
            title={
              productName && displayProductName !== productName
                ? productName
                : undefined
            }
          >
            {displayProductName}
          </p>
          <p className="text-xs text-muted-foreground">{order.orderNumber}</p>
        </div>
      </div>

      <div className="hidden sm:block">
        <p className="text-xs text-muted-foreground">
          {t("admin.dashboardPage.customer")}
        </p>
        <p className="mt-1 text-sm font-medium text-foreground">
          {customerName}
        </p>
      </div>

      <div className="hidden sm:block">
        <p className="text-xs text-muted-foreground">{t("common.qty")}</p>
        <p className="mt-1 text-sm font-medium text-foreground">{qtyLabel}</p>
      </div>

      <div className="hidden sm:block">
        <p className="text-xs text-muted-foreground">{t("common.status")}</p>
        <VendorFulfillmentBadge
          status={order.status}
          pickupStatus={order.pickupStatus}
          className="mt-1"
        />
      </div>

      <div className="hidden sm:block">
        <p className="text-xs text-muted-foreground">
          {t("admin.dashboardPage.paymentMethod")}
        </p>
        <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
          <paymentMeta.Icon className="size-3.5 text-muted-foreground" />
          {paymentMeta.label}
        </p>
      </div>

      <div className="hidden sm:block sm:col-span-2 lg:col-span-1 lg:text-right">
        <p className="text-xs text-muted-foreground">{amountLabel}</p>
        <p className="mt-1 text-sm font-semibold text-foreground">
          {formatPrice(order.netSales)}
        </p>
      </div>
    </Link>
  );
}
