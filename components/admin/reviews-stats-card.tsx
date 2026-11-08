import { CheckCircle2, Clock, MessageSquareText, Sparkles, Star } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminStatsStrip, type AdminStatsStripItem } from "@/components/admin/admin-stats-strip";
import { cn } from "@/lib/utils";
import type { ReviewsStats } from "@/lib/admin/reviews-types";

interface ReviewsStatsCardProps {
  stats: ReviewsStats;
}

const STAR_LEVELS = [5, 4, 3, 2, 1] as const;

function getPerformanceTier(average: number) {
  if (average >= 4.5) return "excellent" as const;
  if (average >= 4.0) return "good" as const;
  if (average >= 3.0) return "average" as const;
  if (average > 0) return "poor" as const;
  return "none" as const;
}

/** The tier in the status palette's words: great green, good blue, middling amber, poor red. */
const TIER_STYLES: Record<ReturnType<typeof getPerformanceTier>, string> = {
  excellent: "bg-emerald-100 text-emerald-800 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30",
  good: "bg-sky-100 text-sky-800 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/30",
  average: "bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30",
  poor: "bg-rose-100 text-rose-700 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30",
  none: "bg-muted text-muted-foreground ring-border",
};

/** Bars coloured by the score they count: praise green down to complaints red. */
const BAR_TONE: Record<(typeof STAR_LEVELS)[number], string> = {
  5: "bg-emerald-500",
  4: "bg-lime-500",
  3: "bg-amber-400",
  2: "bg-orange-500",
  1: "bg-rose-500",
};

/**
 * The reviews page's summary: four count tiles, then the average score beside
 * how the scores spread. A server component: nothing on it moves.
 */
export async function ReviewsStatsCard({ stats }: ReviewsStatsCardProps) {
  const t = await getTranslations();
  const tp = await getTranslations("admin.hc.adminPages.reviews");

  const tier = getPerformanceTier(stats.average);
  const tiles: AdminStatsStripItem[] = [
    { title: tp("tiles.total"), description: tp("tiles.total"), value: stats.total, icon: <MessageSquareText />, iconClassName: "bg-violet-100" },
    { title: tp("tiles.published"), description: tp("tiles.published"), value: stats.published, icon: <CheckCircle2 />, iconClassName: "bg-green-100" },
    { title: tp("tiles.onHold"), description: tp("tiles.onHoldHint"), value: stats.onHold, icon: <Clock />, iconClassName: "bg-amber-100" },
    { title: tp("tiles.week"), description: tp("tiles.week"), value: stats.weekDelta, icon: <Sparkles />, iconClassName: "bg-blue-100" },
  ];
  const filled = Math.round(stats.average);

  return (
    <div className="space-y-3">
      <AdminStatsStrip items={tiles} variant="tiles" />
      <div className="grid gap-3 rounded-2xl border bg-card p-4 shadow-sm sm:p-5 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8">
        <div className="flex items-center gap-4 rounded-xl bg-linear-to-br from-amber-50 to-white p-4 ring-1 ring-inset ring-amber-200 lg:flex-col lg:items-start lg:justify-center dark:from-amber-500/10 dark:to-card">
          <p className="text-5xl font-extrabold leading-none tracking-tight text-foreground tabular-nums">
            {stats.average.toFixed(1)}
          </p>
          <div className="min-w-0 space-y-1.5">
            <div className="flex items-center gap-0.5" aria-label={t("admin.reviewsPage.starsAriaLabel", { value: stats.average.toFixed(1) })}>
              {Array.from({ length: 5 }, (_, idx) => (
                <Star
                  key={idx}
                  className={cn(
                    "size-4",
                    idx < filled ? "fill-amber-400 text-amber-400" : "fill-muted text-muted",
                  )}
                />
              ))}
            </div>
            <p className="text-xs font-medium text-muted-foreground">
              {t("admin.reviewsPage.outOfReviews", { count: stats.total })}
            </p>
            <span
              className={cn(
                "inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold ring-1 ring-inset",
                TIER_STYLES[tier],
              )}
            >
              {t(`admin.reviewsPage.performance.${tier}`)}
            </span>
          </div>
        </div>

        <div className="flex min-w-0 flex-col justify-center gap-2.5">
          {STAR_LEVELS.map((level) => {
            const count = stats.breakdown[level] || 0;
            const width = stats.total ? Math.round((count / stats.total) * 100) : 0;
            return (
              <div key={level} className="grid grid-cols-[2.5rem_minmax(0,1fr)_3.5rem] items-center gap-3 text-sm">
                <span className="inline-flex items-center gap-1 font-semibold tabular-nums">
                  {level}
                  <Star className="size-3.5 fill-amber-400 text-amber-400" />
                </span>
                <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full transition-[width]", BAR_TONE[level])}
                    style={{ width: `${width}%` }}
                  />
                </div>
                <span className="text-right text-xs font-medium text-muted-foreground tabular-nums">
                  {count.toLocaleString()} · {width}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Same footprint as the card above, so the table below does not jump. */
export function ReviewsStatsCardSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex gap-3 overflow-hidden sm:grid sm:grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[64px] min-w-[10rem] rounded-2xl sm:h-[72px]" />
        ))}
      </div>
      <Skeleton className="h-[260px] w-full rounded-2xl lg:h-[178px]" />
    </div>
  );
}
