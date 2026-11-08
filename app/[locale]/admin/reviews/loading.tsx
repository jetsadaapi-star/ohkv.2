import { AdminListSkeleton } from "@/components/admin/admin-list-skeleton";
import { ReviewsStatsCardSkeleton } from "@/components/admin/reviews-stats-card";
import { Skeleton } from "@/components/ui/skeleton";

// The page heads with its own heading, then `ReviewsStatsCard` (four tiles and
// the rating card); the skeletons below keep that footprint. Counts mirror
// components/admin/reviews-data-table.tsx (5 tabs, 5 data columns).
export default function AdminReviewsLoading() {
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <Skeleton className="size-11 rounded-2xl" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-72" />
        </div>
      </div>
      <ReviewsStatsCardSkeleton />
      <AdminListSkeleton
        stats={0}
        columns={5}
        tabs={5}
        headerActions={0}
        toolbarAction={false}
      />
    </div>
  );
}
