import { Suspense } from "react";
import { BadgeCheck, Ban, Clock, Star, Tag } from "lucide-react";
import {
  AdminStatsStrip,
  AdminStatsStripSkeleton,
  type AdminStatsStripItem,
} from "@/components/admin/admin-stats-strip";
import { getTranslations } from "next-intl/server";
import { AdminListSkeleton } from "@/components/admin/admin-list-skeleton";
import { AdminBrandsHeader } from "@/components/admin/admin-page-headers";
import { VendorTilesSkeleton } from "@/components/vendor/vendor-tiles-skeleton";
import { BrandsDataTable } from "@/components/admin/brands-data-table";
import type { StaffResourceActions } from "@/lib/access/staff-resource-actions";
import { fetchBrandList, fetchBrandStats } from "@/lib/catalog/brand-list";
import { serializeRows } from "@/lib/api/list-query";

interface PageProps {
  locale: string;
  area?: "admin" | "staff";
  actionAccess?: StaffResourceActions;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

const DEFAULT_PAGE_SIZE = 10;

export async function BrandsListView({
  locale,
  area = "admin",
  actionAccess,
  searchParams,
}: PageProps) {
  const search = await searchParams;
  // The admin page gets the vendor area's look; the staff area keeps its own.
  const modern = area === "admin";

  return (
    <div className={modern ? "space-y-5" : "space-y-4"}>
      {modern ? <AdminBrandsHeader /> : null}
      <Suspense fallback={modern ? <VendorTilesSkeleton count={5} /> : <AdminStatsStripSkeleton items={5} />}>
        <BrandsStats variant={modern ? "tiles" : "strip"} />
      </Suspense>

      <Suspense
        fallback={<AdminListSkeleton stats={0} columns={5} tabs={5} thumbnail />}
      >
        <BrandsTable locale={locale} area={area} actionAccess={actionAccess} searchParams={search} />
      </Suspense>
    </div>
  );
}

async function BrandsTable({
  locale,
  area,
  actionAccess,
  searchParams,
}: {
  locale: string;
  area: "admin" | "staff";
  actionAccess?: StaffResourceActions;
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  // Rebuilt as URLSearchParams so the page reads the query string through the
  // very same parser `/api/brands` uses.
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string") params.set(key, value);
  }
  if (!params.get("page")) params.set("page", "1");
  if (!params.get("limit")) params.set("limit", String(DEFAULT_PAGE_SIZE));

  const list = await fetchBrandList(params, { isAdmin: true });

  return (
    <BrandsDataTable
      locale={locale}
      area={area}
      actionAccess={actionAccess}
      data={serializeRows(list.items)}
      pagination={{
        page: list.page,
        limit: list.limit,
        total: list.total,
        totalPages: list.totalPages,
      }}
    />
  );
}

async function BrandsStats({ variant }: { variant: "strip" | "tiles" }) {
  const [stats, t] = await Promise.all([
    fetchBrandStats(),
    getTranslations("admin.hc.adminPages.brands.stats"),
  ]);

  const items: AdminStatsStripItem[] = [
    {
      title: t("total.title"),
      value: stats.totalBrands,
      description: t("total.description"),
      icon: <Tag className="h-5 w-5" />,
      iconClassName: "text-blue-700 bg-blue-100",
    },
    {
      title: t("active.title"),
      value: stats.activeBrands,
      description: t("active.description"),
      icon: <BadgeCheck className="h-5 w-5" />,
      iconClassName: "text-green-700 bg-green-100",
    },
    {
      title: t("inactive.title"),
      value: stats.inactiveBrands,
      description: t("inactive.description"),
      icon: <Ban className="h-5 w-5" />,
      iconClassName: variant === "tiles" ? "text-slate-700 bg-slate-100" : "text-rose-700 bg-rose-100",
    },
    {
      title: t("pending.title"),
      value: stats.pendingBrands,
      description: t("pending.description"),
      icon: <Clock className="h-5 w-5" />,
      iconClassName: "text-orange-700 bg-orange-100",
    },
    {
      title: t("featured.title"),
      value: stats.featuredBrands,
      description: t("featured.description"),
      icon: <Star className="h-5 w-5" />,
      iconClassName: "text-amber-700 bg-amber-100",
    },
  ];

  return <AdminStatsStrip items={items} variant={variant} />;
}
