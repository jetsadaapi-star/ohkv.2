import { Suspense } from "react";
import { Undo2 } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { VendorPageHeader } from "@/components/vendor/vendor-page-header";
import { VENDOR_PERMISSIONS } from "@/config/permissions.config";
import { requireVendorAreaAccess } from "@/lib/access/vendor-area-guard";
import { ReturnsDataTable } from "@/components/admin/returns-data-table";
import { ReturnsStatsStrip } from "@/components/admin/returns-stats-strip";
import { VendorTilesSkeleton } from "@/components/vendor/vendor-tiles-skeleton";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function VendorReturnsPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const access = await requireVendorAreaAccess({
    locale,
    required: [VENDOR_PERMISSIONS.VIEW_ORDERS],
  });
  const t = await getTranslations("admin.hc.vendorReturnsPage");

  return (
    <div className="space-y-5">
      <VendorPageHeader icon={<Undo2 />} tone="rose" title={t("title")} description={t("description")} />
      <Suspense fallback={<VendorTilesSkeleton count={5} />}>
        <ReturnsStatsStrip
          locale={locale}
          vendorId={String(access.vendor._id)}
        />
      </Suspense>
      <ReturnsDataTable scope="vendor" />
    </div>
  );
}
