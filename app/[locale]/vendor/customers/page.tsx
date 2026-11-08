import { Suspense } from "react";
import { notFound } from "next/navigation";
import { CalendarCheck, HandCoins, Repeat, UserRound, Users } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  AdminStatsStrip,
  type AdminStatsStripItem,
} from "@/components/admin/admin-stats-strip";
import { VendorPageHeader } from "@/components/vendor/vendor-page-header";
import { VendorTilesSkeleton } from "@/components/vendor/vendor-tiles-skeleton";
import { getStoreMoneyFormatter } from "@/lib/intl/server-currency";
import { AdminListSkeleton } from "@/components/admin/admin-list-skeleton";
import { CustomersDataTable } from "@/components/admin/customers-data-table";
import { VENDOR_PERMISSIONS } from "@/config/permissions.config";
import { serializeRows } from "@/lib/api/list-query";
import { parsePageQuery } from "@/lib/api/validate";
import {
  fetchVendorCustomerList,
  fetchVendorCustomerStats,
} from "@/lib/customers/customer-list";
import { customerListQueryParams } from "@/lib/customers/customer-list-query";
import { CustomerListQuerySchema } from "@/lib/validations";
import { requireVendorAreaAccess } from "@/lib/access/vendor-area-guard";
import { requireApprovedVendorByUserId } from "@/lib/access/vendor-guard";
import { getSettings } from "@/models/settings.model";

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

/**
 * The vendor's customer list: everyone — registered or guest — who has
 * ordered this vendor's items, with stats scoped to those orders. Gated on
 * order-viewing permissions because it is derived entirely from orders the
 * vendor can already see.
 */
export default async function VendorCustomersPage({
  params,
  searchParams,
}: PageProps) {
  const { locale } = await params;
  const search = await searchParams;
  setRequestLocale(locale);

  const access = await requireVendorAreaAccess({
    locale,
    required: [
      VENDOR_PERMISSIONS.VIEW_ORDERS,
      VENDOR_PERMISSIONS.CREATE_ORDERS,
      VENDOR_PERMISSIONS.MANAGE_ORDERS,
    ],
  });

  const settings = await getSettings();
  if (!settings.multiVendorMode?.enabled) notFound();

  const vendor = await requireApprovedVendorByUserId(access.session.user.id);
  const query = parsePageQuery(
    customerListQueryParams(search),
    CustomerListQuerySchema,
  );

  const t = await getTranslations("admin.hc.vendorCustomers");

  return (
    <div className="space-y-5">
      <VendorPageHeader
        icon={<Users />}
        tone="sky"
        title={t("title")}
        description={t("description")}
      />
      <Suspense fallback={<VendorTilesSkeleton count={4} />}>
        <VendorCustomerTiles locale={locale} vendorId={String(vendor._id)} />
      </Suspense>
      <Suspense
        fallback={<AdminListSkeleton stats={0} columns={5} tabs={5} thumbnail />}
      >
        <VendorCustomersTable
          locale={locale}
          vendorId={String(vendor._id)}
          query={query}
        />
      </Suspense>
    </div>
  );
}

/** Counted over the same shoppers the list shows: those who bought from this vendor. */
async function VendorCustomerTiles({
  locale,
  vendorId,
}: {
  locale: string;
  vendorId: string;
}) {
  const [stats, formatMoney, t] = await Promise.all([
    fetchVendorCustomerStats(vendorId),
    getStoreMoneyFormatter(),
    getTranslations("admin.hc.vendorCustomers.stats"),
  ]);
  const count = (value: number) => new Intl.NumberFormat(locale).format(value);
  const items: AdminStatsStripItem[] = [
    {
      title: t("total"),
      value: count(stats.total),
      description: t("totalDesc", { guests: count(stats.guests) }),
      icon: <UserRound className="h-5 w-5" />,
      iconClassName: "text-blue-700 bg-blue-100",
    },
    {
      title: t("repeat"),
      value: count(stats.repeat),
      description: t("repeatDesc"),
      icon: <Repeat className="h-5 w-5" />,
      iconClassName: "text-green-700 bg-green-100",
    },
    {
      title: t("recent"),
      value: count(stats.recent),
      description: t("recentDesc"),
      icon: <CalendarCheck className="h-5 w-5" />,
      iconClassName: "text-violet-700 bg-violet-100",
    },
    {
      title: t("spent"),
      value: formatMoney(stats.totalSpent),
      description: t("spentDesc", {
        average: formatMoney(stats.total ? stats.totalSpent / stats.total : 0),
      }),
      icon: <HandCoins className="h-5 w-5" />,
      iconClassName: "text-amber-700 bg-amber-100",
    },
  ];
  return <AdminStatsStrip items={items} variant="tiles" />;
}

async function VendorCustomersTable({
  locale,
  vendorId,
  query,
}: {
  locale: string;
  vendorId: string;
  query: ReturnType<typeof parsePageQuery<typeof CustomerListQuerySchema>>;
}) {
  const list = await fetchVendorCustomerList(vendorId, {
    ...query,
    subscription: query.emailSubscription,
  });

  return (
    <CustomersDataTable
      locale={locale}
      area="vendor"
      readOnly
      data={serializeRows(list.items)}
      pagination={{
        page: list.page,
        limit: list.limit,
        total: list.total,
        totalPages: list.totalPages,
      }}
    />
  );
}
