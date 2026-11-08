"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import Link from "@/components/language/link";
import {
  ArrowRight,
  ArrowRightLeft,
  Ban,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FilePen,
  MapPin,
  PackageCheck,
  Plus,
  Search,
  Truck,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useListNavigation } from "@/hooks/use-list-navigation";
import type { TransferStatus } from "@/components/admin/transfers/transfer-status-badge";
import type { TransferStatusCounters } from "@/lib/inventory/transfer-list";
import { cn } from "@/lib/utils";

interface TransferRow {
  _id: string;
  transferNumber: string;
  status: TransferStatus;
  fromLocationName: string;
  toLocationName: string;
  itemCount: number;
  totalLines: number;
  receivedUnits: number;
  rejectedUnits: number;
  createdAt: string;
  updatedAt: string;
}

const STATUS: Record<TransferStatus, { icon: typeof Truck; row: string; pill: string; dot: string }> = {
  draft: { icon: FilePen, row: "border-s-slate-400 bg-slate-50 dark:bg-slate-500/5", pill: "bg-slate-600 text-white", dot: "bg-slate-400" },
  ready_to_ship: { icon: PackageCheck, row: "border-s-amber-500 bg-amber-50/70 dark:bg-amber-500/10", pill: "bg-amber-500 text-white", dot: "bg-amber-500" },
  in_transit: { icon: Truck, row: "border-s-sky-500 bg-sky-50/70 dark:bg-sky-500/10", pill: "bg-sky-600 text-white", dot: "bg-sky-500" },
  completed: { icon: CheckCircle2, row: "border-s-emerald-500 bg-emerald-50/60 dark:bg-emerald-500/5", pill: "bg-emerald-600 text-white", dot: "bg-emerald-500" },
  cancelled: { icon: Ban, row: "border-s-rose-400 bg-rose-50/60 dark:bg-rose-500/5", pill: "bg-rose-600 text-white", dot: "bg-rose-500" },
};
const ORDER: TransferStatus[] = ["draft", "ready_to_ship", "in_transit", "completed", "cancelled"];

export interface VendorTransfersBoardProps {
  data: TransferRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  counters: TransferStatusCounters;
  locationOptions: Array<{ id: string; name: string }>;
}

/** Stock moving between the vendor's own locations, coloured by where each move has got to. */
export function VendorTransfersBoard({ data, pagination, counters, locationOptions }: VendorTransfersBoardProps) {
  const t = useTranslations();
  const tv = useTranslations("admin.hc.vendorTransfers");
  const locale = useLocale();
  const base = "/vendor/transfers";

  const list = useListNavigation<TransferRow>({ items: data, pagination, defaultPageSize: 20, filterIds: ["location"] });
  const status = list.activeTab;
  const locationId = list.filters.location && list.filters.location !== "all" ? list.filters.location : "all";

  const [query, setQuery] = useState(list.search);
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(debounce.current), []);
  const onSearch = (value: string) => {
    setQuery(value);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => list.handleSearchChange(value.trim()), 350);
  };

  const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });

  const exportCsv = () => {
    const header = ["transfer", "from", "to", "status", "units", "lines", "updated"];
    const body = list.items.map((r) =>
      [r.transferNumber, r.fromLocationName, r.toLocationName, t(`admin.transfers.status.${r.status}`), r.itemCount, r.totalLines, dateFmt.format(new Date(r.updatedAt))]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob(["﻿" + [header.join(","), ...body].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transfers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const from = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const to = Math.min(pagination.total, pagination.page * pagination.limit);
  const filtered = Boolean(list.search) || status !== "all" || locationId !== "all";

  return (
    <section className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{t("admin.transfers.list.title")}</h1>
          <p className="text-sm text-muted-foreground">{tv("subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" className="gap-1.5 rounded-full" onClick={exportCsv} disabled={list.items.length === 0}>
            <Download className="size-4" />
            {tv("export")}
          </Button>
          <Button asChild className="gap-1.5 rounded-full bg-emerald-600 text-white shadow-sm hover:bg-emerald-700">
            <Link href={`${base}/new`}>
              <Plus className="size-4" />
              {t("admin.transfers.list.createTransfer")}
            </Link>
          </Button>
        </div>
      </div>

      {/* Pipeline: one tile per stage, also the status filter */}
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-5 sm:overflow-visible sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden">
        {ORDER.map((key) => {
          const S = STATUS[key];
          const active = status === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => list.handleTabChange(active ? "all" : key)}
              className={cn(
                "flex min-w-[9.5rem] shrink-0 snap-start items-center gap-3 rounded-2xl border bg-card p-3 text-start shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md sm:min-w-0",
                active && "ring-2 ring-foreground",
              )}
            >
              <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm", S.pill)}>
                <S.icon className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-medium text-muted-foreground">{t(`admin.transfers.status.${key}`)}</span>
                <span className="block text-xl font-extrabold tabular-nums">{(counters[key] ?? 0).toLocaleString("th-TH")}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-card p-3 shadow-sm">
        <button
          type="button"
          onClick={() => list.handleTabChange("all")}
          className={cn(
            "inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-sm font-medium transition-colors",
            status === "all" ? "border-foreground bg-foreground text-background" : "bg-background hover:bg-muted",
          )}
        >
          {t("admin.transfers.tabs.all")}
          <span className={cn("rounded-full px-1.5 text-[11px] font-bold tabular-nums", status === "all" ? "bg-background/20" : "bg-muted text-muted-foreground")}>
            {counters.all ?? 0}
          </span>
        </button>
        {status !== "all" ? (
          <button
            type="button"
            onClick={() => list.handleTabChange("all")}
            className={cn("inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-semibold", STATUS[status as TransferStatus]?.pill)}
          >
            {t(`admin.transfers.status.${status}`)}
            <X className="size-3.5" />
          </button>
        ) : null}
        <div className="relative min-w-[14rem] flex-1">
          <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => onSearch(e.target.value)} placeholder={t("admin.transfers.list.searchPlaceholder")} className="h-10 rounded-full ps-9 pe-9" />
          {query ? (
            <button type="button" onClick={() => onSearch("")} className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label={tv("clearSearch")}>
              <X className="size-4" />
            </button>
          ) : null}
        </div>
        {locationOptions.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className={cn("h-10 gap-1.5 rounded-full", locationId !== "all" && "border-teal-500 text-teal-700 dark:text-teal-300")}>
                <MapPin className="size-4" />
                <span className="max-w-[10rem] truncate">
                  {locationId !== "all" ? locationOptions.find((l) => l.id === locationId)?.name : tv("allLocations")}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuRadioGroup value={locationId} onValueChange={(v) => list.handleFilterChange("location", v)}>
                <DropdownMenuRadioItem value="all">{tv("allLocations")}</DropdownMenuRadioItem>
                {locationOptions.map((loc) => (
                  <DropdownMenuRadioItem key={loc.id} value={loc.id}>
                    {loc.name}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      {/* Rows */}
      <div className="relative">
        {list.isLoading ? <div className="absolute inset-x-0 -top-2 z-10 h-1 animate-pulse rounded-full bg-emerald-500/70" /> : null}
        {list.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed bg-card px-6 py-16 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <ArrowRightLeft className="size-7" />
            </span>
            <p className="mt-4 text-lg font-bold">{filtered ? tv("emptyFiltered") : tv("empty")}</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">{filtered ? tv("emptyFilteredHint") : tv("emptyHint")}</p>
            {!filtered ? (
              <Button asChild className="mt-5 rounded-full">
                <Link href={`${base}/new`}>
                  <Plus className="size-4" />
                  {t("admin.transfers.list.createTransfer")}
                </Link>
              </Button>
            ) : null}
          </div>
        ) : (
          <ul className={cn("space-y-2 transition-opacity", list.isLoading && "pointer-events-none opacity-60")}>
            {list.items.map((row) => {
              const S = STATUS[row.status] ?? STATUS.draft;
              const done = row.receivedUnits + row.rejectedUnits;
              const progress = row.itemCount > 0 ? Math.min(100, Math.round((done / row.itemCount) * 100)) : 0;
              return (
                <li key={row._id}>
                  <Link
                    href={`${base}/${row._id}`}
                    className={cn(
                      "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 rounded-2xl border border-s-4 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md md:grid-cols-[180px_minmax(0,1fr)_160px_150px]",
                      S.row,
                    )}
                  >
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-bold">{row.transferNumber}</p>
                      <p className="text-[11px] text-muted-foreground">{dateFmt.format(new Date(row.updatedAt))}</p>
                    </div>
                    <span className={cn("inline-flex items-center gap-1.5 justify-self-end rounded-full px-2.5 py-1 text-[11px] font-bold md:order-last", S.pill)}>
                      <S.icon className="size-3.5" />
                      {t(`admin.transfers.status.${row.status}`)}
                    </span>
                    {/* Route */}
                    <div className="col-span-2 flex min-w-0 items-center gap-2 md:col-span-1">
                      <span className="inline-flex min-w-0 items-center gap-1.5 rounded-xl bg-background px-2.5 py-1.5 text-sm font-medium ring-1 ring-border">
                        <MapPin className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate">{row.fromLocationName}</span>
                      </span>
                      <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                      <span className="inline-flex min-w-0 items-center gap-1.5 rounded-xl bg-background px-2.5 py-1.5 text-sm font-medium ring-1 ring-border">
                        <MapPin className="size-3.5 shrink-0 text-emerald-600" />
                        <span className="truncate">{row.toLocationName}</span>
                      </span>
                    </div>
                    {/* Quantity + receipt progress */}
                    <div className="col-span-2 min-w-0 md:col-span-1">
                      <p className="text-sm font-semibold tabular-nums">
                        {t("admin.transfers.list.itemsSummary", { units: row.itemCount, lines: row.totalLines })}
                      </p>
                      {row.status === "in_transit" || row.status === "completed" ? (
                        <div className="mt-1">
                          <div className="h-1.5 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
                            <div className={cn("h-full rounded-full", row.status === "completed" ? "bg-emerald-500" : "bg-sky-500")} style={{ width: `${row.status === "completed" ? 100 : progress}%` }} />
                          </div>
                          <p className="mt-0.5 text-[10px] text-muted-foreground tabular-nums">
                            {tv("received", { done: row.status === "completed" ? row.itemCount : done, total: row.itemCount })}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
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
                {[10, 20, 50].map((size) => (
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
    </section>
  );
}

export function VendorTransfersBoardSkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-40 rounded-full" />
      </div>
      <div className="flex gap-3 overflow-hidden sm:grid sm:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-[66px] min-w-[9.5rem] rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-16 rounded-2xl" />
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-20 rounded-2xl" />
      ))}
    </div>
  );
}
