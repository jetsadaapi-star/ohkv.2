"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "@/components/language/link";
import {
  ArrowUpDown,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Clock3,
  Download,
  ExternalLink,
  Eye,
  Pencil,
  Plus,
  Search,
  Star,
  Tag,
  Upload,
  X,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AppImage } from "@/components/ui/app-image";
import { useListNavigation } from "@/hooks/use-list-navigation";
import { useCsvImportExport } from "@/hooks/use-csv-import-export";
import { cn } from "@/lib/utils";

interface VendorBrand {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  logo?: string;
  website?: string;
  isActive: boolean;
  featured: boolean;
  productCount: number;
  approvalStatus: "approved" | "pending" | "rejected";
  rejectionReason?: string;
  isOwn: boolean;
}

type Tone = "own" | "pending" | "rejected" | "inactive" | "catalog";
function toneOf(b: VendorBrand): Tone {
  if (b.isOwn && b.approvalStatus === "pending") return "pending";
  if (b.isOwn && b.approvalStatus === "rejected") return "rejected";
  if (!b.isActive) return "inactive";
  return b.isOwn ? "own" : "catalog";
}
const TONE: Record<Tone, string> = {
  own: "border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10",
  catalog: "border-sky-200 bg-sky-50/70 dark:border-sky-500/30 dark:bg-sky-500/10",
  pending: "border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10",
  rejected: "border-rose-200 bg-rose-50 dark:border-rose-500/30 dark:bg-rose-500/10",
  inactive: "border-slate-200 bg-slate-100 dark:border-slate-500/30 dark:bg-slate-500/10",
};
const CHIP: Record<Tone, string> = {
  own: "bg-emerald-600 text-white",
  catalog: "bg-sky-600 text-white",
  pending: "bg-amber-500 text-white",
  rejected: "bg-rose-600 text-white",
  inactive: "bg-slate-500 text-white",
};

export interface VendorBrandsBoardProps {
  canCreate?: boolean;
  canEdit?: boolean;
  data: VendorBrand[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  counts: { all: number; active: number; featured: number; inactive: number; pending: number };
}

/**
 * Brands a vendor can file products under: the shared catalogue plus the
 * vendor's own, coloured by whose they are and where their review stands.
 */
export function VendorBrandsBoard({ canCreate = false, canEdit = false, data, pagination, counts }: VendorBrandsBoardProps) {
  const t = useTranslations("admin.hc.vendorBrands");
  const list = useListNavigation<VendorBrand>({ items: data, pagination, defaultSortBy: "name", defaultSortOrder: "asc", defaultPageSize: 24 });
  const csv = useCsvImportExport({ endpoint: "/api/vendor/brands/import-export", noun: "brands", onImported: list.refetch });
  const canImport = canCreate || canEdit;
  const tab = list.activeTab;

  const [query, setQuery] = useState(list.search);
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(debounce.current), []);
  const onSearch = (value: string) => {
    setQuery(value);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => list.handleSearchChange(value.trim()), 350);
  };

  const SORTS = [
    { key: "name:asc", label: t("sort.name") },
    { key: "productCount:desc", label: t("sort.mostProducts") },
    { key: "createdAt:desc", label: t("sort.newest") },
  ];
  const sortKey = `${list.sortBy}:${list.sortOrder}`;
  const from = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const to = Math.min(pagination.total, pagination.page * pagination.limit);
  const filtered = Boolean(list.search) || tab !== "all";

  const tabs = [
    { id: "all", label: t("tab.all"), count: counts.all, dot: "bg-slate-400" },
    { id: "active", label: t("tab.active"), count: counts.active, dot: "bg-emerald-500" },
    { id: "featured", label: t("tab.featured"), count: counts.featured, dot: "bg-amber-400" },
    { id: "inactive", label: t("tab.inactive"), count: counts.inactive, dot: "bg-slate-500" },
    ...(counts.pending > 0 ? [{ id: "pending", label: t("tab.pending"), count: counts.pending, dot: "bg-amber-500" }] : []),
  ];

  return (
    <section className="space-y-4">
      <input id={csv.fileInputId} type="file" accept=".csv,text/csv" className="hidden" aria-label={t("importAria")} onChange={csv.handleFileChange} />

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{t("title")}</h1>
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
              <DropdownMenuItem disabled={!canImport || csv.isImporting} onClick={csv.openFilePicker}>
                <Upload className="size-4" />
                {t("import")}
              </DropdownMenuItem>
              <DropdownMenuItem disabled={csv.isExporting} onClick={csv.exportCsv}>
                <Download className="size-4" />
                {t("export")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {canCreate ? (
            <Button asChild className="gap-1.5 rounded-full bg-emerald-600 text-white shadow-sm hover:bg-emerald-700">
              <Link href="/vendor/brands/new">
                <Plus className="size-4" />
                {t("add")}
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-3 rounded-2xl border bg-card p-3 shadow-sm">
        <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0 [&::-webkit-scrollbar]:hidden">
          {tabs.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => list.handleTabChange(item.id)}
                className={cn(
                  "inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3.5 text-sm font-medium transition-colors",
                  active ? "border-foreground bg-foreground text-background" : "bg-background hover:bg-muted",
                )}
              >
                <span className={cn("size-2 rounded-full", item.dot)} />
                {item.label}
                <span className={cn("rounded-full px-1.5 text-[11px] font-bold tabular-nums", active ? "bg-background/20" : "bg-muted text-muted-foreground")}>
                  {item.count.toLocaleString("th-TH")}
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
        {/* Legend: what the card colours mean */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 px-1 text-[11px] text-muted-foreground">
          {(["own", "catalog", "pending", "rejected", "inactive"] as Tone[]).map((tone) => (
            <span key={tone} className="inline-flex items-center gap-1.5">
              <span className={cn("size-2.5 rounded-full", CHIP[tone])} />
              {t(`tone.${tone}`)}
            </span>
          ))}
        </div>
      </div>

      {/* Cards */}
      <div className="relative">
        {list.isLoading ? <div className="absolute inset-x-0 -top-2 z-10 h-1 animate-pulse rounded-full bg-emerald-500/70" /> : null}
        {list.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed bg-card px-6 py-16 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <Tag className="size-7" />
            </span>
            <p className="mt-4 text-lg font-bold">{filtered ? t("emptyFiltered") : t("empty")}</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">{filtered ? t("emptyFilteredHint") : t("emptyHint")}</p>
          </div>
        ) : (
          <ul className={cn("grid gap-3 transition-opacity sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4", list.isLoading && "pointer-events-none opacity-60")}>
            {list.items.map((brand) => {
              const tone = toneOf(brand);
              const editable = canEdit && brand.isOwn;
              return (
                <li key={brand._id} className={cn("group relative flex flex-col overflow-hidden rounded-2xl border shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md", TONE[tone])}>
                  <div className="flex items-start gap-3 p-3">
                    <Link
                      href={editable ? `/vendor/brands/${brand._id}/edit` : `/vendor/products?search=${encodeURIComponent(brand.name)}`}
                      className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/5"
                    >
                      {brand.logo ? (
                        <AppImage src={brand.logo} alt={brand.name} fill sizes="56px" className={cn("object-contain p-1.5", tone === "inactive" && "grayscale")} />
                      ) : (
                        <span className="text-xl font-extrabold text-muted-foreground">{brand.name.trim().charAt(0).toUpperCase() || "?"}</span>
                      )}
                    </Link>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-1">
                        <p className="line-clamp-2 text-sm font-bold leading-snug">{brand.name}</p>
                        {brand.featured ? <Star className="mt-0.5 size-4 shrink-0 fill-amber-400 text-amber-400" aria-label={t("tab.featured")} /> : null}
                      </div>
                      <p className="truncate font-mono text-[10px] text-muted-foreground">/{brand.slug}</p>
                      <span className={cn("mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold", CHIP[tone])}>{t(`tone.${tone}`)}</span>
                    </div>
                  </div>
                  {tone === "rejected" && brand.rejectionReason ? (
                    <p className="mx-3 mb-2 flex items-start gap-1 rounded-lg bg-white/70 px-2 py-1.5 text-[11px] text-rose-700 dark:bg-black/20 dark:text-rose-300">
                      <XCircle className="mt-0.5 size-3 shrink-0" />
                      {brand.rejectionReason}
                    </p>
                  ) : tone === "pending" ? (
                    <p className="mx-3 mb-2 flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-300">
                      <Clock3 className="size-3" />
                      {t("awaitingReview")}
                    </p>
                  ) : null}
                  <div className="mt-auto flex items-center justify-between gap-1 border-t border-black/5 py-1.5 ps-3 pe-2 dark:border-white/10">
                    <p className="text-xs">
                      <span className="text-base font-extrabold tabular-nums">{brand.productCount}</span>{" "}
                      <span className="text-muted-foreground">{t("yourProducts")}</span>
                    </p>
                    <div className="flex items-center">
                      <Button asChild variant="ghost" size="icon" className="size-8 rounded-full" aria-label={t("viewProducts")} title={t("viewProducts")}>
                        <Link href={`/vendor/products?search=${encodeURIComponent(brand.name)}`}>
                          <Eye className="size-3.5" />
                        </Link>
                      </Button>
                      {editable ? (
                        <Button asChild variant="ghost" size="icon" className="size-8 rounded-full" aria-label={t("edit")} title={t("edit")}>
                          <Link href={`/vendor/brands/${brand._id}/edit`}>
                            <Pencil className="size-3.5" />
                          </Link>
                        </Button>
                      ) : brand.website ? (
                        <Button asChild variant="ghost" size="icon" className="size-8 rounded-full" aria-label={t("website")} title={t("website")}>
                          <a href={brand.website} target="_blank" rel="noreferrer">
                            <ExternalLink className="size-3.5" />
                          </a>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
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
                {[12, 24, 48].map((size) => (
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
    </section>
  );
}

export function VendorBrandsBoardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-40 rounded-full" />
      </div>
      <Skeleton className="h-[120px] rounded-2xl" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {Array.from({ length: 9 }, (_, i) => (
          <Skeleton key={i} className="h-32 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
