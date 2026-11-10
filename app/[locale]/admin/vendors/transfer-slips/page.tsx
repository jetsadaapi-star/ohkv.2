import { setRequestLocale } from "next-intl/server";
import { VendorTransferSlips } from "@/components/admin/vendors/vendor-transfer-slips";

interface PageProps {
  params: Promise<{ locale: string }>;
}

/** Vendors → Transfer slips: vendors' PromptPay / bank transfers waiting to be checked. */
export default async function AdminVendorTransferSlipsPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <VendorTransferSlips />;
}
