import { setRequestLocale } from "next-intl/server";
import { VENDOR_PERMISSIONS } from "@/config/permissions.config";
import { requireVendorAreaAccess } from "@/lib/access/vendor-area-guard";
import { ClipsManager } from "@/components/clips/clips-manager";

interface PageProps {
  params: Promise<{ locale: string }>;
}

/** The store's own short clips, each pinning its products. */
export default async function VendorClipsPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireVendorAreaAccess({
    locale,
    required: [VENDOR_PERMISSIONS.VIEW_PRODUCTS],
  });
  return <ClipsManager mode="vendor" />;
}
