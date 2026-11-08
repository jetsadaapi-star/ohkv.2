import { Suspense } from "react";
import { BadgeCheck, EyeOff, Newspaper, Tags } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { connectDB } from "@/lib/db";
import { BlogCategory } from "@/models";
import { AdminStatsStrip } from "@/components/admin/admin-stats-strip";
import { AdminBlogCategoriesHeader } from "@/components/admin/admin-page-headers";
import { VendorTilesSkeleton } from "@/components/vendor/vendor-tiles-skeleton";
import { BlogCategoriesDataTable } from "@/components/admin/blog/blog-categories-data-table";
import { requireAdminPageAccess } from "@/lib/access/admin-page-guard";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function AdminBlogCategoriesPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdminPageAccess(locale);
  return (
    <div className="space-y-5">
      <AdminBlogCategoriesHeader />
      {/* Streamed: the table fetches its own rows and need not wait. */}
      <Suspense fallback={<VendorTilesSkeleton count={4} />}>
        <CategoryTiles />
      </Suspense>
      <BlogCategoriesDataTable locale={locale} />
    </div>
  );
}

async function CategoryTiles() {
  await connectDB();
  const [[totals], t] = await Promise.all([
    BlogCategory.aggregate<{ total: number; active: number; posts: number }>([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: { $sum: { $cond: [{ $eq: ["$isActive", true] }, 1, 0] } },
          posts: { $sum: { $ifNull: ["$postCount", 0] } },
        },
      },
    ]),
    getTranslations("admin.hc.adminPages.blogCategories.tiles"),
  ]);
  const total = totals?.total ?? 0;
  const active = totals?.active ?? 0;
  const tile = (title: string, value: number, icon: React.ReactNode, iconClassName: string) => ({
    title,
    description: title,
    value,
    icon,
    iconClassName,
  });
  return (
    <AdminStatsStrip
      variant="tiles"
      items={[
        tile(t("total"), total, <Tags />, "bg-orange-100"),
        tile(t("active"), active, <BadgeCheck />, "bg-green-100"),
        tile(t("hidden"), total - active, <EyeOff />, "bg-slate-100"),
        tile(t("posts"), totals?.posts ?? 0, <Newspaper />, "bg-violet-100"),
      ]}
    />
  );
}
