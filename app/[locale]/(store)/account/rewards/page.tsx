import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Skeleton } from "@/components/ui/skeleton";
import { ClientSuspense } from "@/components/common/client-suspense";
import { CustomerLoyalty } from "@/components/account/customer-loyalty";
import { connectDB } from "@/lib/db";
import { loyaltyEnabledIn } from "@/lib/customers/loyalty";
import { getSettingsLean } from "@/models/settings.model";

interface PageProps {
  params: Promise<{ locale: string }>;
}

/** The shopper's loyalty points — only while Settings → Loyalty points is on. */
export default async function AccountRewardsPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  await connectDB();
  if (!loyaltyEnabledIn(await getSettingsLean())) notFound();
  const t = await getTranslations("account.loyalty");

  return (
    <div className="space-y-6">
      {/* Desktop only; the mobile identity strip titles this page. */}
      <div className="hidden lg:block">
        <h1 className="text-xl font-bold sm:text-2xl">{t("title")}</h1>
        <p className="text-sm text-muted-foreground sm:text-base">{t("description")}</p>
      </div>

      <ClientSuspense
        fallback={
          <div className="space-y-4" aria-busy="true">
            <Skeleton className="h-44 w-full rounded-3xl" />
            <Skeleton className="h-56 w-full" />
          </div>
        }
      >
        <CustomerLoyalty />
      </ClientSuspense>
    </div>
  );
}
