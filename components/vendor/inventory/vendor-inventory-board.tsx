"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "@/components/language/link";
import {
  AlertTriangle,
  ArrowUpDown,
  Barcode,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Download,
  ImageOff,
  MapPin,
  Minus,
  MoreHorizontal,
  PackageX,
  Plus,
  ScanBarcode,
  Search,
  Truck,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { NumberInput } from "@/components/ui/number-input";
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
import { InventorySaveBar } from "@/components/admin/inventory-save-bar";
import {
  InventoryUnavailableDialog,
  type UnavailableStockTarget,
} from "@/components/admin/inventory-unavailable-dialog";
import { BarcodeLabelStudio, type BarcodeLabelInventoryItem } from "@/components/barcode/barcode-label-studio";
import { useListNavigation } from "@/hooks/use-list-navigation";
import { apiClient } from "@/lib/api/client";
import { figuresForStock, stockAdjustment, targetStockForEdit } from "@/lib/inventory/stock-edit";
import type { BarcodeFormat } from "@/lib/barcode/standards";
import { cn } from "@/lib/utils";

const API = "/api/vendor/inventory";
const LOW = 10;

interface InventoryItem {
  id: string;
  productId: string;
  productName: string;
  productImage: string | null;
  variantId: string | null;
  variantName: string | null;
  sku: string;
  barcode: string;
  barcodeFormat?: BarcodeFormat;
  barcodeSource?: "manufacturer" | "gs1" | "internal";
  price: number;
  available: number;
  committed: number;
  unavailable: number;
  onHand: number;
  incoming?: number;
  locationInventory: Array<{ locationId: string; locationName: string; quantity: number }>;
}

type Tone = "in" | "low" | "out";
const toneOf = (available: number): Tone => (available <= 0 ? "out" : available <= LOW ? "low" : "in");

const ROW_TONE: Record<Tone, string> = {
  in: "border-s-emerald-500 bg-emerald-50/50 dark:bg-emerald-500/5",
  low: "border-s-amber-500 bg-amber-50/70 dark:bg-amber-500/10",
  out: "border-s-rose-500 bg-rose-50/70 dark:bg-rose-500/10",
};
const PILL_TONE: Record<Tone, string> = {
  in: "bg-emerald-600 text-white",
  low: "bg-amber-500 text-white",
  out: "bg-rose-600 text-white",
};

export interface VendorInventoryBoardProps {
  locale: string;
  readOnly?: boolean;
  data: Omit<InventoryItem, "id">[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  locations: { _id: string; name: string; isDefault?: boolean }[];
  counts: { all: number; in: number; low: number; out: number };
}

/**
 * The vendor's stock, one row per sellable unit, coloured by how much is left.
 * Edits are kept on the page and sent together as adjustments (see
 * lib/inventory/stock-edit.ts), exactly as the admin inventory table does.
 */
export function VendorInventoryBoard({ readOnly = false, data, pagination, locations, counts }: VendorInventoryBoardProps) {
  const t = useTranslations("admin.hc.vendorInventory");
  const tRoot = useTranslations();
  const [isSaving, setIsSaving] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Map<string, number>>(new Map());
  const [labelItems, setLabelItems] = useState<InventoryItem[]>([]);
  const [labelOpen, setLabelOpen] = useState(false);
  const [unavailableTarget, setUnavailableTarget] = useState<UnavailableStockTarget | null>(null);

  const list = useListNavigation<InventoryItem>({
    items: useMemo(() => data.map((item) => ({ ...item, id: `${item.productId}-${item.variantId || "main"}` })), [data]),
    pagination,
    tabParam: "stockLevel",
    filterIds: ["location", "barcodeStatus"],
    defaultSortBy: "productName",
    defaultSortOrder: "asc",
    defaultPageSize: 50,
  });

  const fetched = useMemo(() => new Map(list.items.map((item) => [item.id, item])), [list.items]);
  const rows = useMemo(
    () =>
      list.items.map((item) => {
        const target = pending.get(item.id);
        return target === undefined ? item : { ...item, ...figuresForStock(item, target) };
      }),
    [list.items, pending],
  );
  const locationId = list.filters.location && list.filters.location !== "all" ? list.filters.location : undefined;
  const barcodeStatus = list.filters.barcodeStatus ?? "all";

  // Search: typed freely, sent once the typing pauses.
  const [query, setQuery] = useState(list.search);
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(debounce.current), []);
  const onSearch = (value: string) => {
    setQuery(value);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => list.handleSearchChange(value.trim()), 350);
  };

  const setAvailable = useCallback(
    (item: InventoryItem, value: number) => {
      if (readOnly) return;
      const base = fetched.get(item.id) || item;
      const target = targetStockForEdit(base, "available", Math.max(0, Math.trunc(value)));
      setPending((prev) => {
        const next = new Map(prev);
        if (stockAdjustment(base, target) === 0) next.delete(item.id);
        else next.set(item.id, target);
        return next;
      });
    },
    [fetched, readOnly],
  );

  const save = async () => {
    if (pending.size === 0) return;
    setIsSaving(true);
    try {
      // Adjustments, not absolute figures: a sale since the page loaded is
      // kept, and with a location chosen the change lands there.
      const updates = [...pending.entries()].flatMap(([key, target]) => {
        const row = fetched.get(key);
        if (!row) return [];
        const adjustment = stockAdjustment(row, target);
        return adjustment === 0
          ? []
          : [{ productId: row.productId, variantId: row.variantId || undefined, quantity: adjustment, adjustment: true, locationId }];
      });
      if (updates.length > 0) await apiClient.patch(API, { updates });
      toast.success(tRoot("admin.inventory.updateSuccess"));
      setPending(new Map());
      list.refetch();
    } catch {
      toast.error(tRoot("admin.inventory.updateError"));
    } finally {
      setIsSaving(false);
    }
  };

  const discard = () => {
    setPending(new Map());
    list.refetch();
  };

  const locationLabel = useCallback(
    (name: string) => {
      const known: Record<string, string> = {
        online: tRoot("admin.inventory.tabs.online"),
        "online store": tRoot("admin.inventory.tabs.onlineStore"),
        "main warehouse": tRoot("admin.inventory.tabs.mainWarehouse"),
        "store front": tRoot("admin.inventory.tabs.storeFront"),
        "secondary storage": tRoot("admin.inventory.tabs.secondaryStorage"),
      };
      return known[name.trim().toLowerCase()] || name;
    },
    [tRoot],
  );

  const exportCsv = () => {
    const header = ["product", "variant", "sku", "barcode", "available", "committed", "unavailable", "on_hand"];
    const body = rows.map((r) =>
      [r.productName, r.variantName || "", r.sku, r.barcode, r.available, r.committed, r.unavailable, r.onHand]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob(["﻿" + [header.join(","), ...body].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventory-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openLabels = (items: InventoryItem[]) => {
    const printable = items.filter((i) => i.barcode.trim());
    if (printable.length === 0) {
      toast.error(t("noBarcodeToPrint"));
      return;
    }
    setLabelItems(printable);
    setLabelOpen(true);
  };

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  const stockTab = list.activeTab;
  const SORTS = [
    { key: "productName:asc", label: t("sort.name") },
    { key: "available:asc", label: t("sort.lowFirst") },
    { key: "available:desc", label: t("sort.highFirst") },
    { key: "sku:asc", label: t("sort.sku") },
  ];
  const sortKey = `${list.sortBy}:${list.sortOrder}`;
  const from = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const to = Math.min(pagination.total, pagination.page * pagination.limit);
  const filtered = Boolean(list.search) || stockTab !== "all" || Boolean(locationId) || barcodeStatus !== "all";

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{readOnly ? t("subtitleReadOnly") : t("subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" className="gap-1.5 rounded-full" onClick={exportCsv} disabled={rows.length === 0}>
            <Download className="size-4" />
            {t("export")}
          </Button>
          <Button
            variant="outline"
            className="gap-1.5 rounded-full"
            disabled={selected.size === 0}
            onClick={() => openLabels(rows.filter((r) => selected.has(r.id)))}
          >
            <Barcode className="size-4" />
            {t("printLabels")}
            {selected.size > 0 ? <span className="rounded-full bg-foreground px-1.5 text-[11px] font-bold text-background">{selected.size}</span> : null}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-3 rounded-2xl border bg-card p-3 shadow-sm">
        <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0 [&::-webkit-scrollbar]:hidden">
          {(
            [
              { id: "all", label: t("tab.all"), count: counts.all, icon: null, on: "border-foreground bg-foreground text-background" },
              { id: "in", label: t("tab.in"), count: counts.in, icon: CircleCheck, on: "border-emerald-600 bg-emerald-600 text-white" },
              { id: "low", label: t("tab.low"), count: counts.low, icon: AlertTriangle, on: "border-amber-500 bg-amber-500 text-white" },
              { id: "out", label: t("tab.out"), count: counts.out, icon: PackageX, on: "border-rose-600 bg-rose-600 text-white" },
            ] as const
          ).map((tab) => {
            const active = stockTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => list.handleTabChange(tab.id)}
                className={cn(
                  "inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-sm font-medium transition-colors",
                  active ? tab.on : "bg-background hover:bg-muted",
                )}
              >
                {Icon ? <Icon className="size-3.5" /> : null}
                {tab.label}
                <span className={cn("rounded-full px-1.5 text-[11px] font-bold tabular-nums", active ? "bg-white/20" : "bg-muted text-muted-foreground")}>
                  {tab.count.toLocaleString("th-TH")}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[14rem] flex-1">
            <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => onSearch(e.target.value)} placeholder={t("searchPlaceholder")} className="h-10 rounded-full ps-9 pe-9" />
            {query ? (
              <button type="button" onClick={() => onSearch("")} className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label={t("clearSearch")}>
                <X className="size-4" />
              </button>
            ) : null}
          </div>

          {locations.length > 1 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className={cn("h-10 gap-1.5 rounded-full", locationId && "border-teal-500 text-teal-700 dark:text-teal-300")}>
                  <MapPin className="size-4" />
                  <span className="max-w-[10rem] truncate">
                    {locationId ? locationLabel(locations.find((l) => l._id === locationId)?.name || "") : t("allLocations")}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuRadioGroup value={locationId ?? "all"} onValueChange={(v) => list.handleFilterChange("location", v)}>
                  <DropdownMenuRadioItem value="all">{t("allLocations")}</DropdownMenuRadioItem>
                  {locations.map((loc) => (
                    <DropdownMenuRadioItem key={loc._id} value={loc._id}>
                      {locationLabel(loc.name)}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className={cn("h-10 gap-1.5 rounded-full", barcodeStatus !== "all" && "border-sky-500 text-sky-700 dark:text-sky-300")}>
                <ScanBarcode className="size-4" />
                <span className="hidden sm:inline">
                  {barcodeStatus === "withBarcode" ? t("barcodeHas") : barcodeStatus === "withoutBarcode" ? t("barcodeMissing") : t("barcodeAll")}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuRadioGroup value={barcodeStatus} onValueChange={(v) => list.handleFilterChange("barcodeStatus", v)}>
                <DropdownMenuRadioItem value="all">{t("barcodeAll")}</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="withBarcode">{t("barcodeHas")}</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="withoutBarcode">{t("barcodeMissing")}</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-10 gap-1.5 rounded-full">
                <ArrowUpDown className="size-4" />
                <span className="hidden sm:inline">{SORTS.find((s) => s.key === sortKey)?.label ?? t("sort.name")}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel className="text-xs text-muted-foreground">{t("sortBy")}</DropdownMenuLabel>
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
        {locationId && !readOnly ? (
          <p className="flex items-center gap-1.5 rounded-xl bg-teal-50 px-3 py-2 text-xs text-teal-800 dark:bg-teal-500/10 dark:text-teal-300">
            <MapPin className="size-3.5" />
            {t("locationEditHint", { name: locationLabel(locations.find((l) => l._id === locationId)?.name || "") })}
          </p>
        ) : null}
      </div>

      {/* Rows */}
      <div className="relative">
        {list.isLoading ? <div className="absolute inset-x-0 -top-2 z-10 h-1 animate-pulse rounded-full bg-emerald-500/70" /> : null}
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed bg-card px-6 py-16 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <PackageX className="size-7" />
            </span>
            <p className="mt-4 text-lg font-bold">{filtered ? t("emptyFiltered") : t("empty")}</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">{filtered ? t("emptyFilteredHint") : t("emptyHint")}</p>
          </div>
        ) : (
          <div className={cn("overflow-hidden rounded-2xl border bg-card shadow-sm transition-opacity", list.isLoading && "pointer-events-none opacity-60")}>
            <div className="hidden items-center gap-3 border-b bg-muted/40 px-4 py-2.5 text-xs font-semibold text-muted-foreground lg:grid lg:grid-cols-[auto_minmax(0,1fr)_minmax(0,220px)_200px_40px]">
              <Checkbox
                checked={allSelected}
                onCheckedChange={(v) =>
                  setSelected((prev) => {
                    const next = new Set(prev);
                    rows.forEach((r) => (v ? next.add(r.id) : next.delete(r.id)));
                    return next;
                  })
                }
                aria-label={t("selectAll")}
              />
              <span>{t("colProduct")}</span>
              <span>{t("colBreakdown")}</span>
              <span className="text-center">{t("colAvailable")}</span>
              <span />
            </div>
            <ul className="divide-y">
              {rows.map((row) => {
                const tone = toneOf(row.available);
                const original = fetched.get(row.id);
                const edited = pending.has(row.id);
                const delta = edited && original ? row.available - original.available : 0;
                return (
                  <li
                    key={row.id}
                    className={cn(
                      "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-3 border-s-4 px-4 py-3 transition-colors lg:grid-cols-[auto_minmax(0,1fr)_minmax(0,220px)_200px_40px]",
                      ROW_TONE[tone],
                      edited && "bg-sky-50 ring-2 ring-inset ring-sky-300 dark:bg-sky-500/10",
                    )}
                  >
                    <Checkbox className="row-start-1 lg:row-start-auto" checked={selected.has(row.id)} onCheckedChange={() => toggle(row.id)} aria-label={t("select")} />

                    {/* Product */}
                    <div className="col-start-2 row-start-1 flex min-w-0 items-center gap-3 lg:col-start-auto lg:row-start-auto">
                      <span className="relative size-14 shrink-0 overflow-hidden rounded-xl border bg-white">
                        <AppImage
                          src={row.productImage}
                          alt={row.productName}
                          fill
                          sizes="56px"
                          className="object-cover"
                          fallback={
                            <span className="flex size-full items-center justify-center text-muted-foreground">
                              <ImageOff className="size-5" />
                            </span>
                          }
                        />
                      </span>
                      <div className="min-w-0">
                        {readOnly ? (
                          <p className="line-clamp-1 text-sm font-semibold">{row.productName}</p>
                        ) : (
                          <Link href={`/vendor/products/${row.productId}/edit`} className="line-clamp-1 text-sm font-semibold hover:underline">
                            {row.productName}
                          </Link>
                        )}
                        {row.variantName ? <p className="truncate text-xs text-muted-foreground">{row.variantName}</p> : null}
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", PILL_TONE[tone])}>{t(`status.${tone}`)}</span>
                          {row.sku ? <span className="rounded-md bg-background/80 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground ring-1 ring-border">{row.sku}</span> : null}
                          {row.barcode ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-background/80 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground ring-1 ring-border">
                              <Barcode className="size-3" />
                              {row.barcode}
                            </span>
                          ) : (
                            <span className="rounded-md px-1.5 py-0.5 text-[10px] text-muted-foreground border border-dashed">{t("noBarcode")}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Breakdown */}
                    <div className="col-span-3 flex flex-wrap items-center gap-1.5 text-[11px] lg:col-span-1">
                      <span className="rounded-full bg-background px-2 py-0.5 font-medium ring-1 ring-border">
                        {t("onHand", { count: row.onHand })}
                      </span>
                      {row.committed > 0 ? (
                        <span className="rounded-full bg-violet-100 px-2 py-0.5 font-medium text-violet-700 dark:bg-violet-500/15 dark:text-violet-300" title={tRoot("admin.inventory.columns.committedHint")}>
                          {t("committed", { count: row.committed })}
                        </span>
                      ) : null}
                      {row.unavailable > 0 ? (
                        <button
                          type="button"
                          onClick={() => setUnavailableTarget({ productId: row.productId, variantId: row.variantId, productName: row.productName, variantName: row.variantName })}
                          className="rounded-full bg-orange-100 px-2 py-0.5 font-medium text-orange-700 underline decoration-dotted underline-offset-2 dark:bg-orange-500/15 dark:text-orange-300"
                        >
                          {t("unavailable", { count: row.unavailable })}
                        </button>
                      ) : null}
                      {row.incoming ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 font-medium text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
                          <Truck className="size-3" />
                          {t("incoming", { count: row.incoming })}
                        </span>
                      ) : null}
                      {row.locationInventory.length > 1
                        ? row.locationInventory.map((loc) => (
                            <span key={loc.locationId} className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-teal-700 dark:bg-teal-500/10 dark:text-teal-300">
                              <MapPin className="size-3" />
                              {locationLabel(loc.locationName)} {loc.quantity}
                            </span>
                          ))
                        : null}
                    </div>

                    {/* Available: stepper */}
                    <div className="col-span-3 flex items-center justify-between gap-3 lg:col-span-1 lg:flex-col lg:justify-center lg:gap-1">
                      <span className="text-xs font-medium text-muted-foreground lg:hidden">{t("colAvailable")}</span>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="size-9 rounded-full bg-background"
                          disabled={readOnly || row.available <= 0}
                          onClick={() => setAvailable(row, row.available - 1)}
                          aria-label={t("decrease")}
                        >
                          <Minus className="size-4" />
                        </Button>
                        <NumberInput
                          min={0}
                          step={1}
                          value={row.available}
                          disabled={readOnly}
                          whenEmpty={0}
                          normalize={Math.trunc}
                          onValueChange={(next) => setAvailable(row, next ?? 0)}
                          className={cn("h-9 w-20 rounded-full text-center text-base font-bold tabular-nums", edited && "border-sky-400")}
                          aria-label={t("colAvailable")}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="size-9 rounded-full bg-background"
                          disabled={readOnly}
                          onClick={() => setAvailable(row, row.available + 1)}
                          aria-label={t("increase")}
                        >
                          <Plus className="size-4" />
                        </Button>
                      </div>
                      {edited && original ? (
                        <span className={cn("text-[11px] font-semibold tabular-nums", delta > 0 ? "text-emerald-600" : "text-rose-600")}>
                          {t("wasNow", { was: original.available, delta: `${delta > 0 ? "+" : ""}${delta}` })}
                        </span>
                      ) : null}
                    </div>

                    {/* Row menu */}
                    <div className="col-start-3 row-start-1 justify-self-end lg:col-start-auto lg:row-start-auto">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8 rounded-full" aria-label={t("moreActions")}>
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuItem disabled={!row.barcode.trim()} onClick={() => openLabels([row])}>
                            <Barcode className="size-4" />
                            {t("printLabel")}
                          </DropdownMenuItem>
                          {!readOnly ? (
                            <>
                              <DropdownMenuSeparator />
                              {[10, 50].map((n) => (
                                <DropdownMenuItem key={n} onClick={() => setAvailable(row, row.available + n)}>
                                  <Plus className="size-4" />
                                  {t("addUnits", { count: n })}
                                </DropdownMenuItem>
                              ))}
                              <DropdownMenuItem onClick={() => setAvailable(row, 0)} className="text-destructive focus:text-destructive">
                                <PackageX className="size-4" />
                                {t("setZero")}
                              </DropdownMenuItem>
                            </>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination.total > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <p className="text-muted-foreground">{t("showing", { from, to, total: pagination.total })}</p>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="rounded-full">
                  {t("perPage", { count: pagination.limit })}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {[25, 50, 100].map((size) => (
                  <DropdownMenuItem key={size} onClick={() => list.handlePageSizeChange(size)}>
                    {size === pagination.limit ? <Check className="size-4" /> : <span className="size-4" />}
                    {t("perPage", { count: size })}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="icon" className="size-9 rounded-full" disabled={pagination.page <= 1 || list.isLoading} onClick={() => list.handlePageChange(pagination.page - 1)} aria-label={t("prev")}>
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-[4.5rem] text-center font-medium tabular-nums">
              {pagination.page} / {Math.max(1, pagination.totalPages)}
            </span>
            <Button variant="outline" size="icon" className="size-9 rounded-full" disabled={pagination.page >= pagination.totalPages || list.isLoading} onClick={() => list.handlePageChange(pagination.page + 1)} aria-label={t("next")}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      ) : null}

      <InventoryUnavailableDialog
        target={unavailableTarget}
        onOpenChange={(open) => {
          if (!open) setUnavailableTarget(null);
        }}
        apiEndpoint={API}
        readOnly={readOnly}
        onChanged={list.refetch}
      />
      <BarcodeLabelStudio
        open={labelOpen}
        onOpenChange={(open) => {
          setLabelOpen(open);
          if (!open) setLabelItems([]);
        }}
        items={labelItems as BarcodeLabelInventoryItem[]}
      />
      <InventorySaveBar open={pending.size > 0 && !readOnly} count={pending.size} isSaving={isSaving} onDiscard={discard} onSave={() => void save()} />
    </section>
  );
}

export function VendorInventoryBoardSkeleton() {
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
      <div className="space-y-2 rounded-2xl border p-3">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="size-14 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-9 w-40 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
