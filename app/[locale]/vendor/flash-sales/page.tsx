import { setRequestLocale } from "next-intl/server";
import { FlashSalesManager } from "@/components/admin/flash-sales/flash-sales-manager";
import { VENDOR_PERMISSIONS } from "@/config/permissions.config";
import { requireVendorAreaAccess } from "@/lib/access/vendor-area-guard";

interface PageProps {
  params: Promise<{ locale: string }>;
}

/**
 * Vendor → Flash Sale: the store's own sales of its own products, inside the
 * limits Admin → Flash Sale sets. Opened by the Discounts permission, like
 * the store's coupons.
 */
export default async function VendorFlashSalesPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireVendorAreaAccess({ locale, required: [VENDOR_PERMISSIONS.VIEW_DISCOUNTS] });
  return <FlashSalesManager mode="vendor" />;
}
