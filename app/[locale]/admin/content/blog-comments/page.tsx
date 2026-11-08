import { Suspense } from "react";
import { CheckCircle2, Clock, MessageSquareText, ShieldAlert } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { connectDB } from "@/lib/db";
import { BlogComment } from "@/models";
import { AdminStatsStrip } from "@/components/admin/admin-stats-strip";
import { AdminBlogCommentsHeader } from "@/components/admin/admin-page-headers";
import { VendorTilesSkeleton } from "@/components/vendor/vendor-tiles-skeleton";
import { BlogCommentsDataTable } from "@/components/admin/blog/blog-comments-data-table";
import { requireAdminPageAccess } from "@/lib/access/admin-page-guard";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function AdminBlogCommentsPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdminPageAccess(locale);
  return (
    <div className="space-y-5">
      <AdminBlogCommentsHeader />
      {/* Streamed: the table fetches its own rows and need not wait. */}
      <Suspense fallback={<VendorTilesSkeleton count={4} />}>
        <CommentTiles />
      </Suspense>
      <BlogCommentsDataTable locale={locale} />
    </div>
  );
}

/** The moderation queue at a glance: what waits on you comes second, in amber. */
async function CommentTiles() {
  await connectDB();
  const [rows, t] = await Promise.all([
    BlogComment.aggregate<{ _id: string; count: number }>([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    getTranslations("admin.hc.blogCommentsDataTable"),
  ]);
  const count = (status: string) => rows.find((row) => row._id === status)?.count ?? 0;
  const total = rows.reduce((sum, row) => sum + row.count, 0);
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
        tile(t("tabAll"), total, <MessageSquareText />, "bg-blue-100"),
        tile(t("statusPending"), count("pending"), <Clock />, "bg-amber-100"),
        tile(t("statusApproved"), count("approved"), <CheckCircle2 />, "bg-green-100"),
        tile(t("statusSpam"), count("spam"), <ShieldAlert />, "bg-rose-100"),
      ]}
    />
  );
}
