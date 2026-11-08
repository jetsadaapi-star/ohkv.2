import { setRequestLocale } from "next-intl/server";
import { VENDOR_PERMISSIONS } from "@/config/permissions.config";
import { requireVendorAreaAccess } from "@/lib/access/vendor-area-guard";
import { LiveManager } from "@/components/live/live-manager";

interface PageProps {
  params: Promise<{ locale: string }>;
}

/** The store's lives: create one, open its studio, see how past ones went. */
export default async function VendorLivePage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireVendorAreaAccess({ locale, required: [VENDOR_PERMISSIONS.VIEW_PRODUCTS] });
  return <LiveManager mode="vendor" />;
}
