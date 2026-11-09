import { setRequestLocale } from "next-intl/server";
import { FlashSalesManager } from "@/components/admin/flash-sales/flash-sales-manager";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function AdminFlashSalesPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <FlashSalesManager />;
}
