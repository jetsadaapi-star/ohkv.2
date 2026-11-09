import { getTranslations, setRequestLocale } from "next-intl/server";
import { Skeleton } from "@/components/ui/skeleton";
import { ClientSuspense } from "@/components/common/client-suspense";
import { CustomerStoreCredit } from "@/components/account/customer-store-credit";
import { AccountPageHeader } from "@/components/account/account-ui";
import { Wallet } from "lucide-react";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function AccountStoreCreditPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("account");
  const title = t("storeCredit");
  const description = t("storeCreditDesc");

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5">
      <AccountPageHeader icon={<Wallet />} title={title} description={description} />

      <ClientSuspense
        fallback={
          <div className="space-y-4" aria-busy="true">
            <Skeleton className="h-44 w-full rounded-3xl sm:w-1/2" />
            <Skeleton className="h-40 w-full" />
          </div>
        }
      >
        <CustomerStoreCredit />
      </ClientSuspense>
    </div>
  );
}
