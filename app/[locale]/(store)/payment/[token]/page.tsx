import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { connectDB } from "@/lib/db";
import { getTransferPaymentView, sweepTransferExpiry } from "@/lib/payments/transfer-orders";
import { TransferPaymentView } from "@/components/payments/transfer-payment-view";

/**
 * Pay a PromptPay / bank-transfer order and attach the slip. The token in the
 * URL is the order's payment capability (`lib/payments/transfer-orders.ts`).
 */

interface PageProps {
  params: Promise<{ locale: string; token: string }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "storeText.transferPay" });
  return { title: t("pageTitle"), robots: { index: false, follow: false } };
}

export default async function TransferPaymentPage({ params }: PageProps) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  await connectDB();
  sweepTransferExpiry();
  const view = await getTransferPaymentView(token);
  if (!view) notFound();
  return <TransferPaymentView token={token} initial={view} />;
}
