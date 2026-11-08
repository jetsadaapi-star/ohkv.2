import { setRequestLocale } from "next-intl/server";
import { requireAdminOrStaffPageAccess } from "@/lib/access/staff-page-guard";
import { STAFF_PERMISSIONS } from "@/config/permissions.config";
import { GlobalVariantsManager } from "@/components/admin/global-variants-manager";
import { connectDB } from "@/lib/db";
import { GlobalVariant } from "@/models";
import { serializeRows } from "@/lib/api/list-query";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function AdminGlobalVariantsPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  await requireAdminOrStaffPageAccess({
    locale,
    required: [STAFF_PERMISSIONS.VIEW_PRODUCTS],
  });

  // Read here, beside the access check, so the list paints with the page
  // rather than after a second round trip from the browser. Same query and
  // order as GET /api/admin/global-variants, which the screen reloads from
  // after a save.
  await connectDB();
  const variants = await GlobalVariant.find({})
    .sort({ position: 1, createdAt: 1 })
    .select("name visual position values")
    .lean();

  return <GlobalVariantsManager initialItems={serializeRows(variants)} />;
}
