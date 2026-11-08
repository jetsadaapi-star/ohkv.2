import { Suspense } from "react";
import { VendorTilesSkeleton } from "@/components/vendor/vendor-tiles-skeleton";
import { VendorPageHeader } from "@/components/vendor/vendor-page-header";
import { Undo2 } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ReturnsDataTable } from "@/components/admin/returns-data-table";
import { ReturnsStatsStrip } from "@/components/admin/returns-stats-strip";
import { STAFF_PERMISSIONS } from "@/config/permissions.config";
import { requireAdminOrStaffPageAccess } from "@/lib/access/staff-page-guard";
import { canIssueRefunds } from "@/lib/access/rbac";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function AdminReturnsPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { session, staffScope } = await requireAdminOrStaffPageAccess({
    locale,
    required: [STAFF_PERMISSIONS.VIEW_ORDERS],
  });
  const t = await getTranslations("admin.hc.returnsPage");

  return (
    <div className="space-y-5">
      <VendorPageHeader icon={<Undo2 />} tone="rose" title={t("title")} description={t("description")} />
      <Suspense fallback={<VendorTilesSkeleton count={5} />}>
        <ReturnsStatsStrip locale={locale} staffScope={staffScope} />
      </Suspense>
      {/* Money moves on an admin's authority alone — staff were offered the
          refund actions and every one of them came back refused. */}
      <ReturnsDataTable canIssueRefunds={canIssueRefunds(session.user)} />
    </div>
  );
}
