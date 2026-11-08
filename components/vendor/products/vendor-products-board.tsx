"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import Link from "@/components/language/link";
import {
  AlertTriangle,
  ArrowUpDown,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Download,
  Eye,
  FileDown,
  Globe,
  ImageOff,
  LayoutGrid,
  List,
  Loader2,
  MoreHorizontal,
  PackageX,
  Pencil,
  Percent,
  Plus,
  Rocket,
  Search,
  ShoppingBag,
  Star,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useAppSettings as usePublicAppSettings } from "@/providers/app-settings-provider";
import { useCurrency } from "@/providers/currency-provider";
import { useListNavigation } from "@/hooks/use-list-navigation";
import { apiClient } from "@/lib/api/client";
import { BoostPurchaseDialog } from "@/components/vendor/boost-purchase-dialog";
import { TaxRequestDialog } from "@/components/vendor/tax-request-dialog";
import { ProductImportDialog, downloadProductImportSample } from "@/components/admin/product-import-dialog";
import type { ProductListItem as Product } from "@/types/product-list";
import type { TaxClass } from "@/lib/tax/tax-settings";
import { cn } from "@/lib/utils";

const IMPORT_ENDPOINT = "/api/vendor/products/import-export";
const LOW_STOCK = 10;
const VIEW_KEY = "ohk-vendor-products-view";

type Counts = { all: number; active: number; draft: number; unlisted: number; low: number; out: number };
type Tone = "active" | "draft" | "unlisted" | "soldout";

/** Card colours by state. Sold out wins over "active": it is what needs doing. */
const TONE: Record<Tone, { card: string; chip: string; dot: string; ring: string }> = {
  active: {
    card: "border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10",
    chip: "bg-emerald-600 text-white",
    dot: "bg-emerald-500",
    ring: "hover:ring-emerald-300/70",
  },
  draft: {
    card: "border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10",
    chip: "bg-amber-500 text-white",
    dot: "bg-amber-500",
    ring: "hover:ring-amber-300/70",
  },
  unlisted: {
    card: "border-slate-300 bg-slate-100 dark:border-slate-500/30 dark:bg-slate-500/10",
    chip: "bg-slate-600 text-white",
    dot: "bg-slate-400",
    ring: "hover:ring-slate-300/70",
  },
  soldout: {
    card: "border-rose-200 bg-rose-50 dark:border-rose-500/30 dark:bg-rose-500/10",
    chip: "bg-rose-600 text-white",
    dot: "bg-rose-500",
    ring: "hover:ring-rose-300/70",
  },
};

function toneOf(product: Product): Tone {
  const status = product.status === "archived" ? "unlisted" : product.status;
  if (status === "active" && Number(product.stock ?? 0) <= 0) return "soldout";
  if (status === "draft" || status === "unlisted") return status;
  return "active";
}

/** Grid or list, remembered on this device. */
function useViewMode() {
  const view = useSyncExternalStore(
    (notify) => {
      window.addEventListener("storage", notify);
      return () => window.removeEventListener("storage", notify);
    },
    () => (localStorage.getItem(VIEW_KEY) === "list" ? "list" : "grid"),
    () => "grid",
  );
  const setView = (next: "grid" | "list") => {
    localStorage.setItem(VIEW_KEY, next);
    window.dispatchEvent(new StorageEvent("storage", { key: VIEW_KEY }));
  };
  return [view as "grid" | "list", setView] as const;
}

export interface VendorProductsBoardProps {
  locale: string;
  counts: Counts;
  pageSize: number;
  canCreateProduct?: boolean;
  canEditProduct?: boolean;
  canDeleteProduct?: boolean;
  canBoostProduct?: boolean;
  /** Given when the vendor may ask for a tax change: cards become selectable. */
  taxClasses?: TaxClass[];
  data: Product[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export function VendorProductsBoard({
  locale,
  counts,
  pageSize,
  canCreateProduct = false,
  canEditProduct = false,
  canDeleteProduct = false,
  canBoostProduct = false,
  taxClasses,
  data,
  pagination,
}: VendorProductsBoardProps) {
  const t = useTranslations("admin.hc.vendorProducts");
  const tRoot = useTranslations();
  const { formatPrice } = useCurrency();
  const { confirm } = useConfirmation();
  const { boostingEnabled } = usePublicAppSettings();
  const [view, setView] = useViewMode();
  const [importOpen, setImportOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [taxRequestIds, setTaxRequestIds] = useState<string[]>([]);
  const [boostTarget, setBoostTarget] = useState<{ _id: string; name: string; image?: string | null } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const canImport = canCreateProduct || canEditProduct;
  const selectable = Boolean(taxClasses);

  const list = useListNavigation<Product>({
    items: data,
    pagination,
    filterIds: ["stock"],
    defaultPageSize: pageSize,
  });
  const status = list.activeTab === "archived" ? "unlisted" : list.activeTab;
  const stockFilter = list.filters.stock ?? "all";

  // Search: typed into freely, sent once the typing pauses.
  const [query, setQuery] = useState(list.search);
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(debounce.current), []);
  const onSearch = (value: string) => {
    setQuery(value);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => list.handleSearchChange(value.trim()), 350);
  };

  const sortKey = `${list.sortBy}:${list.sortOrder}`;
  const SORTS = [
    { key: "createdAt:desc", label: t("sort.newest") },
    { key: "updatedAt:desc", label: t("sort.updated") },
    { key: "name:asc", label: t("sort.name") },
    { key: "price:asc", label: t("sort.priceLow") },
    { key: "price:desc", label: t("sort.priceHigh") },
    { key: "stock:asc", label: t("sort.stockLow") },
  ];

  const statusTabs = [
    { id: "all", label: t("tab.all"), count: counts.all, dot: "bg-slate-400" },
    { id: "active", label: t("tab.active"), count: counts.active, dot: TONE.active.dot },
    { id: "draft", label: t("tab.draft"), count: counts.draft, dot: TONE.draft.dot },
    { id: "unlisted", label: t("tab.unlisted"), count: counts.unlisted, dot: TONE.unlisted.dot },
  ];

  const handleDelete = useCallback(
    async (product: Product) => {
      const ok = await confirm({
        title: tRoot("common.delete"),
        description: tRoot("vendor.productsTable.deleteConfirm", { name: product.name }),
        confirmText: tRoot("common.delete"),
        cancelText: tRoot("common.cancel"),
        variant: "destructive",
      });
      if (!ok) return;
      setDeleting(product._id);
      try {
        await apiClient.delete(`/api/vendor/products/${product._id}`);
        toast.success(tRoot("vendor.productsTable.productDeleted"));
        list.refetch();
      } catch {
        toast.error(tRoot("vendor.productsTable.deleteFailed"));
      } finally {
        setDeleting(null);
      }
    },
    [confirm, list, tRoot],
  );

  const handleExport = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (list.search) params.set("search", list.search);
      if (status && status !== "all") params.set("status", status);
      params.set("sortBy", list.sortBy);
      params.set("sortOrder", list.sortOrder);
      const res = await fetch(`${IMPORT_ENDPOINT}?${params.toString()}`);
      if (!res.ok) throw new Error("export");
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `vendor-products-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(t("exportSuccess"));
    } catch {
      toast.error(t("exportFailed"));
    }
  }, [list.search, list.sortBy, list.sortOrder, status, t]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allOnPageSelected = list.items.length > 0 && list.items.every((p) => selected.has(p._id));

  const from = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const to = Math.min(pagination.total, pagination.page * pagination.limit);
  const filtered = Boolean(list.search) || status !== "all" || stockFilter !== "all";

  const productHref = (p: Product) => (canEditProduct ? `/vendor/products/${p._id}/edit` : `/products/${p.slug}`);

  const menu = (p: Product) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8 rounded-full" aria-label={t("moreActions")}>
          {deleting === p._id ? <Loader2 className="size-4 animate-spin" /> : <MoreHorizontal className="size-4" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem asChild>
          <a href={`/products/${p.slug}`} target="_blank" rel="noreferrer">
            <Eye className="size-4" />
            {t("viewInStore")}
          </a>
        </DropdownMenuItem>
        {canEditProduct ? (
          <DropdownMenuItem asChild>
            <Link href={`/vendor/products/${p._id}/edit`}>
              <Pencil className="size-4" />
              {t("edit")}
            </Link>
          </DropdownMenuItem>
        ) : null}
        {selectable && canEditProduct ? (
          <DropdownMenuItem onClick={() => setTaxRequestIds([p._id])}>
            <Percent className="size-4" />
            {tRoot("admin.settings.tax.request.bulkAction")}
          </DropdownMenuItem>
        ) : null}
        {boostingEnabled && canBoostProduct && p.status === "active" ? (
          <DropdownMenuItem onClick={() => setBoostTarget({ _id: p._id, name: p.name, image: p.images?.[0] || null })}>
            <Rocket className="size-4" />
            {t("boost")}
          </DropdownMenuItem>
        ) : null}
        {canDeleteProduct ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => void handleDelete(p)}>
              <Trash2 className="size-4" />
              {t("delete")}
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const stockBadge = (p: Product) => {
    const stock = Number(p.stock ?? 0);
    if (stock <= 0)
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-2 py-0.5 text-[11px] font-bold text-white shadow-sm">
          <PackageX className="size-3" />
          {t("soldOut")}
        </span>
      );
    if (stock <= LOW_STOCK)
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-bold text-white shadow-sm">
          <AlertTriangle className="size-3" />
          {t("lowLeft", { count: stock })}
        </span>
      );
    return null;
  };

  const statusLabel = (tone: Tone) => t(`status.${tone}`);

  const channels = (p: Product) => {
    const online = p.publishing?.onlineStore ?? true;
    const pos = p.publishing?.pointOfSale ?? false;
    return (
      <span className="flex items-center gap-1.5 text-muted-foreground">
        {online ? (
          <span title={t("channelOnline")} className="flex size-6 items-center justify-center rounded-full bg-teal-500/10 text-teal-600">
            <Globe className="size-3.5" />
          </span>
        ) : null}
        {pos ? (
          <span title={t("channelPos")} className="flex size-6 items-center justify-center rounded-full bg-pink-500/10 text-pink-600">
            <ShoppingBag className="size-3.5" />
          </span>
        ) : null}
      </span>
    );
  };

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{tRoot("vendor.myProducts")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-1.5 rounded-full">
                <ChevronsUpDown className="size-4" />
                {t("importExport")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => void handleExport()}>
                <Download className="size-4" />
                {t("export")}
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!canImport} onClick={() => setImportOpen(true)}>
                <Upload className="size-4" />
                {t("import")}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!canImport}
                onClick={() =>
                  void downloadProductImportSample(IMPORT_ENDPOINT, "csv").catch(() => toast.error(t("sampleFailed")))
                }
              >
                <FileDown className="size-4" />
                {t("sample")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {canCreateProduct ? (
            <Button asChild className="gap-1.5 rounded-full bg-emerald-600 text-white shadow-sm hover:bg-emerald-700">
              <Link href="/vendor/products/new">
                <Plus className="size-4" />
                {tRoot("vendor.addProduct")}
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-3 rounded-2xl border bg-card p-3 shadow-sm">
        <div className="-mx-3 flex items-center gap-2 overflow-x-auto px-3 [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden">
          <div className="flex shrink-0 gap-1.5 md:flex-wrap">
            {statusTabs.map((tab) => {
              const active = status === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => list.handleTabChange(tab.id)}
                  className={cn(
                    "inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3.5 text-sm font-medium transition-colors",
                    active ? "border-foreground bg-foreground text-background" : "bg-background hover:bg-muted",
                  )}
                >
                  <span className={cn("size-2 rounded-full", tab.dot)} />
                  {tab.label}
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-[11px] font-bold tabular-nums",
                      active ? "bg-background/20" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {tab.count.toLocaleString("th-TH")}
                  </span>
                </button>
              );
            })}
          </div>
          <span className="mx-1 h-6 w-px shrink-0 bg-border" />
          <div className="flex shrink-0 gap-1.5 md:flex-wrap">
            {[
              { id: "low", label: t("filterLow"), count: counts.low, tone: "amber" },
              { id: "out", label: t("filterOut"), count: counts.out, tone: "rose" },
            ].map((chip) => {
              const active = stockFilter === chip.id;
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => list.handleFilterChange("stock", active ? "all" : chip.id)}
                  className={cn(
                    "inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-sm font-medium transition-colors",
                    chip.tone === "amber"
                      ? active
                        ? "border-amber-500 bg-amber-500 text-white"
                        : "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
                      : active
                        ? "border-rose-600 bg-rose-600 text-white"
                        : "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300",
                  )}
                >
                  {chip.id === "low" ? <AlertTriangle className="size-3.5" /> : <PackageX className="size-3.5" />}
                  {chip.label}
                  <span className="text-[11px] font-bold tabular-nums">{chip.count.toLocaleString("th-TH")}</span>
                  {active ? <X className="size-3.5" /> : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[14rem] flex-1">
            <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => onSearch(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="h-10 rounded-full ps-9 pe-9"
            />
            {query ? (
              <button
                type="button"
                onClick={() => onSearch("")}
                className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={t("clearSearch")}
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-10 gap-1.5 rounded-full">
                <ArrowUpDown className="size-4" />
                <span className="hidden sm:inline">{SORTS.find((s) => s.key === sortKey)?.label ?? t("sort.newest")}</span>
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
          <div className="flex h-10 items-center rounded-full border bg-background p-1">
            {(["grid", "list"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setView(mode)}
                aria-pressed={view === mode}
                aria-label={mode === "grid" ? t("viewGrid") : t("viewList")}
                className={cn(
                  "flex h-8 w-9 items-center justify-center rounded-full transition-colors",
                  view === mode ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {mode === "grid" ? <LayoutGrid className="size-4" /> : <List className="size-4" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Selection bar (tax change requests) */}
      {selectable && selected.size > 0 ? (
        <div className="sticky top-16 z-20 flex flex-wrap items-center justify-between gap-2 rounded-2xl border bg-foreground px-4 py-2.5 text-background shadow-lg">
          <span className="text-sm font-semibold">{t("selected", { count: selected.size })}</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" className="rounded-full" onClick={() => setTaxRequestIds([...selected])}>
              <Percent className="size-4" />
              {tRoot("admin.settings.tax.request.bulkAction")}
            </Button>
            <Button size="sm" variant="ghost" className="rounded-full text-background hover:bg-background/10 hover:text-background" onClick={() => setSelected(new Set())}>
              {t("clearSelection")}
            </Button>
          </div>
        </div>
      ) : null}

      {/* Results */}
      <div className="relative">
        {list.isLoading ? (
          <div className="absolute inset-x-0 -top-2 z-10 h-1 animate-pulse rounded-full bg-emerald-500/70" />
        ) : null}

        {list.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed bg-card px-6 py-16 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <ShoppingBag className="size-7" />
            </span>
            <p className="mt-4 text-lg font-bold">{filtered ? t("emptyFiltered") : t("empty")}</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">{filtered ? t("emptyFilteredHint") : t("emptyHint")}</p>
            {!filtered && canCreateProduct ? (
              <Button asChild className="mt-5 rounded-full">
                <Link href="/vendor/products/new">
                  <Plus className="size-4" />
                  {tRoot("vendor.addProduct")}
                </Link>
              </Button>
            ) : null}
          </div>
        ) : view === "grid" ? (
          <ul
            className={cn(
              "grid grid-cols-2 gap-3 transition-opacity sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6",
              list.isLoading && "pointer-events-none opacity-60",
            )}
          >
            {list.items.map((p, index) => {
              const tone = toneOf(p);
              const style = TONE[tone];
              const stock = Number(p.stock ?? 0);
              const isSelected = selected.has(p._id);
              return (
                <li
                  key={p._id}
                  className={cn(
                    "group relative flex flex-col overflow-hidden rounded-2xl border shadow-sm ring-2 ring-transparent transition-all hover:-translate-y-0.5 hover:shadow-md",
                    style.card,
                    style.ring,
                    isSelected && "ring-foreground",
                  )}
                >
                  <Link href={productHref(p)} className="relative block aspect-square overflow-hidden bg-white dark:bg-muted">
                    <AppImage
                      src={p.images?.[0]}
                      alt={p.name}
                      fill
                      sizes="(min-width:1536px) 16vw, (min-width:1024px) 24vw, (min-width:640px) 32vw, 48vw"
                      priority={index < 4}
                      className={cn(
                        "object-cover transition-transform duration-300 group-hover:scale-105",
                        tone === "unlisted" && "grayscale-[60%]",
                        tone === "soldout" && "opacity-80",
                      )}
                      fallback={
                        <span className="flex size-full items-center justify-center text-muted-foreground">
                          <ImageOff className="size-8" />
                        </span>
                      }
                    />
                    <span className={cn("absolute start-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-bold shadow-sm", style.chip)}>
                      {statusLabel(tone)}
                    </span>
                    {p.featured ? (
                      <span className="absolute end-2 top-2 flex size-6 items-center justify-center rounded-full bg-white/90 text-amber-500 shadow-sm">
                        <Star className="size-3.5 fill-current" />
                      </span>
                    ) : null}
                    {tone !== "soldout" && stock <= LOW_STOCK && stock > 0 ? (
                      <span className="absolute bottom-2 start-2">{stockBadge(p)}</span>
                    ) : null}
                  </Link>

                  {selectable ? (
                    <label className="absolute end-2 top-10 flex size-7 cursor-pointer items-center justify-center rounded-full bg-white/90 shadow-sm">
                      <Checkbox checked={isSelected} onCheckedChange={() => toggle(p._id)} aria-label={t("select")} />
                    </label>
                  ) : null}

                  <div className="flex flex-1 flex-col gap-1.5 p-3">
                    <Link href={productHref(p)} className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-snug hover:underline">
                      {p.title || p.name}
                    </Link>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {p.category?.name || t("uncategorized")}
                    </p>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-base font-extrabold tabular-nums">{formatPrice(p.price)}</span>
                      {p.comparePrice && p.comparePrice > p.price ? (
                        <span className="text-xs text-muted-foreground line-through tabular-nums">{formatPrice(p.comparePrice)}</span>
                      ) : null}
                    </div>
                    <div className="mt-auto space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className={cn("font-semibold", stock <= 0 ? "text-rose-600" : stock <= LOW_STOCK ? "text-amber-600" : "text-muted-foreground")}>
                          {stock <= 0 ? t("soldOut") : t("inStock", { count: stock })}
                        </span>
                        {channels(p)}
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
                        <div
                          className={cn("h-full rounded-full", stock <= 0 ? "bg-rose-500" : stock <= LOW_STOCK ? "bg-amber-500" : "bg-emerald-500")}
                          style={{ width: `${stock <= 0 ? 100 : Math.min(100, Math.max(6, (stock / 50) * 100))}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-1 border-t border-black/5 px-2 py-1.5 dark:border-white/10">
                    {canEditProduct ? (
                      <Button asChild variant="ghost" size="sm" className="h-8 gap-1.5 rounded-full px-3">
                        <Link href={`/vendor/products/${p._id}/edit`}>
                          <Pencil className="size-3.5" />
                          {t("edit")}
                        </Link>
                      </Button>
                    ) : (
                      <span />
                    )}
                    {menu(p)}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className={cn("overflow-hidden rounded-2xl border bg-card shadow-sm transition-opacity", list.isLoading && "pointer-events-none opacity-60")}>
            <div className="hidden grid-cols-[auto_minmax(0,1fr)_120px_110px_110px_90px_44px] items-center gap-3 border-b bg-muted/40 px-4 py-2.5 text-xs font-semibold text-muted-foreground md:grid">
              {selectable ? (
                <Checkbox
                  checked={allOnPageSelected}
                  onCheckedChange={(v) =>
                    setSelected((prev) => {
                      const next = new Set(prev);
                      list.items.forEach((p) => (v ? next.add(p._id) : next.delete(p._id)));
                      return next;
                    })
                  }
                  aria-label={t("selectAll")}
                />
              ) : (
                <span />
              )}
              <span>{t("colProduct")}</span>
              <span>{t("colStatus")}</span>
              <span className="text-end">{t("colPrice")}</span>
              <span className="text-end">{t("colStock")}</span>
              <span>{t("colChannels")}</span>
              <span />
            </div>
            <ul className="divide-y">
              {list.items.map((p) => {
                const tone = toneOf(p);
                const style = TONE[tone];
                const stock = Number(p.stock ?? 0);
                return (
                  <li
                    key={p._id}
                    className={cn(
                      "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-s-4 px-4 py-3 md:grid-cols-[auto_minmax(0,1fr)_120px_110px_110px_90px_44px]",
                      tone === "active" && "border-s-emerald-500 bg-emerald-50/40 dark:bg-emerald-500/5",
                      tone === "draft" && "border-s-amber-500 bg-amber-50/50 dark:bg-amber-500/5",
                      tone === "unlisted" && "border-s-slate-400 bg-slate-50 dark:bg-slate-500/5",
                      tone === "soldout" && "border-s-rose-500 bg-rose-50/50 dark:bg-rose-500/5",
                    )}
                  >
                    {selectable ? (
                      <Checkbox checked={selected.has(p._id)} onCheckedChange={() => toggle(p._id)} aria-label={t("select")} />
                    ) : (
                      <span />
                    )}
                    <Link href={productHref(p)} className="flex min-w-0 items-center gap-3">
                      <span className="relative size-12 shrink-0 overflow-hidden rounded-xl border bg-white">
                        <AppImage
                          src={p.images?.[0]}
                          alt={p.name}
                          fill
                          sizes="48px"
                          className="object-cover"
                          fallback={
                            <span className="flex size-full items-center justify-center text-muted-foreground">
                              <ImageOff className="size-4" />
                            </span>
                          }
                        />
                      </span>
                      <span className="min-w-0">
                        <span className="line-clamp-1 text-sm font-semibold hover:underline">{p.title || p.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {p.category?.name || t("uncategorized")}
                          <span className="md:hidden"> · {formatPrice(p.price)} · {stock <= 0 ? t("soldOut") : t("inStock", { count: stock })}</span>
                        </span>
                      </span>
                    </Link>
                    <span className="hidden md:block">
                      <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold", style.chip)}>
                        {statusLabel(tone)}
                      </span>
                    </span>
                    <span className="hidden text-end text-sm font-bold tabular-nums md:block">{formatPrice(p.price)}</span>
                    <span
                      className={cn(
                        "hidden text-end text-sm font-semibold tabular-nums md:block",
                        stock <= 0 ? "text-rose-600" : stock <= LOW_STOCK ? "text-amber-600" : "",
                      )}
                    >
                      {stock.toLocaleString("th-TH")}
                    </span>
                    <span className="hidden md:block">{channels(p)}</span>
                    {menu(p)}
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
                {[12, 24, 48, 96].map((size) => (
                  <DropdownMenuItem key={size} onClick={() => list.handlePageSizeChange(size)}>
                    {size === pagination.limit ? <Check className="size-4" /> : <span className="size-4" />}
                    {t("perPage", { count: size })}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="outline"
              size="icon"
              className="size-9 rounded-full"
              disabled={pagination.page <= 1 || list.isLoading}
              onClick={() => list.handlePageChange(pagination.page - 1)}
              aria-label={t("prev")}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-[4.5rem] text-center font-medium tabular-nums">
              {pagination.page} / {Math.max(1, pagination.totalPages)}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="size-9 rounded-full"
              disabled={pagination.page >= pagination.totalPages || list.isLoading}
              onClick={() => list.handlePageChange(pagination.page + 1)}
              aria-label={t("next")}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      ) : null}

      {canImport ? (
        <ProductImportDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          endpoint={IMPORT_ENDPOINT}
          audience="vendor"
          onImported={() => {
            list.handlePageChange(1);
            list.refetch();
          }}
        />
      ) : null}
      {taxClasses ? (
        <TaxRequestDialog
          open={taxRequestIds.length > 0}
          onOpenChange={(open) => {
            if (!open) setTaxRequestIds([]);
          }}
          productIds={taxRequestIds}
          classes={taxClasses}
          onSent={() => setSelected(new Set())}
        />
      ) : null}
      {boostingEnabled ? (
        <BoostPurchaseDialog
          open={Boolean(boostTarget)}
          onOpenChange={(open) => {
            if (!open) setBoostTarget(null);
          }}
          locale={locale}
          preselectedProduct={boostTarget}
        />
      ) : null}
    </section>
  );
}

export function VendorProductsBoardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-36 rounded-full" />
      </div>
      <Skeleton className="h-[104px] rounded-2xl" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} className="overflow-hidden rounded-2xl border">
            <Skeleton className="aspect-square rounded-none" />
            <div className="space-y-2 p-3">
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="h-1.5 w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
