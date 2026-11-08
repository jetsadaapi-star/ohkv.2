"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CalendarDays, Clock, Compass, Heart, MessageSquareText, ShoppingBag, Star, Timer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SectionCard } from "../section-card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast-notification";
import { apiClient } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { SummaryStat } from "../summary-stat";
import type { CustomerHeaderData } from "../customer-detail-types";
import { useApplyOnChange } from "@/hooks/use-apply-on-change";

interface RecentReview {
  _id: string;
  productId: string | null;
  productName: string;
  productImage?: string;
  rating: number;
  title?: string;
  comment: string;
  isApproved: boolean;
  createdAt: string;
}

interface ActivityResponse {
  reviewCount: number;
  wishlistCount: number;
  recentReviews: RecentReview[];
}

interface ActivityTabProps {
  customerId: string;
  acquisitionSource?: string;
  lastActiveAt?: string;
  createdAt?: string;
  stats: CustomerHeaderData["stats"];
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((value) => (
        <Star
          key={value}
          className={cn(
            "h-3.5 w-3.5",
            value <= rating
              ? "fill-yellow-400 text-yellow-400"
              : "text-muted-foreground/40",
          )}
        />
      ))}
    </div>
  );
}

function formatDate(date: string | undefined, locale: string) {
  if (!date) return "—";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function ActivityTab({
  customerId,
  acquisitionSource,
  lastActiveAt,
  createdAt,
  stats,
}: ActivityTabProps) {
  const t = useTranslations("admin.hc.customerDetail");
  const locale = useLocale();
  const [data, setData] = useState<ActivityResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useApplyOnChange([customerId], () => {
    setIsLoading(true);
  });

  useEffect(() => {
    let active = true;

    apiClient
      .get<ActivityResponse>(`/api/admin/customers/${customerId}/activity`)
      .then((res) => {
        if (active) setData(res);
      })
      .catch((error) => {
        if (!active) return;
        console.error("Failed to load customer activity:", error);
        toast.error(t("activityLoadFailed"));
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
    // `t` is stable for the page's language.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  const averageRating = stats.averageRating
    ? stats.averageRating.toFixed(1)
    : "—";

  const timeline = [
    { icon: CalendarDays, label: t("customerSinceShort"), value: formatDate(createdAt, locale) },
    { icon: Clock, label: t("lastActiveShort"), value: formatDate(lastActiveAt, locale) },
    { icon: ShoppingBag, label: t("kpiLastOrder"), value: formatDate(stats.lastOrderDate, locale) },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryStat
          icon={MessageSquareText}
          tone="sky"
          label={t("reviews")}
          value={(data?.reviewCount ?? stats.totalReviews ?? 0).toLocaleString(locale)}
        />
        <SummaryStat icon={Star} tone="amber" label={t("avgRating")} value={averageRating} />
        <SummaryStat
          icon={Heart}
          tone="rose"
          label={t("wishlist")}
          value={(data?.wishlistCount ?? stats.totalWishlistItems ?? 0).toLocaleString(locale)}
        />
        <SummaryStat icon={Compass} tone="violet" label={t("acquisitionShort")} value={acquisitionSource?.trim() || t("direct")} />
      </div>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-3">
        <SectionCard
          icon={MessageSquareText}
          tone="sky"
          title={t("recentReviews")}
          description={t("recentReviewsDescription")}
          className="lg:col-span-2"
        >
          {isLoading ? (
            <ul className="divide-y">
              {Array.from({ length: 4 }).map((_, index) => (
                <li key={index} className="flex gap-3 py-3 first:pt-0">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-5 w-16 shrink-0 rounded-full" />
                    </div>
                    <Skeleton className="h-3.5 w-24" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                </li>
              ))}
            </ul>
          ) : !data?.recentReviews.length ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
              <MessageSquareText className="size-8 opacity-40" />
              <p className="text-sm">{t("noReviews")}</p>
            </div>
          ) : (
            <ul className="divide-y">
              {data.recentReviews.map((review) => (
                <li key={review._id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium">{review.productName}</p>
                      <Badge variant={review.isApproved ? "default" : "outline"} className="shrink-0">
                        {review.isApproved ? t("published") : t("pendingReview")}
                      </Badge>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <Stars rating={review.rating} />
                      <span className="text-xs text-muted-foreground">{formatDate(review.createdAt, locale)}</span>
                    </div>
                    {review.title && <p className="mt-1 text-sm font-medium">{review.title}</p>}
                    <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{review.comment}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard icon={Timer} tone="emerald" title={t("timeline")} description={t("timelineDescription")}>
          <ol className="relative space-y-5 border-s ps-5">
            {timeline.map(({ icon: Icon, label, value }) => (
              <li key={label} className="relative">
                <span className="absolute -start-[1.95rem] top-0 flex size-6 items-center justify-center rounded-full border bg-card text-emerald-600">
                  <Icon className="size-3.5" />
                </span>
                <p className="text-xs font-medium text-muted-foreground">{label}</p>
                <p className="text-sm font-semibold">{value}</p>
              </li>
            ))}
          </ol>
        </SectionCard>
      </div>
    </div>
  );
}
