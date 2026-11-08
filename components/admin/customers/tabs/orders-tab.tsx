"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import Link from "@/components/language/link";
import { useRouter } from "@/hooks/use-locale-navigation";
import { CalendarClock, ExternalLink, History, Receipt, ShoppingBag, Wallet } from "lucide-react";
import {
  DataTable,
  CurrencyCell,
  DateCell,
  StatusCell,
  type DataTableColumn,
} from "@/components/ui/data-table";
import { SectionCard } from "../section-card";
import { toast } from "@/components/ui/toast-notification";
import { apiClient } from "@/lib/api/client";
import { useCurrency } from "@/providers/currency-provider";
import { SummaryStat } from "../summary-stat";
import type { CustomerStats } from "../customer-detail-types";
import { useApplyOnChange } from "@/hooks/use-apply-on-change";

interface CustomerOrderRow {
  _id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  total: number;
  currency?: string;
  channel?: string;
  itemCount: number;
  refundedTotal: number;
  createdAt: string;
}

interface OrdersResponse {
  data: CustomerOrderRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

interface OrdersTabProps {
  customerId: string;
  basePath: string;
  stats: CustomerStats;
}

/** Status → message key (admin.hc.customerDetail) and badge look. */
const ORDER_STATUS = {
  preordered: { key: "orderPreordered", variant: "secondary" as const },
  pending: { key: "orderPending", variant: "outline" as const },
  processing: { key: "orderProcessing", variant: "secondary" as const },
  shipped: { key: "orderShipped", variant: "default" as const },
  delivered: { key: "orderDelivered", variant: "default" as const },
  cancelled: { key: "orderCancelled", variant: "destructive" as const },
};

const PAYMENT_STATUS = {
  pending: { key: "payPending", variant: "outline" as const },
  paid: { key: "payPaid", variant: "default" as const },
  partially_paid: { key: "payPartiallyPaid", variant: "secondary" as const },
  refunded: { key: "payRefunded", variant: "destructive" as const },
  expired: { key: "payExpired", variant: "destructive" as const },
  partially_refunded: { key: "payPartiallyRefunded", variant: "secondary" as const },
};

function translatedMap<T extends Record<string, { key: string; variant: "default" | "secondary" | "outline" | "destructive" }>>(
  map: T,
  t: (key: string) => string,
) {
  return Object.fromEntries(
    Object.entries(map).map(([status, meta]) => [status, { label: t(meta.key), variant: meta.variant }]),
  ) as { [K in keyof T]: { label: string; variant: T[K]["variant"] } };
}

export function OrdersTab({ customerId, basePath, stats }: OrdersTabProps) {
  const t = useTranslations("admin.hc.customerDetail");
  const locale = useLocale();
  const router = useRouter();
  const { formatPrice } = useCurrency();
  const ORDER_STATUS_MAP = translatedMap(ORDER_STATUS, t);
  const PAYMENT_STATUS_MAP = translatedMap(PAYMENT_STATUS, t);
  const [rows, setRows] = useState<CustomerOrderRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<{
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  } | null>(null);

  useApplyOnChange([customerId, page], () => {
    setIsLoading(true);
  });

  useEffect(() => {
    let active = true;

    apiClient
      .get<OrdersResponse>(
        `/api/admin/customers/${customerId}/orders?page=${page}&limit=10`,
      )
      .then((res) => {
        if (!active) return;
        setRows(res.data || []);
        setPagination({
          page: res.pagination.page,
          pageSize: res.pagination.limit,
          total: res.pagination.total,
          totalPages: res.pagination.totalPages,
        });
      })
      .catch((error) => {
        if (!active) return;
        console.error("Failed to load customer orders:", error);
        toast.error(t("ordersLoadFailed"));
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
    // `t` is stable for the page's language.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, page]);

  const columns: DataTableColumn<CustomerOrderRow>[] = [
    {
      id: "orderNumber",
      header: t("colOrder"),
      cell: (row) => (
        <Link
          href={`${basePath}/orders/${row._id}`}
          className="inline-flex items-center gap-1.5 font-medium hover:underline"
        >
          #{row.orderNumber}
          <ExternalLink className="h-3 w-3 text-muted-foreground" />
        </Link>
      ),
      className: "w-[180px]",
    },
    {
      id: "date",
      header: t("colDate"),
      cell: (row) => <DateCell date={row.createdAt} format="medium" />,
      className: "w-[140px]",
    },
    {
      id: "status",
      header: t("colStatus"),
      cell: (row) => (
        <StatusCell status={row.status} statusMap={ORDER_STATUS_MAP} />
      ),
      className: "w-[130px]",
    },
    {
      id: "payment",
      header: t("colPayment"),
      cell: (row) => (
        <StatusCell
          status={row.paymentStatus}
          statusMap={PAYMENT_STATUS_MAP}
        />
      ),
      className: "w-[150px]",
    },
    {
      id: "items",
      header: t("colItems"),
      cell: (row) => <span className="tabular-nums">{row.itemCount}</span>,
      className: "w-[90px]",
    },
    {
      id: "total",
      header: t("colTotal"),
      cell: (row) => (
        <CurrencyCell value={row.total} />
      ),
      className: "w-[130px]",
    },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryStat icon={ShoppingBag} tone="sky" label={t("totalOrders")} value={(stats.totalOrders ?? 0).toLocaleString(locale)} />
        <SummaryStat icon={Wallet} tone="emerald" label={t("kpiTotalSpent")} value={formatPrice(stats.totalSpent ?? 0)} />
        <SummaryStat icon={Receipt} tone="violet" label={t("avgOrderValue")} value={formatPrice(stats.averageOrderValue ?? 0)} />
        <SummaryStat
          icon={CalendarClock}
          tone="amber"
          label={t("kpiLastOrder")}
          value={
            stats.lastOrderDate
              ? new Date(stats.lastOrderDate).toLocaleDateString(locale, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })
              : "—"
          }
        />
      </div>

      <SectionCard icon={History} tone="sky" title={t("orderHistory")} description={t("orderHistoryDescription")}>
        <DataTable
          data={rows}
          columns={columns}
          keyField="_id"
          isLoading={isLoading}
          loadingMode="rows"
          pagination={pagination ?? undefined}
          onPageChange={setPage}
          onRowClick={(row) => {
            router.push(`${basePath}/orders/${row._id}`);
          }}
          emptyMessage={t("noOrders")}
        />
      </SectionCard>
    </div>
  );
}
