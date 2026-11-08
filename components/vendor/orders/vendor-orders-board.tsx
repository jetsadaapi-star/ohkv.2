"use client";

import { statusBadgeClass } from "@/lib/ui/status-palette";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import Link from "@/components/language/link";
import {
  ArrowUpDown,
  CalendarDays,
  Check,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Download,
  Eye,
  Loader2,
  MapPin,
  MoreHorizontal,
  Package,
  PackageCheck,
  Plus,
  Search,
  ShoppingBag,
  Truck,
  X,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AppImage } from "@/components/ui/app-image";
import { toast } from "@/components/ui/toast-notification";
import { useConfirmation } from "@/components/ui/confirmation-dialog";
import { useCurrency } from "@/providers/currency-provider";
import { useListNavigation } from "@/hooks/use-list-navigation";
import { apiClient } from "@/lib/api/client";
import { getPaymentMethodMeta } from "@/components/common/payment-method-meta";
import { cn } from "@/lib/utils";

interface Item {
  name: string;
  quantity: number;
  price: number;
  image?: string;
}
interface SubOrder {
  status: string;
  trackingNumber?: string;
  fulfillment?: { method: "delivery" | "pickup"; pickup?: { status: "scheduled" | "ready" | "collected" } };
  items: Item[];
}
interface VendorOrder {
  _id: string;
  orderNumber: string;
  customerId?: { name?: string; email?: string };
  posWalkIn?: boolean;
  posWalkInName?: string;
  paymentStatus: string;
  paymentMethod?: string;
  shippingAddress?: { fullName?: string; city?: string; state?: string };
  createdAt: string;
  subOrders: SubOrder[];
  netSales: number;
  fulfillmentBlocked?: boolean;
}

const TRANSITIONS: Record<string, string[]> = {
  pending: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
};
const allowed = (from: string, to: string) => TRANSITIONS[from]?.includes(to) ?? false;

/** Row colour by where this vendor's consignment has got to. */
const TONE: Record<string, { edge: string; bg: string; pill: string; icon: typeof Clock3 }> = {
  preordered: { edge: "border-s-violet-500", bg: "bg-violet-50/60 dark:bg-violet-500/5", pill: "bg-violet-600 text-white", icon: Clock3 },
  pending: { edge: "border-s-amber-500", bg: "bg-amber-50/70 dark:bg-amber-500/10", pill: "bg-amber-500 text-white", icon: Clock3 },
  processing: { edge: "border-s-sky-500", bg: "bg-sky-50/70 dark:bg-sky-500/10", pill: "bg-sky-600 text-white", icon: Package },
  shipped: { edge: "border-s-indigo-500", bg: "bg-indigo-50/60 dark:bg-indigo-500/10", pill: "bg-indigo-600 text-white", icon: Truck },
  delivered: { edge: "border-s-emerald-500", bg: "bg-emerald-50/50 dark:bg-emerald-500/5", pill: "bg-emerald-600 text-white", icon: CheckCircle },
  cancelled: { edge: "border-s-rose-400", bg: "bg-rose-50/60 dark:bg-rose-500/5", pill: "bg-rose-600 text-white", icon: XCircle },
};
const PAY_TONE: Record<string, string> = {
  // The shared palette (lib/ui/status-palette): paid green everywhere.
  paid: statusBadgeClass("paid"),
  pending: statusBadgeClass("pending"),
  partially_paid: statusBadgeClass("partially_paid"),
  refunded: statusBadgeClass("refunded"),
  partially_refunded: statusBadgeClass("partially_refunded"),
  expired: statusBadgeClass("expired"),
};

export interface VendorOrdersBoardProps {
  canEditOrder?: boolean;
  canDeleteOrder?: boolean;
  canCreateOrder?: boolean;
  data: VendorOrder[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

/**
 * A vendor's orders, one card per consignment, coloured by fulfilment stage,
 * with the next step one click away. Status changes go through the same
 * endpoint and the same transition rules as before.
 */
export function VendorOrdersBoard({ canEditOrder = false, canDeleteOrder = false, canCreateOrder = false, data, pagination }: VendorOrdersBoardProps) {
  const t = useTranslations();
  const tv = useTranslations("admin.hc.vendorOrders");
  const locale = useLocale();
  const { confirm } = useConfirmation();
  const { formatPrice } = useCurrency();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [shipFor, setShipFor] = useState<string | null>(null);
  const [tracking, setTracking] = useState("");
  const [exporting, setExporting] = useState(false);
  const selectable = canEditOrder || canDeleteOrder;

  const list = useListNavigation<VendorOrder>({ items: data, pagination, tabParam: "view", filterIds: ["status", "paymentStatus", "date"] });
  const view = list.activeTab;
  const statusFilter = list.filters.status ?? "all";
  const payFilter = list.filters.paymentStatus ?? "all";
  const dateFilter = list.filters.date ?? "all";

  const [query, setQuery] = useState(list.search);
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(debounce.current), []);
  const onSearch = (value: string) => {
    setQuery(value);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => list.handleSearchChange(value.trim()), 350);
  };

  const update = useCallback(
    async (orderId: string, status: string, trackingNumber?: string) => {
      setBusy(orderId);
      try {
        await apiClient.put(`/api/vendor/orders/${orderId}`, { status, trackingNumber });
        toast.success(t("vendor.ordersTable.updated"));
        setShipFor(null);
        setTracking("");
        list.refetch();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("vendor.ordersTable.updateFailed"));
      } finally {
        setBusy(null);
      }
    },
    [list, t],
  );

  const cancelOne = async (orderId: string) => {
    const ok = await confirm({
      title: t("vendor.ordersTable.cancelOrderTitle"),
      description: t("vendor.ordersTable.cancelOrderDescription"),
      confirmText: t("vendor.ordersTable.cancelOrderConfirm"),
      cancelText: t("vendor.ordersTable.cancelOrderKeep"),
      variant: "destructive",
    });
    if (ok) await update(orderId, "cancelled");
  };

  const bulk = async (status: string) => {
    const items = list.items.filter((o) => selected.has(o._id));
    if (items.length === 0) return;
    if (status === "cancelled") {
      const ok = await confirm({
        title: t("vendor.ordersTable.cancelOrdersTitle"),
        description: t("vendor.ordersTable.cancelOrdersDescription", { count: items.length }),
        confirmText: t("vendor.ordersTable.cancelOrdersConfirm"),
        cancelText: t("vendor.ordersTable.cancelOrdersKeep"),
        variant: "destructive",
      });
      if (!ok) return;
    }
    setBusy("bulk");
    const results = await Promise.all(
      items.map(async (order) => {
        const sub = order.subOrders?.[0];
        const pickup = sub?.fulfillment?.method === "pickup";
        if (!sub || (pickup && status !== "cancelled") || !allowed(sub.status, status) || (status !== "cancelled" && order.fulfillmentBlocked)) return false;
        try {
          await apiClient.put(`/api/vendor/orders/${order._id}`, { status });
          return true;
        } catch {
          return false;
        }
      }),
    );
    setBusy(null);
    const ok = results.filter(Boolean).length;
    setSelected(new Set());
    list.refetch();
    if (ok === items.length) toast.success(t("vendor.ordersTable.bulkUpdatedAll", { count: ok }));
    else if (ok > 0) toast.success(t("vendor.ordersTable.bulkUpdatedSome", { success: ok, total: items.length }));
    else toast.error(t("vendor.ordersTable.bulkUpdatedNone"));
  };

  // Every matching order, not just this page: the server applies the same query.
  const exportCsv = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams({ format: "csv" });
      if (list.search) params.set("search", list.search);
      if (view && view !== "all") params.set("view", view);
      for (const [id, value] of Object.entries(list.filters)) if (value && value !== "all") params.set(id, value);
      params.set("sortBy", list.sortBy);
      params.set("sortOrder", list.sortOrder);
      const res = await fetch(`/api/vendor/orders?${params.toString()}`);
      if (!res.ok) throw new Error("export");
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `vendor-orders-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      const truncated = res.headers.get("X-Export-Truncated");
      toast.success(truncated ? t("vendor.ordersTable.exportTruncated", { count: Number(truncated) }) : t("vendor.ordersTable.exportSuccess"));
    } catch {
      toast.error(t("vendor.ordersTable.exportFailed"));
    } finally {
      setExporting(false);
    }
  };

  /** The one step that moves this consignment forward, if any. */
  const nextStep = (order: VendorOrder) => {
    const sub = order.subOrders?.[0];
    if (!sub || !canEditOrder || sub.fulfillment?.method === "pickup") return null;
    if (allowed(sub.status, "processing")) return { to: "processing", label: t("vendor.ordersTable.actions.startProcessing"), icon: Package };
    if (allowed(sub.status, "shipped")) return { to: "shipped", label: tv("ship"), icon: Truck };
    if (allowed(sub.status, "delivered")) return { to: "delivered", label: tv("delivered"), icon: CheckCircle };
    return null;
  };

  const dateFmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const SORTS = [
    { key: "createdAt:desc", label: tv("sort.newest") },
    { key: "createdAt:asc", label: tv("sort.oldest") },
    { key: "total:desc", label: tv("sort.highest") },
    { key: "orderNumber:desc", label: tv("sort.number") },
  ];
  const sortKey = `${list.sortBy}:${list.sortOrder}`;
  const from = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const to = Math.min(pagination.total, pagination.page * pagination.limit);
  const filtered = Boolean(list.search) || view !== "all" || statusFilter !== "all" || payFilter !== "all" || dateFilter !== "all";
  const allSelected = list.items.length > 0 && list.items.every((o) => selected.has(o._id));

  const filterButton = (
    active: boolean,
    icon: typeof Clock3,
    label: string,
    value: string,
    options: Array<{ value: string; label: string }>,
    onChange: (v: string) => void,
  ) => {
    const Icon = icon;
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className={cn("h-10 gap-1.5 rounded-full", active && "border-foreground bg-foreground text-background hover:bg-foreground/90 hover:text-background")}>
            <Icon className="size-4" />
            <span className="max-w-[9rem] truncate">{active ? options.find((o) => o.value === value)?.label : label}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel className="text-xs text-muted-foreground">{label}</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
            {options.map((o) => (
              <DropdownMenuRadioItem key={o.value} value={o.value}>
                {o.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{t("vendor.ordersTable.title")}</h1>
          <p className="text-sm text-muted-foreground">{tv("subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" className="gap-1.5 rounded-full" onClick={() => void exportCsv()} disabled={exporting}>
            {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            {tv("export")}
          </Button>
          {canCreateOrder ? (
            <Button asChild className="gap-1.5 rounded-full bg-emerald-600 text-white shadow-sm hover:bg-emerald-700">
              <Link href="/vendor/orders/create">
                <Plus className="size-4" />
                {t("vendor.ordersTable.createOrder")}
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-3 rounded-2xl border bg-card p-3 shadow-sm">
        <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0 [&::-webkit-scrollbar]:hidden">
          {(["all", "unfulfilled", "unpaid", "open", "archived"] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => list.handleTabChange(id)}
              className={cn(
                "inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-full border px-3.5 text-sm font-medium transition-colors",
                view === id ? "border-foreground bg-foreground text-background" : "bg-background hover:bg-muted",
              )}
            >
              {t(`vendor.ordersTable.tabs.${id}`)}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[14rem] flex-1">
            <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => onSearch(e.target.value)} placeholder={t("vendor.ordersTable.searchPlaceholder")} className="h-10 rounded-full ps-9 pe-9" />
            {query ? (
              <button type="button" onClick={() => onSearch("")} className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label={tv("clearSearch")}>
                <X className="size-4" />
              </button>
            ) : null}
          </div>
          {filterButton(
            statusFilter !== "all",
            Truck,
            t("vendor.ordersTable.filters.fulfillment"),
            statusFilter,
            [{ value: "all", label: t("vendor.ordersTable.tabs.all") }, ...["pending", "processing", "shipped", "delivered", "cancelled"].map((s) => ({ value: s, label: t(`vendor.fulfillmentStatus.${s}`) }))],
            (v) => list.handleFilterChange("status", v),
          )}
          {filterButton(
            payFilter !== "all",
            CircleDollarSign,
            t("vendor.ordersTable.columns.payment"),
            payFilter,
            [{ value: "all", label: t("vendor.ordersTable.tabs.all") }, ...["pending", "paid", "partially_paid", "refunded", "partially_refunded", "expired"].map((s) => ({ value: s, label: t(`vendor.paymentStatus.${s}`) }))],
            (v) => list.handleFilterChange("paymentStatus", v),
          )}
          {filterButton(
            dateFilter !== "all",
            CalendarDays,
            tv("date"),
            ["today", "yesterday", "week", "month"].includes(dateFilter) ? dateFilter : "all",
            ["all", "today", "yesterday", "week", "month"].map((p) => ({ value: p, label: tv(`period.${p}`) })),
            (v) => list.handleFilterChange("date", v),
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-10 gap-1.5 rounded-full">
                <ArrowUpDown className="size-4" />
                <span className="hidden sm:inline">{SORTS.find((s) => s.key === sortKey)?.label ?? tv("sort.newest")}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuRadioGroup
                value={sortKey}
                onValueChange={(value) => {
                  const [by, order] = value.split(":");
                  list.handleSortChange(by, order as "asc" | "desc");
                }}
              >
                {SORTS.map((s) => (
                  <DropdownMenuRadioItem key={s.key} value={s.key}>
                    {s.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Bulk bar */}
      {selectable && selected.size > 0 ? (
        <div className="sticky top-16 z-20 flex flex-wrap items-center gap-2 rounded-2xl bg-foreground px-4 py-2.5 text-background shadow-lg">
          <span className="me-auto text-sm font-semibold">{tv("selected", { count: selected.size })}</span>
          {canEditOrder ? (
            <>
              <Button size="sm" variant="secondary" className="rounded-full" disabled={busy === "bulk"} onClick={() => void bulk("processing")}>
                <Package className="size-4" />
                {tv("bulkProcessing")}
              </Button>
              <Button size="sm" variant="secondary" className="rounded-full" disabled={busy === "bulk"} onClick={() => void bulk("shipped")}>
                <Truck className="size-4" />
                {tv("bulkShipped")}
              </Button>
              <Button size="sm" variant="secondary" className="rounded-full" disabled={busy === "bulk"} onClick={() => void bulk("delivered")}>
                <CheckCircle className="size-4" />
                {tv("bulkDelivered")}
              </Button>
            </>
          ) : null}
          {canDeleteOrder ? (
            <Button size="sm" variant="destructive" className="rounded-full" disabled={busy === "bulk"} onClick={() => void bulk("cancelled")}>
              <XCircle className="size-4" />
              {t("vendor.ordersTable.actions.cancel")}
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" className="rounded-full text-background hover:bg-background/10 hover:text-background" onClick={() => setSelected(new Set())}>
            {tv("clearSelection")}
          </Button>
        </div>
      ) : null}

      {/* Orders */}
      <div className="relative">
        {list.isLoading ? <div className="absolute inset-x-0 -top-2 z-10 h-1 animate-pulse rounded-full bg-emerald-500/70" /> : null}
        {list.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed bg-card px-6 py-16 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <ShoppingBag className="size-7" />
            </span>
            <p className="mt-4 text-lg font-bold">{filtered ? tv("emptyFiltered") : tv("empty")}</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">{filtered ? tv("emptyFilteredHint") : tv("emptyHint")}</p>
          </div>
        ) : (
          <>
            {selectable ? (
              <label className="mb-2 flex w-fit cursor-pointer items-center gap-2 px-1 text-xs font-medium text-muted-foreground">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={(v) => setSelected(v ? new Set(list.items.map((o) => o._id)) : new Set())}
                />
                {tv("selectAll")}
              </label>
            ) : null}
            <ul className={cn("space-y-2 transition-opacity", list.isLoading && "pointer-events-none opacity-60")}>
              {list.items.map((order) => {
                const sub = order.subOrders?.[0];
                const status = sub?.status || "pending";
                const tone = TONE[status] ?? TONE.pending;
                const pickup = sub?.fulfillment?.method === "pickup" ? sub.fulfillment.pickup : undefined;
                const items = sub?.items || [];
                const count = items.reduce((n, i) => n + (i.quantity || 0), 0);
                const step = nextStep(order);
                const blocked = Boolean(order.fulfillmentBlocked);
                const pay = getPaymentMethodMeta(t, order.paymentMethod);
                const customer = order.posWalkIn
                  ? order.posWalkInName || t("admin.orderDetails.walkInCustomer")
                  : order.customerId?.name || order.shippingAddress?.fullName || t("vendor.ordersTable.guest");
                const place = [order.shippingAddress?.city, order.shippingAddress?.state].filter(Boolean).join(" ");
                return (
                  <li
                    key={order._id}
                    className={cn(
                      "grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-3 rounded-2xl border border-s-4 p-4 shadow-sm transition-shadow hover:shadow-md lg:grid-cols-[auto_minmax(0,1.1fr)_minmax(0,1fr)_auto_auto] lg:items-center",
                      tone.edge,
                      tone.bg,
                    )}
                  >
                    {selectable ? (
                      <Checkbox
                        className="mt-1 lg:mt-0"
                        checked={selected.has(order._id)}
                        onCheckedChange={() =>
                          setSelected((prev) => {
                            const next = new Set(prev);
                            if (next.has(order._id)) next.delete(order._id);
                            else next.add(order._id);
                            return next;
                          })
                        }
                        aria-label={tv("select")}
                      />
                    ) : (
                      <span />
                    )}

                    {/* Order + customer */}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/vendor/orders/${order._id}`} className="font-mono text-sm font-bold hover:underline">
                          #{order.orderNumber}
                        </Link>
                        <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold", tone.pill)}>
                          <tone.icon className="size-3" />
                          {pickup ? `${t("checkout.pickup.localPickup")} · ${t(`checkout.pickup.${pickup.status}`)}` : t(`vendor.fulfillmentStatus.${status}`)}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-sm font-semibold">{customer}</p>
                      <p className="flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
                        <time dateTime={order.createdAt} suppressHydrationWarning>
                          {dateFmt.format(new Date(order.createdAt))}
                        </time>
                        {place ? (
                          <span className="inline-flex items-center gap-0.5">
                            <MapPin className="size-3" />
                            {place}
                          </span>
                        ) : null}
                      </p>
                    </div>

                    {/* Net + menu on small screens */}
                    <div className="text-end lg:order-last">
                      <p className="text-base font-extrabold tabular-nums">{formatPrice(order.netSales || 0)}</p>
                      <p className="text-[10px] text-muted-foreground">{tv("net")}</p>
                    </div>

                    {/* Items + payment */}
                    <div className="col-span-3 min-w-0 lg:col-span-1">
                      <div className="flex items-center gap-2">
                        <div className="flex -space-x-2">
                          {items.slice(0, 3).map((item, i) => (
                            <span key={i} className="relative size-9 overflow-hidden rounded-lg border-2 border-background bg-muted">
                              {item.image ? <AppImage src={item.image} alt="" fill sizes="36px" className="object-cover" /> : <Package className="m-2 size-5 text-muted-foreground" />}
                            </span>
                          ))}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium">{items.map((i) => i.name).join(", ") || "—"}</p>
                          <p className="text-[11px] text-muted-foreground">{tv("itemCount", { count })}</p>
                        </div>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset", PAY_TONE[order.paymentStatus] ?? PAY_TONE.pending)}>
                          {t(`vendor.paymentStatus.${order.paymentStatus}`)}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-background px-2 py-0.5 text-[10px] font-medium text-muted-foreground ring-1 ring-border">
                          <pay.Icon className="size-3" />
                          {pay.label}
                        </span>
                        {sub?.trackingNumber ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-background px-2 py-0.5 font-mono text-[10px] text-muted-foreground ring-1 ring-border">
                            <Truck className="size-3" />
                            {sub.trackingNumber}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="col-span-3 flex items-center justify-end gap-1.5 lg:col-span-1">
                      {step ? (
                        <Button
                          size="sm"
                          disabled={blocked || busy === order._id}
                          title={blocked ? tv("paymentNotReceived") : undefined}
                          onClick={() => (step.to === "shipped" ? setShipFor(order._id) : void update(order._id, step.to))}
                          className="gap-1.5 rounded-full bg-emerald-600 text-white hover:bg-emerald-700"
                        >
                          {busy === order._id ? <Loader2 className="size-4 animate-spin" /> : <step.icon className="size-4" />}
                          {step.label}
                        </Button>
                      ) : null}
                      {blocked && step ? <span className="text-[10px] text-amber-700 dark:text-amber-300">{tv("paymentNotReceived")}</span> : null}
                      <Button asChild variant="outline" size="sm" className="rounded-full bg-background">
                        <Link href={`/vendor/orders/${order._id}`}>
                          <Eye className="size-4" />
                          <span className="hidden sm:inline">{tv("view")}</span>
                        </Link>
                      </Button>
                      {canDeleteOrder && sub && allowed(sub.status, "cancelled") ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-8 rounded-full" aria-label={tv("more")}>
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/vendor/orders/${order._id}`}>
                                <PackageCheck className="size-4" />
                                {t("vendor.ordersTable.actions.viewDetails")}
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => void cancelOne(order._id)}>
                              <XCircle className="size-4" />
                              {t("vendor.ordersTable.actions.cancelOrder")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      {/* Pagination */}
      {pagination.total > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <p className="text-muted-foreground">{tv("showing", { from, to, total: pagination.total })}</p>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="rounded-full">
                  {tv("perPage", { count: pagination.limit })}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {[10, 25, 50, 100].map((size) => (
                  <DropdownMenuItem key={size} onClick={() => list.handlePageSizeChange(size)}>
                    {size === pagination.limit ? <Check className="size-4" /> : <span className="size-4" />}
                    {tv("perPage", { count: size })}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="icon" className="size-9 rounded-full" disabled={pagination.page <= 1 || list.isLoading} onClick={() => list.handlePageChange(pagination.page - 1)} aria-label={tv("prev")}>
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-[4.5rem] text-center font-medium tabular-nums">
              {pagination.page} / {Math.max(1, pagination.totalPages)}
            </span>
            <Button variant="outline" size="icon" className="size-9 rounded-full" disabled={pagination.page >= pagination.totalPages || list.isLoading} onClick={() => list.handlePageChange(pagination.page + 1)} aria-label={tv("next")}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      ) : null}

      {/* Ship: ask for the tracking number */}
      <Dialog
        open={shipFor !== null}
        onOpenChange={(open) => {
          if (!open) {
            setShipFor(null);
            setTracking("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("vendor.ordersTable.shipDialog.title")}</DialogTitle>
            <DialogDescription>{t("vendor.ordersTable.shipDialog.description")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="vendor-order-tracking">{t("vendor.ordersTable.shipDialog.trackingLabel")}</Label>
            <Input id="vendor-order-tracking" placeholder={t("vendor.ordersTable.shipDialog.trackingPlaceholder")} value={tracking} onChange={(e) => setTracking(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShipFor(null)}>
              {t("common.cancel")}
            </Button>
            <Button disabled={busy !== null} onClick={() => shipFor && void update(shipFor, "shipped", tracking)}>
              <Truck className="size-4" />
              {t("vendor.ordersTable.shipDialog.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

export function VendorOrdersBoardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-48 rounded-full" />
      </div>
      <Skeleton className="h-[104px] rounded-2xl" />
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-24 rounded-2xl" />
      ))}
    </div>
  );
}
