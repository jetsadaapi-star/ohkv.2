import { Skeleton } from "@/components/ui/skeleton";

/** Placeholder for a row of vendor stat tiles (AdminStatsStrip variant="tiles"). */
export function VendorTilesSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="flex gap-3 overflow-hidden sm:grid sm:grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-[64px] min-w-[10rem] rounded-2xl sm:h-[72px]" />
      ))}
    </div>
  );
}
