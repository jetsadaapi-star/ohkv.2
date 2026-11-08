import { Suspense } from "react";
import { History } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ActivityLogListView } from "@/components/admin/activity-log/activity-log-list-view";
import { ActivityTiles } from "@/components/admin/activity-log/activity-tiles";
import { SettingsTabHeader } from "@/components/admin/settings/sections/settings-tab-header";
import { VendorTilesSkeleton } from "@/components/vendor/vendor-tiles-skeleton";
import { requireAdminPageAccess } from "@/lib/access/admin-page-guard";

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function AdminActivityLogPage({
  params,
  searchParams,
}: PageProps) {
  const { locale } = await params;
  const search = await searchParams;
  setRequestLocale(locale);

  await requireAdminPageAccess(locale);
  const t = await getTranslations({ locale, namespace: "admin.activityLogPage" });

  return (
    <div className="space-y-5">
      <SettingsTabHeader
        icon={<History />}
        tone="sky"
        title={t("title")}
        description={t("pageDescription")}
      />
      {/* Streamed beside the table: the counts aggregate the whole log. */}
      <Suspense fallback={<VendorTilesSkeleton count={4} />}>
        <ActivityTiles locale={locale} />
      </Suspense>
      <ActivityLogListView area="admin" searchParams={search} />
    </div>
  );
}
