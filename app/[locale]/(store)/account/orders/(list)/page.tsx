import Link from "@/components/language/link";
import { CalendarClock, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClientSuspense } from "@/components/common/client-suspense";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { CustomerOrdersList, OrdersListFallback } from "@/components/account/orders-list";
import { AccountPageHeader } from "@/components/account/account-ui";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function OrdersPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale });

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <AccountPageHeader
        icon={<Package />}
        title={t("orders.title")}
        description={t("orders.subtitle")}
        actions={
          <Button variant="outline" className="min-h-11 rounded-xl sm:min-h-10" asChild>
            <Link href="/account/orders/pre-orders">
              <CalendarClock className="size-4 text-primary" />
              {t("orders.preOrders")}
            </Link>
          </Button>
        }
      />

      <ClientSuspense fallback={<OrdersListFallback />}>
        <CustomerOrdersList filter="regular" statusTabs />
      </ClientSuspense>
    </div>
  );
}
