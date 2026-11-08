import { getTranslations } from "next-intl/server";
import { AlertTriangle, Boxes, MapPin, PackageX, Warehouse } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface VendorInventoryStatsData {
  totalSkus: number;
  lowStockSkus: number;
  outOfStockSkus: number;
  onHandUnits: number;
  activeLocations: number;
}

const TILES = [
  { key: "skus", icon: Boxes, tone: "from-sky-50 text-sky-700 ring-sky-200 dark:from-sky-500/10", iconTone: "bg-sky-500 text-white" },
  { key: "low", icon: AlertTriangle, tone: "from-amber-50 text-amber-700 ring-amber-200 dark:from-amber-500/10", iconTone: "bg-amber-500 text-white" },
  { key: "out", icon: PackageX, tone: "from-rose-50 text-rose-700 ring-rose-200 dark:from-rose-500/10", iconTone: "bg-rose-500 text-white" },
  { key: "units", icon: Warehouse, tone: "from-violet-50 text-violet-700 ring-violet-200 dark:from-violet-500/10", iconTone: "bg-violet-500 text-white" },
  { key: "locations", icon: MapPin, tone: "from-teal-50 text-teal-700 ring-teal-200 dark:from-teal-500/10", iconTone: "bg-teal-500 text-white" },
] as const;

/** The five numbers above the vendor's stock list. */
export async function VendorInventoryStats({ stats }: { stats: VendorInventoryStatsData }) {
  const t = await getTranslations("admin.hc.vendorInventory");
  const values: Record<(typeof TILES)[number]["key"], number> = {
    skus: stats.totalSkus,
    low: stats.lowStockSkus,
    out: stats.outOfStockSkus,
    units: stats.onHandUnits,
    locations: stats.activeLocations,
  };
  return (
    <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 sm:pb-0 xl:grid-cols-5 [&::-webkit-scrollbar]:hidden">
      {TILES.map(({ key, icon: Icon, tone, iconTone }) => (
        <div
          key={key}
          className={cn(
            "flex min-w-[9.5rem] shrink-0 snap-start items-center gap-3 rounded-2xl bg-linear-to-br to-white p-3 ring-1 ring-inset sm:min-w-0 sm:p-4 dark:to-card",
            tone,
          )}
        >
          <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl shadow-sm sm:size-10", iconTone)}>
            <Icon className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium opacity-80">{t(`stat.${key}`)}</p>
            <p className="text-xl font-extrabold tracking-tight text-foreground tabular-nums sm:text-2xl">
              {values[key].toLocaleString("th-TH")}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function VendorInventoryStatsSkeleton() {
  return (
    <div className="flex gap-3 overflow-hidden sm:grid sm:grid-cols-3 xl:grid-cols-5">
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} className="h-[64px] min-w-[9.5rem] rounded-2xl sm:h-[72px]" />
      ))}
    </div>
  );
}
