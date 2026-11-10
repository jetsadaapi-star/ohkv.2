import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/lib/auth/auth";
import { localeHref } from "@/lib/i18n/locale-routing";
import { getPlatformTransferPage } from "@/lib/payments/platform-transfers";
import { platformTransferViewer } from "@/lib/payments/platform-transfer-viewer";
import { TransferPaymentView } from "@/components/payments/transfer-payment-view";
import { PLATFORM_PAYMENT_KIND } from "@/config/app.config";

/**
 * A vendor paying the marketplace by PromptPay or bank transfer — an ad, a
 * plan, commission owed — and attaching the slip for an admin to approve
 * (lib/payments/platform-transfers.ts). The same page shoppers pay on.
 */

interface PageProps {
  params: Promise<{ locale: string; id: string }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "storeText.transferPay" });
  return { title: t("pageTitle"), robots: { index: false, follow: false } };
}

const DONE: Record<string, string> = {
  [PLATFORM_PAYMENT_KIND.BOOST]: "/vendor/boosts",
  [PLATFORM_PAYMENT_KIND.SUBSCRIPTION]: "/vendor/billing",
  [PLATFORM_PAYMENT_KIND.COMMISSION]: "/vendor/payouts",
};

export default async function PlatformTransferPaymentPage({ params }: PageProps) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect(await localeHref(locale, `/login?callbackUrl=${encodeURIComponent(`/payment/platform/${id}`)}`));
  }
  const page = await getPlatformTransferPage(id, await platformTransferViewer(session.user.id)).catch(() => null);
  if (!page) notFound();
  return (
    <TransferPaymentView
      token={id}
      initial={page.view}
      platform={{ apiUrl: `/api/payments/platform/${id}`, doneHref: DONE[page.kind] ?? "/vendor/dashboard" }}
    />
  );
}
