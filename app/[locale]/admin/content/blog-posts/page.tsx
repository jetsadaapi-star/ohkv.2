import { Newspaper, FileText, CheckCircle2, Clock, Eye } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { connectDB } from "@/lib/db";
import { BlogPost } from "@/models";
import {
  AdminStatsStrip,
  type AdminStatsStripItem,
} from "@/components/admin/admin-stats-strip";
import { Suspense } from "react";
import { BlogPostsDataTable } from "@/components/admin/blog/blog-posts-data-table";
import { AdminBlogPostsHeader } from "@/components/admin/admin-page-headers";
import { VendorTilesSkeleton } from "@/components/vendor/vendor-tiles-skeleton";
import { requireAdminPageAccess } from "@/lib/access/admin-page-guard";

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function AdminBlogPostsPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const search = await searchParams;
  setRequestLocale(locale);

  await requireAdminPageAccess(locale);

  const page = typeof search.page === "string" ? parseInt(search.page, 10) : 1;
  const searchQuery = typeof search.search === "string" ? search.search : undefined;
  const status = typeof search.status === "string" ? search.status : "all";

  return (
    <div className="space-y-5">
      <AdminBlogPostsHeader />
      {/* Streamed: the table fetches its own rows and need not wait. */}
      <Suspense fallback={<VendorTilesSkeleton count={5} />}>
        <BlogPostStatsTiles />
      </Suspense>
      <BlogPostsDataTable
        locale={locale}
        initialPage={page}
        initialSearch={searchQuery}
        initialStatus={status}
      />
    </div>
  );
}

async function BlogPostStatsTiles() {
  const [stats, t] = await Promise.all([getStats(), getTranslations("admin.hc.blogPostsPage")]);

  const items: AdminStatsStripItem[] = [
    {
      title: t("totalPostsTitle"),
      value: stats.total,
      description: t("totalPostsDescription"),
      icon: <Newspaper className="h-5 w-5" />,
      iconClassName: "text-blue-700 bg-blue-100",
    },
    {
      title: t("publishedTitle"),
      value: stats.published,
      description: t("publishedDescription"),
      icon: <CheckCircle2 className="h-5 w-5" />,
      iconClassName: "text-green-700 bg-green-100",
    },
    {
      title: t("draftsTitle"),
      value: stats.drafts,
      description: t("draftsDescription"),
      icon: <FileText className="h-5 w-5" />,
      iconClassName: "text-amber-700 bg-amber-100",
    },
    {
      title: t("scheduledTitle"),
      value: stats.scheduled,
      description: t("scheduledDescription"),
      icon: <Clock className="h-5 w-5" />,
      iconClassName: "text-indigo-700 bg-indigo-100",
    },
    {
      title: t("totalViewsTitle"),
      value: stats.views,
      description: t("totalViewsDescription"),
      icon: <Eye className="h-5 w-5" />,
      iconClassName: "text-violet-700 bg-violet-100",
    },
  ];

  return <AdminStatsStrip items={items} variant="tiles" />;
}

async function getStats() {
  await connectDB();
  const [result] = await BlogPost.aggregate([
    {
      $facet: {
        total: [{ $count: "count" }],
        published: [{ $match: { status: "published" } }, { $count: "count" }],
        drafts: [{ $match: { status: "draft" } }, { $count: "count" }],
        scheduled: [{ $match: { status: "scheduled" } }, { $count: "count" }],
        views: [{ $group: { _id: null, total: { $sum: "$viewCount" } } }],
      },
    },
  ]);
  return {
    total: result?.total?.[0]?.count ?? 0,
    published: result?.published?.[0]?.count ?? 0,
    drafts: result?.drafts?.[0]?.count ?? 0,
    scheduled: result?.scheduled?.[0]?.count ?? 0,
    views: result?.views?.[0]?.total ?? 0,
  };
}
