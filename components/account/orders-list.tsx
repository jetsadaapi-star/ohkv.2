"use client";

import { ORDER_STATUS_CLASSES } from "@/lib/theme-colors/status";

import { Suspense, useState } from "react";
import Link from "@/components/language/link";
import { useTranslations } from "next-intl";
import { AlertCircle, ChevronRight, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCurrency } from "@/providers/currency-provider";
import { ORDER_STATUS } from "@/config/app.config";
import { getPreorderStatusLabel } from "@/lib/orders/preorder-status-label";
import { useSuspenseResource } from "@/hooks/use-suspense-resource";
import { useDateFormat } from "@/lib/intl/use-date-format";
import { Skeleton } from "@/components/ui/skeleton";
import { AccountEmpty, AccountPills } from "./account-ui";

// Matches the server default limit for /api/orders (parsePageLimit defaultLimit).
const ORDERS_PAGE_SIZE = 10;

interface OrderItem {
  productId: string;
  name: string;
  image?: string;
  quantity: number;
  price: number;
  purchaseType?: string;
  preorderReleaseDate?: string;
  preorderStatus?: string;
}

/** Statuses carrying an `orders.*` label in every locale. */
const TRANSLATED_ORDER_STATUSES = [
  "pending",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
];

/** One seller's consignment; only sent for orders that span sellers. */
interface Shipment {
  _id?: string;
  vendorId?: string;
  vendorName?: string;
  status: string;
}

interface Order {
  _id: string;
  orderNumber: string;
  status: string;
  total: number;
  items: OrderItem[];
  subOrders?: Shipment[];
  hasPreorder?: boolean;
  preorderStatus?: string;
  preorderReleaseDate?: string;
  createdAt: string;
}

type OrdersFilter = "all" | "regular" | "preorders";

/**
 * The url and loader the order history reads first — for prefetching it from
 * a link before the page opens (see `usePrefetchResource`).
 */
export function ordersFirstPage(filter: OrdersFilter = "regular", status: StatusTab = "all") {
  return {
    url: `/api/orders?type=${filter}&limit=${ORDERS_PAGE_SIZE}&status=${status}`,
    load: async (): Promise<LoadedOrders> => {
      const { list, hasNext } = await fetchOrdersPage(filter, 1, status);
      return { orders: list, page: 1, hasNext };
    },
  };
}

/** The status tabs over the history; "all" sends no status. */
const STATUS_TABS = ["all", "pending", "processing", "shipped", "delivered", "cancelled"] as const;
type StatusTab = (typeof STATUS_TABS)[number];

interface CustomerOrdersListProps {
  filter?: OrdersFilter;
  /** Tabs to narrow the list by status (the order history page). */
  statusTabs?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}

/** The pages loaded so far, held as one list so "Load more" survives a visit away. */
interface LoadedOrders {
  orders: Order[];
  page: number;
  hasNext: boolean;
}

// Fetch a single page from the server-paginated /api/orders (defaultLimit=10).
// Previously this component fetched with no page/limit and rendered only the
// first page as if it were the whole history, hiding every order past the
// 10th. Now it reads the pagination envelope and appends via "Load more".
async function fetchOrdersPage(
  filter: OrdersFilter,
  nextPage: number,
  status: StatusTab = "all",
): Promise<{ list: Order[]; hasNext: boolean }> {
  const params = new URLSearchParams();
  if (status !== "all") params.set("status", status);
  params.set("page", String(nextPage));
  params.set("limit", String(ORDERS_PAGE_SIZE));
  if (filter === "preorders") params.set("type", "preorders");
  if (filter === "regular") params.set("type", "regular");

  const res = await fetch(`/api/orders?${params.toString()}`);
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.message || "Failed to load orders");
  }

  const payload = data.data;
  const list: Order[] = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload)
      ? payload
      : [];
  return { list, hasNext: Boolean(payload?.pagination?.hasNext) };
}

function getPreorderReleaseDate(order: Order) {
  if (order.preorderReleaseDate) return order.preorderReleaseDate;
  return order.items.find((item) => item.purchaseType === "preorder")
    ?.preorderReleaseDate;
}

function getPreorderStatus(order: Order) {
  if (order.preorderStatus) return order.preorderStatus;
  return order.items.find((item) => item.purchaseType === "preorder")
    ?.preorderStatus;
}

function getStatusBadge(
  status: string,
  ts: ReturnType<typeof useTranslations>,
) {
  const config: Record<
    string,
    {
      variant: "default" | "secondary" | "outline" | "destructive";
      label: string;
    }
  > = {
    [ORDER_STATUS.PENDING]: { variant: "outline", label: ts("statusPending") },
    [ORDER_STATUS.PREORDERED]: { variant: "outline", label: ts("statusPreordered") },
    [ORDER_STATUS.PROCESSING]: { variant: "secondary", label: ts("statusProcessing") },
    [ORDER_STATUS.SHIPPED]: { variant: "default", label: ts("statusShipped") },
    [ORDER_STATUS.DELIVERED]: { variant: "default", label: ts("statusDelivered") },
    [ORDER_STATUS.CANCELLED]: { variant: "destructive", label: ts("statusCancelled") },
  };
  const { variant, label } = config[status] || {
    variant: "outline",
    label: status,
  };
  return (
    <Badge variant={variant} className={`rounded-full ${ORDER_STATUS_CLASSES[status] ?? ""}`}>
      {label}
    </Badge>
  );
}

export function CustomerOrdersList(props: CustomerOrdersListProps) {
  const [status, setStatus] = useState<StatusTab>("all");
  const t = useTranslations();
  const label = (tab: StatusTab) =>
    tab === "all"
      ? t.has("common.all")
        ? t("common.all")
        : "All"
      : TRANSLATED_ORDER_STATUSES.includes(tab)
        ? t(`orders.${tab}`)
        : tab;
  if (!props.statusTabs) return <OrdersListBody {...props} status="all" />;
  return (
    <div className="space-y-4">
      <AccountPills
        label={t.has("orders.orderHistory") ? t("orders.orderHistory") : "Orders"}
        value={status}
        onChange={setStatus}
        items={STATUS_TABS.map((tab) => ({ id: tab, label: label(tab) }))}
      />
      {/* Each tab is its own held list: switching back is instant. */}
      <Suspense fallback={<OrdersListFallback />}>
        <OrdersListBody key={status} {...props} status={status} />
      </Suspense>
    </div>
  );
}

/** Row placeholders, for a status tab loading for the first time. */
export function OrdersListFallback() {
  return (
    <div className="space-y-3" aria-busy="true">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 rounded-2xl border bg-card p-4">
          <Skeleton className="size-16 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}

function OrdersListBody({
  filter = "all",
  status,
  emptyTitle,
  emptyDescription,
}: CustomerOrdersListProps & { status: StatusTab }) {
  const fmtDate = useDateFormat();
  const t = useTranslations();
  const ts = useTranslations("storeText.ordersList");
  const { formatPrice } = useCurrency();
  // Suspends on the first page — the list pages wrap this in
  // `<ClientSuspense>` with the list skeleton. Opening an order and coming
  // back renders the held list, "Load more" pages included, with no request.
  const first = ordersFirstPage(filter, status);
  const { data, error, mutate } = useSuspenseResource<LoadedOrders>(first.url, {
    load: first.load,
  });
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const orders = data?.orders ?? [];
  const hasNext = data?.hasNext ?? false;

  const loadMore = async () => {
    if (!data || isLoadingMore || !hasNext) return;
    setIsLoadingMore(true);
    try {
      const nextPage = data.page + 1;
      const { list, hasNext: more } = await fetchOrdersPage(filter, nextPage, status);
      mutate((current) => {
        const seen = new Set(current.orders.map((order) => order._id));
        return {
          orders: [
            ...current.orders,
            ...list.filter((order) => !seen.has(order._id)),
          ],
          page: nextPage,
          hasNext: more,
        };
      });
    } catch {
      // Keep the already-loaded orders; the button stays available to retry.
    } finally {
      setIsLoadingMore(false);
    }
  };

  if (error) {
    return (
      <AccountEmpty
        icon={<AlertCircle />}
        title={ts("loadFailed")}
        action={
          <Button variant="outline" className="rounded-xl" onClick={() => window.location.reload()}>
            {ts("tryAgain")}
          </Button>
        }
      />
    );
  }

  if (orders.length === 0) {
    return (
      <AccountEmpty
        icon={<Package />}
        title={emptyTitle || t("orders.noOrders")}
        description={status === "all" ? emptyDescription || t("orders.startShopping") : undefined}
        action={
          status === "all" ? (
            <Button asChild className="rounded-xl">
              <Link href="/products">{t("orders.browseProducts")}</Link>
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      {orders.map((order) => {
        const preorderReleaseDate = getPreorderReleaseDate(order);
        const preorderStatusLabel = getPreorderStatusLabel(getPreorderStatus(order));
        const pictures = order.items.filter((item) => item.image).slice(0, 3);
        const units = order.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
        const first = order.items[0];
        const split =
          (order.subOrders?.length ?? 0) > 1 &&
          new Set(order.subOrders!.map((shipment) => shipment.status)).size > 1;

        return (
          <Link
            key={order._id}
            href={`/account/orders/${order._id}`}
            className="group relative flex gap-4 overflow-hidden rounded-2xl border bg-card p-4 transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_10px_28px_-14px_color-mix(in_oklab,var(--primary)_35%,transparent)] sm:p-5"
          >
            {/* Up to three of the order's pictures, fanned like a stack. */}
            <div className="relative size-16 shrink-0 sm:size-20">
              {pictures.length > 0 ? (
                pictures
                  .slice()
                  .reverse()
                  .map((item, index, list) => {
                    const depth = list.length - 1 - index;
                    return (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={`${item.productId}-${depth}`}
                        src={item.image}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="absolute inset-0 size-full rounded-xl border-2 border-card bg-muted object-cover shadow-sm"
                        style={{
                          transform: depth ? `translate(${depth * 5}px, ${-depth * 5}px) scale(${1 - depth * 0.08})` : undefined,
                          zIndex: 3 - depth,
                          opacity: depth ? 0.85 : 1,
                        }}
                      />
                    );
                  })
              ) : (
                <span className="flex size-full items-center justify-center rounded-xl bg-primary/8 text-primary">
                  <Package className="size-6" />
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold tracking-wide text-muted-foreground">
                  #{order.orderNumber}
                </span>
                {getStatusBadge(order.status, ts)}
                {order.hasPreorder ? (
                  <Badge variant="outline" className="rounded-full border-[var(--highlight)] text-[color-mix(in_oklab,var(--highlight)_60%,black)]">
                    {ts("preorder")}
                  </Badge>
                ) : null}
              </div>
              <p className="mt-1 line-clamp-1 text-sm font-semibold sm:text-base">
                {first?.name || order.orderNumber}
                {order.items.length > 1 ? (
                  <span className="font-normal text-muted-foreground"> +{order.items.length - 1}</span>
                ) : null}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {fmtDate(order.createdAt, "dateTime")} · {ts("itemsCount", { count: units || order.items.length })}
              </p>
              {/* The order badge is the least advanced consignment, so on a
                  split order it is true but incomplete. */}
              {split ? (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {order.subOrders!.map((shipment, position) => (
                    <span
                      key={shipment._id ?? shipment.vendorId ?? position}
                      className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                    >
                      {shipment.vendorName || t("product.vendor")}:{" "}
                      <span className="font-semibold text-foreground">
                        {TRANSLATED_ORDER_STATUSES.includes(shipment.status)
                          ? t(`orders.${shipment.status}`)
                          : shipment.status}
                      </span>
                    </span>
                  ))}
                </div>
              ) : null}
              {order.hasPreorder ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {preorderStatusLabel || ts("preorder")}
                  {preorderReleaseDate
                    ? ` · ${ts("shipsAround", { date: fmtDate(preorderReleaseDate) })}`
                    : ""}
                </p>
              ) : null}
            </div>

            <div className="flex shrink-0 flex-col items-end justify-between gap-2">
              <span className="text-base font-extrabold tabular-nums sm:text-lg">{formatPrice(order.total)}</span>
              <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-primary opacity-80 transition group-hover:opacity-100">
                {t.has("common.viewDetails") ? t("common.viewDetails") : ts("total")}
                <ChevronRight className="size-4 transition group-hover:translate-x-0.5 rtl:rotate-180" />
              </span>
            </div>
          </Link>
        );
      })}

      {hasNext ? (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={() => void loadMore()}
            disabled={isLoadingMore}
          >
            {isLoadingMore
              ? t.has("common.loading")
                ? t("common.loading")
                : ts("loading")
              : t.has("common.loadMore")
                ? t("common.loadMore")
                : ts("loadMore")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
