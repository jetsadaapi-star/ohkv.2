import { getTranslations } from "next-intl/server";
import { AlertTriangle, BadgeCheck, Boxes, PackageX, Warehouse } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface VendorProductsStats {
  totalProducts: number;
  activeProducts: number;
  draftProducts: number;
  unlistedProducts: number;
  outOfStockProducts: number;
  lowStockProducts: number;
  totalInventoryUnits: number;
}

const TILES = [
  { key: "total", icon: Boxes, tone: "from-slate-50 to-white text-slate-700 ring-slate-200 dark:from-slate-500/10", iconTone: "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900" },
  { key: "active", icon: BadgeCheck, tone: "from-emerald-50 to-white text-emerald-700 ring-emerald-200 dark:from-emerald-500/10", iconTone: "bg-emerald-500 text-white" },
  { key: "low", icon: AlertTriangle, tone: "from-amber-50 to-white text-amber-700 ring-amber-200 dark:from-amber-500/10", iconTone: "bg-amber-500 text-white" },
  { key: "out", icon: PackageX, tone: "from-rose-50 to-white text-rose-700 ring-rose-200 dark:from-rose-500/10", iconTone: "bg-rose-500 text-white" },
  { key: "units", icon: Warehouse, tone: "from-violet-50 to-white text-violet-700 ring-violet-200 dark:from-violet-500/10", iconTone: "bg-violet-500 text-white" },
] as const;

/** The five numbers above the vendor's product grid. */
export async function VendorProductsStats({ stats }: { stats: VendorProductsStats }) {
  const t = await getTranslations("admin.hc.vendorProducts");
  const values: Record<(typeof TILES)[number]["key"], number> = {
    total: stats.totalProducts,
    active: stats.activeProducts,
    low: stats.lowStockProducts,
    out: stats.outOfStockProducts,
    units: stats.totalInventoryUnits,
  };
  return (
    <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 sm:pb-0 xl:grid-cols-5 [&::-webkit-scrollbar]:hidden">
      {TILES.map(({ key, icon: Icon, tone, iconTone }) => (
        <div
          key={key}
          className={cn(
            "flex min-w-[9.5rem] shrink-0 snap-start items-center gap-3 rounded-2xl bg-linear-to-br p-3 ring-1 ring-inset sm:min-w-0 sm:p-4 dark:to-card",
            tone,
          )}
        >
          <span className={cn("flex size-9 shrink-0 sm:size-10 items-center justify-center rounded-xl shadow-sm", iconTone)}>
            <Icon className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium opacity-80">{t(`stat.${key}`)}</p>
            <p className="text-xl font-extrabold sm:text-2xl tracking-tight tabular-nums text-foreground">
              {values[key].toLocaleString("th-TH")}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function VendorProductsStatsSkeleton() {
  return (
    <div className="flex gap-3 overflow-hidden sm:grid sm:grid-cols-3 xl:grid-cols-5">
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} className="h-[64px] min-w-[9.5rem] rounded-2xl sm:h-[72px]" />
      ))}
    </div>
  );
}
