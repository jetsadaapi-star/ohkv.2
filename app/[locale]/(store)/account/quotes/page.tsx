import { getTranslations, setRequestLocale } from "next-intl/server";
import { Skeleton } from "@/components/ui/skeleton";
import { ClientSuspense } from "@/components/common/client-suspense";
import { CustomerQuotes } from "@/components/account/customer-quotes";
import { AccountPageHeader } from "@/components/account/account-ui";
import { FileText } from "lucide-react";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function AccountQuotesPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("account");

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5">
      <AccountPageHeader icon={<FileText />} title={t("quotes")} description={t("quotesDesc")} />

      <ClientSuspense
        fallback={
          <div className="space-y-3" aria-busy="true">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-2xl" />
            ))}
          </div>
        }
      >
        <CustomerQuotes />
      </ClientSuspense>
    </div>
  );
}
