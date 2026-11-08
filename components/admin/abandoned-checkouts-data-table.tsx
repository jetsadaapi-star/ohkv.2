"use client";

import { STATUS_TONE_CLASS, statusBadgeClass } from "@/lib/ui/status-palette";
import { cn } from "@/lib/utils";
import { abandonedCheckoutHue, statusRowClass } from "@/components/vendor/status-tone";
import { useCallback, useMemo, useState } from "react";
import Link from "@/components/language/link";
import { useTranslations } from "next-intl";
import { useRouter } from "@/hooks/use-locale-navigation";
import {
  Circle,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Gift,
  Mail,
  RefreshCcw,
  RotateCcw,
  ShoppingCart,
} from "lucide-react";
import {
  DataTable,
  DateCell,
  TextCell,
  type DataTableAction,
  type DataTableColumn,
  type DataTableFilter,
  type DataTableTab,
} from "@/components/ui/data-table";
import { toast } from "@/components/ui/toast-notification";
import { useCurrency } from "@/providers/currency-provider";
import { buildAdminCommerceTableHeader } from "@/components/admin/admin-commerce-table-header";
import { periodPickerConfig } from "@/components/admin/period-picker-config";
import { useCsvImportExport } from "@/hooks/use-csv-import-export";
import { useFallbackTranslator } from "@/hooks/use-fallback-translator";
import { useListNavigation } from "@/hooks/use-list-navigation";
import { apiClient } from "@/lib/api/client";
import {
  CheckoutPaymentTimelineDialog,
  type CheckoutPaymentEvent,
} from "@/components/admin/checkout-payment-timeline-dialog";
import {
  AutomaticOfferDialog,
  SendOfferDialog,
  type AbandonedOfferLimits,
} from "@/components/admin/abandoned-offer-dialogs";

interface AbandonedCheckoutItem {
  name: string;
  quantity: number;
  price: number;
  productId?: string | { _id?: string } | null;
}

interface AbandonedCheckout {
  _id: string;
  email?: string;
  phone?: string;
  customerName?: string;
  checkoutUrl?: string;
  gateway?: string;
  sourceName?: string;
  recoveryEmailStatus?: string;
  recoveryStatus?: string;
  abandonedAt?: string;
  checkoutStartedAt?: string;
  updatedAt: string;
  totalPrice?: number;
  subtotalPrice?: number;
  itemCount?: number;
  items: AbandonedCheckoutItem[];
  /**
   * What the gateway said, try by try. Written by `recordCheckoutPaymentEvent`
   * — a refused payment produces no order, so this is the only place a
   * merchant can see why a shopper who tried to pay did not.
   */
  paymentEvents?: CheckoutPaymentEvent[];
  /** The recovery ladder: one entry per scheduled email. */
  recoveryEmails?: Array<{
    step: number;
    dueAt?: string;
    sentAt?: string;
    status?: string;
  }>;
  /** Set once the shopper has asked to be left alone. */
  unsubscribedAt?: string;
  /**
   * A vendor's row only: whether the shopper was signed in — all a vendor
   * learns about them (`toVendorAbandonedCheckout`).
   */
  customerType?: "registered" | "guest";
  /** A vendor's row only: the order it became, when it holds the vendor's goods. */
  order?: { _id: string; orderNumber?: string };
  /** A vendor's row only: its own latest offer on the checkout. */
  offer?: { kind: string; type: string; value: number; validUntil?: string; status: string };
  /** A vendor's row only: whether an offer could go out now. */
  offerAvailable?: boolean;
  /** The store's rows: every vendor offer on the checkout, by seller. */
  offerSummaries?: Array<{
    vendorName: string;
    kind?: string;
    type?: string;
    value?: number;
    code?: string;
    status: string;
  }>;
}

/** An offer's state, as a list says it. */
const OFFER_STATUS_LABELS: Record<string, string> = {
  pending: "offerSending",
  sent: "offerSent",
  queued: "offerSending",
  failed: "offerNotSent",
  suppressed: "offerNotSent",
  used: "offerUsed",
  expired: "offerExpired",
};

/**
 * Whose list this is:
 * - `admin`: the store's, with every action;
 * - `staff`: the staff area's, the recovery actions only with `canManage`;
 * - `vendor`: a vendor's own lines, read-only, with no shopper named — the
 *   rows arrive that way from the server, so this only lays them out.
 */
export type AbandonedCheckoutsArea = "admin" | "staff" | "vendor";

interface AbandonedCheckoutsDataTableProps {
  locale: string;
  /** Rows for the current query string, fetched by the page. */
  data: AbandonedCheckout[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  area?: AbandonedCheckoutsArea;
  /** Staff: may send a recovery email and copy the recovery link. */
  canManage?: boolean;
  /**
   * The vendor's offers, when the store allows them and the vendor may make
   * discounts: a Send offer action on each row, and the standing offer.
   */
  offers?: { canSend: boolean; automatic: boolean; limits: AbandonedOfferLimits };
}

const ABANDONED_FILTER_IDS = ["emailStatus", "date"];

/** First two words of a product title — how the Orders list shortens it. */
function getTwoWordProductName(name?: string) {
  const value = name?.trim();
  if (!value) return "—";

  const words = value.split(/\s+/);
  return words.length > 2 ? `${words.slice(0, 2).join(" ")}...` : value;
}

function getFirstItemProductId(items: AbandonedCheckoutItem[]) {
  const firstProductId = items[0]?.productId;
  if (!firstProductId) return null;
  if (typeof firstProductId === "string") return firstProductId;
  if (typeof firstProductId === "object" && typeof firstProductId._id === "string") {
    return firstProductId._id;
  }
  return null;
}

/** Badge copy in the Orders list's sentence case ("Not sent", not "Not Sent"). */
const EMAIL_STATUS_LABELS: Record<string, string> = {
  not_sent: "emailNotSent",
  sent: "emailSent",
  failed: "emailFailed",
  not_applicable: "emailNone",
};

const RECOVERY_STATUS_LABELS: Record<string, string> = {
  not_recovered: "notRecovered",
  recovered: "recovered",
};

function getStatusBadgeClasses(status?: string) {
  return `${statusBadgeClass(status === "recovered" ? "recovered" : "not_recovered")} ring-1 ring-inset`;
}

function getEmailBadgeClasses(status?: string) {
  // Sent is on its way (blue), failed red, the rest grey — the shared palette.
  const tone = status === "sent" ? "info" : status === "failed" ? "danger" : "neutral";
  return `${STATUS_TONE_CLASS[tone]} ring-1 ring-inset`;
}

function formatStatus(
  value: string,
  labels: Record<string, string>,
  tr: ReturnType<typeof useTranslations>,
) {
  return labels[value] ? tr(labels[value]) : value.replace(/_/g, " ");
}

function RecoveryBadge({ status }: { status?: string }) {
  const th = useTranslations("admin.hc.abandonedCheckoutsDataTable");
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${getStatusBadgeClasses(status)}`}
    >
      <Circle className="h-2.5 w-2.5 fill-current stroke-0" />
      {formatStatus(status || "not_recovered", RECOVERY_STATUS_LABELS, th)}
    </span>
  );
}

export function AbandonedCheckoutsDataTable({
  locale,
  data,
  pagination,
  area = "admin",
  canManage = false,
  offers,
}: AbandonedCheckoutsDataTableProps) {
  const t = useTranslations();
  const th = useTranslations("admin.hc.abandonedCheckoutsDataTable");
  const tOr = useFallbackTranslator(t);
  const router = useRouter();
  const { formatPrice } = useCurrency();
  const basePath = `/${locale}/${area}`;
  const isStore = area === "admin";
  const isVendor = area === "vendor";
  // The admin and vendor pages carry their own heading and tiles; the staff
  // area keeps the table's own title.
  const modernLook = area !== "staff";
  /** Send the recovery email, copy or open the recovery link. */
  const canRecover = isStore || (area === "staff" && canManage);
  const [isDetecting, setIsDetecting] = useState(false);
  /** The checkout whose payment timeline is open, if any. */
  const [timelineRow, setTimelineRow] = useState<AbandonedCheckout | null>(null);
  /** The checkout a vendor is making an offer on; `nonce` mounts it fresh. */
  const [offerTarget, setOfferTarget] = useState<{
    row: AbandonedCheckout;
    nonce: number;
  } | null>(null);
  const [automaticOpen, setAutomaticOpen] = useState(false);
  const canSendOffers = isVendor && Boolean(offers?.canSend);
  // Stable, so a dialog's own effects do not re-run (and refetch over what the
  // vendor typed) each time this table renders.
  const closeOffer = useCallback((open: boolean) => {
    if (!open) setOfferTarget(null);
  }, []);
  const closeAutomatic = useCallback((open: boolean) => {
    if (!open) setAutomaticOpen(false);
  }, []);

  const list = useListNavigation<AbandonedCheckout>({
    items: data,
    pagination,
    tabParam: "view",
    filterIds: ABANDONED_FILTER_IDS,
    defaultSortBy: "abandonedAt",
  });

  // The table's current view as a file — every matching checkout, not the page
  // on screen: the server reads the same query string the page does.
  const csv = useCsvImportExport({
    endpoint: "/api/admin/abandoned-checkouts/export",
    noun: "abandoned checkouts",
    onImported: list.refetch,
  });

  const handleDetect = useCallback(async () => {
    setIsDetecting(true);
    try {
      const data = await apiClient.post<{ modified?: number }>(
        "/api/admin/abandoned-checkouts/detect",
        { minutes: 10, locale },
      );
      toast.success(th("detectedCount", { count: data?.modified || 0 }));
      router.refresh();
      list.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : th("detectFailed"));
    } finally {
      setIsDetecting(false);
    }
  }, [list, locale, router, th]);

  const handleSendEmail = useCallback(
    async (row: AbandonedCheckout) => {
      try {
        const data = await apiClient.post<{
          sent?: boolean;
          outcome?: "sent" | "queued" | "suppressed" | "failed";
          suppression?: string;
        }>("/api/admin/abandoned-checkouts/send", {
          checkoutId: row._id,
          locale,
        });
        // A mail waiting on an outbox retry has not failed — it usually goes
        // within minutes — so it is said as it is, not as an error.
        if (data?.outcome === "queued") {
          toast.info(th("emailQueued"));
        } else if (data?.outcome === "suppressed") {
          // Nor is one the shopper refused: nothing here for the merchant to
          // fix, and the outbox would have refused it anyway.
          toast.warning(
            data.suppression === "pending"
              ? th("suppressedPending")
              : th("suppressedUnsubscribed"),
          );
        } else if (data?.sent) {
          toast.success(th("emailSentToast"));
        } else {
          toast.error(th("emailNotSentToast"));
        }
        list.refetch();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : th("emailSendFailed"),
        );
      }
    },
    [list, locale, th],
  );

  /** "10% off" or "$5.00 off". */
  const offerText = useCallback(
    (offer: { type?: string; value?: number }) =>
      offer.type === "fixed"
        ? th("amountOff", { amount: formatPrice(Number(offer.value) || 0) })
        : th("percentOff", { percent: Number(offer.value) || 0 }),
    [formatPrice, th],
  );

  const handleCopyLink = useCallback((row: AbandonedCheckout) => {
    if (!row.checkoutUrl) {
      toast.error(th("noRecoveryLink"));
      return;
    }
    void navigator.clipboard.writeText(row.checkoutUrl);
    toast.success(th("recoveryLinkCopied"));
  }, [th]);

  const columns = useMemo<DataTableColumn<AbandonedCheckout>[]>(() => {
    const all: DataTableColumn<AbandonedCheckout>[] = [
      {
        id: "customer",
        header: th("colCustomer"),
        // A vendor is told only whether the shopper was signed in: the row
        // carries no name or contact to show.
        cell: (row) =>
          isVendor ? (
            <TextCell
              value={
                row.customerType === "registered"
                  ? th("registeredCustomer")
                  : t("common.guest")
              }
              truncate
              maxWidth="220px"
            />
          ) : (
            <div className="min-w-0">
              <TextCell
                value={row.customerName || t("common.guest")}
                truncate
                maxWidth="220px"
              />
              <div className="text-xs text-muted-foreground">
                <TextCell value={row.email || row.phone} truncate maxWidth="220px" />
              </div>
            </div>
          ),
        className: "w-[260px]",
      },
      {
        id: "items",
        header: th("colProducts"),
        cell: (row) => {
          const items = row.items || [];
          const fullName = items[0]?.name;
          const label = getTwoWordProductName(fullName);
          const text =
            items.length > 1
              ? `${label} ${t("admin.ordersPage.plusMore", {
                  count: items.length - 1,
                })}`
              : label;
          // The store and a vendor open the product's editor; staff may not
          // hold product permissions, so their row names it without a link.
          const productId = area === "staff" ? null : getFirstItemProductId(items);
          const textClassName =
            "block max-w-[220px] truncate font-medium text-slate-700 dark:text-slate-300";

          if (!productId) {
            return (
              <span className={textClassName} title={fullName}>
                {text}
              </span>
            );
          }

          return (
            <Link
              href={`${basePath}/products/${productId}/edit`}
              className={`${textClassName} hover:text-blue-600 hover:underline dark:hover:text-blue-400`}
              title={fullName}
            >
              {text}
            </Link>
          );
        },
        className: "w-[220px] hidden xl:table-cell",
        headerClassName: "hidden xl:table-cell",
      },
      {
        id: "abandonedAt",
        header: th("colAbandoned"),
        // The date the way the Orders list prints it, with the relative age
        // under it — an order number carries that line there, and this list
        // has none.
        cell: (row) => {
          const date = row.abandonedAt || row.checkoutStartedAt || row.updatedAt;
          return (
            <div className="min-w-0">
              <DateCell date={date} format="medium" />
              <div className="text-xs text-muted-foreground">
                <DateCell date={date} format="relative" />
              </div>
            </div>
          );
        },
        className: "w-[140px]",
        sortable: true,
      },
      {
        id: "totalPrice",
        // A vendor's figure is its own lines, never the whole basket.
        header: isVendor ? th("colYourTotal") : th("colTotal"),
        cell: (row) => (
          <TextCell
            value={formatPrice(row.totalPrice || row.subtotalPrice || 0)}
            className="block w-full text-right"
          />
        ),
        className: "w-[140px]",
        headerClassName: "text-right [&>div]:justify-center",
        sortable: true,
      },
      {
        id: "recoveryEmailStatus",
        header: th("colEmail"),
        // The badge alone could not tell "one reminder sent, two to come"
        // from "that is all they will get", which is the question asked of
        // this column once there is a ladder rather than a single email.
        cell: (row) => {
          const ladder = row.recoveryEmails || [];
          const sent = ladder.filter((rung) => rung.status === "sent").length;
          const status = row.recoveryEmailStatus || "not_sent";
          return (
            <div className="space-y-1">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${getEmailBadgeClasses(status)}`}
              >
                <Circle className="h-2.5 w-2.5 fill-current stroke-0" />
                {formatStatus(status, EMAIL_STATUS_LABELS, th)}
              </span>
              {row.unsubscribedAt ? (
                <div className="text-[11px] text-muted-foreground">
                  {th("unsubscribed")}
                </div>
              ) : ladder.length > 1 ? (
                <div className="text-[11px] text-muted-foreground">
                  {th("sentOf", { sent, total: ladder.length })}
                </div>
              ) : null}
            </div>
          );
        },
        className: "w-[150px] hidden md:table-cell",
        headerClassName: "hidden md:table-cell",
        sortable: true,
      },
      {
        id: "recoveryStatus",
        header: th("colRecovery"),
        // The store's rows also say which seller made an offer, and how it
        // stands — the latest one, since a checkout holds one at a time.
        cell: (row) => {
          const latest = row.offerSummaries?.[row.offerSummaries.length - 1];
          return (
            <div className="space-y-1">
              <RecoveryBadge status={row.recoveryStatus} />
              {latest ? (
                <div
                  className="max-w-[200px] truncate text-[11px] text-muted-foreground"
                  title={latest.code ? th("codeTitle", { code: latest.code }) : undefined}
                >
                  {th("offerPrefix")} {offerText(latest)} · {latest.vendorName} ·{" "}
                  {OFFER_STATUS_LABELS[latest.status]
                    ? th(OFFER_STATUS_LABELS[latest.status])
                    : latest.status}
                </div>
              ) : null}
            </div>
          );
        },
        className: "w-[150px] hidden md:table-cell",
        headerClassName: "hidden md:table-cell",
        sortable: true,
      },
      // A vendor's own offer on the checkout, when the store allows offers.
      ...(isVendor && offers
        ? [
            {
              id: "offer",
              header: th("colOffer"),
              cell: (row: AbandonedCheckout) =>
                row.offer ? (
                  <div className="min-w-0">
                    <TextCell value={offerText(row.offer)} />
                    <div className="text-xs text-muted-foreground">
                      {OFFER_STATUS_LABELS[row.offer.status]
                        ? th(OFFER_STATUS_LABELS[row.offer.status])
                        : row.offer.status}
                      {row.offer.kind === "automatic" ? ` · ${th("automatic")}` : ""}
                    </div>
                  </div>
                ) : (
                  <span className="text-muted-foreground">—</span>
                ),
              className: "w-[130px]",
            } satisfies DataTableColumn<AbandonedCheckout>,
          ]
        : []),
    ];
    // The recovery emails are the store's, so a vendor's list has no column
    // for them.
    return isVendor
      ? all.filter((column) => column.id !== "recoveryEmailStatus")
      : all;
  }, [area, basePath, formatPrice, isVendor, offerText, offers, t, th]);

  const tabs = useMemo<DataTableTab[]>(
    () => [
      { id: "all", label: th("all") },
      { id: "open", label: th("open") },
      { id: "recovered", label: th("recovered") },
    ],
    [th],
  );

  const selectFilters = useMemo<DataTableFilter[]>(
    () => [
      {
        id: "emailStatus",
        label: th("emailStatus"),
        type: "select",
        options: [
          { label: th("all"), value: "all" },
          { label: th("emailNotSent"), value: "not_sent" },
          { label: th("emailSent"), value: "sent" },
          { label: th("emailFailed"), value: "failed" },
          { label: th("emailNone"), value: "not_applicable" },
        ],
      },
    ],
    [th],
  );

  // The Orders list's date filter, with the dashboard's period names and
  // footer. Built on every render rather than memoised: "today" and the last
  // day the calendar lets you pick move at midnight, and this tab can outlive it.
  const now = new Date();
  const dateFilter: DataTableFilter = {
    id: "date",
    label: tOr("admin.ordersPage.filters.date", "Date"),
    type: "date",
    date: { locale, ...periodPickerConfig(tOr, locale, now), maxDate: now },
  };
  // A vendor's rows carry no recovery-email state, so there is nothing for
  // the email filter to narrow.
  const filters = isVendor ? [dateFilter] : [...selectFilters, dateFilter];

  // Export and detection are the store's alone: the file holds every
  // shopper's contact details, and detection sweeps every checkout.
  const tableHeader = buildAdminCommerceTableHeader({
    title: th("title"),
    ...(isStore
      ? {
          // Export only: a checkout is written by the storefront, never imported.
          importExportAction: {
            id: "toolbar-export",
            label: tOr("admin.ordersPage.export", "Export"),
            icon: <Download className="h-4 w-4" />,
            variant: "outline" as const,
            onClick: csv.exportCsv,
            disabled: csv.isExporting,
          },
          secondaryActions: [
            {
              id: "detect",
              label: isDetecting ? th("detecting") : th("detectNow"),
              icon: (
                <RefreshCcw className={`h-4 w-4 ${isDetecting ? "animate-spin" : ""}`} />
              ),
              onClick: handleDetect,
              disabled: isDetecting,
            },
          ],
        }
      : {}),
    // A vendor's standing offer, which the store's recovery email carries.
    ...(canSendOffers && offers?.automatic
      ? {
          secondaryActions: [
            {
              id: "automatic-offer",
              label: th("automaticOffer"),
              icon: <Gift className="h-4 w-4" />,
              onClick: () => setAutomaticOpen(true),
            },
          ],
        }
      : {}),
  });

  const rowActions = (row: AbandonedCheckout): DataTableAction[] => {
    // A vendor reads, and — where the store allows it — sends its own offer.
    // The one other thing to open is its own order, when the shopper came
    // back and bought.
    if (isVendor) {
      return [
        ...(canSendOffers
          ? [
              {
                id: "send-offer",
                label: th("sendOffer"),
                icon: <Gift className="h-4 w-4" />,
                onClick: () =>
                  setOfferTarget({ row, nonce: Date.now() }),
                disabled: !row.offerAvailable,
                hint: row.offerAvailable
                  ? undefined
                  : th("offerUnavailable"),
              },
            ]
          : []),
        ...(row.order
          ? [
              {
                id: "open-order",
                label: row.order.orderNumber
                  ? th("viewOrderNumber", { number: row.order.orderNumber })
                  : th("viewOrder"),
                icon: <ExternalLink className="h-4 w-4" />,
                href: `${basePath}/orders/${row.order._id}`,
              },
            ]
          : []),
      ];
    }

    return [
      ...(row.paymentEvents?.length
        ? [
            {
              id: "payment-timeline",
              label: th("paymentTimeline"),
              icon: <Clock className="h-4 w-4" />,
              onClick: () => setTimelineRow(row),
            },
          ]
        : []),
      ...(canRecover
        ? [
            {
              id: "send-email",
              label: th("sendRecoveryEmail"),
              icon: <Mail className="h-4 w-4" />,
              onClick: () => void handleSendEmail(row),
              disabled: !row.email || row.recoveryStatus === "recovered",
            },
            {
              id: "copy-link",
              label: th("copyRecoveryLink"),
              icon: <Copy className="h-4 w-4" />,
              onClick: () => handleCopyLink(row),
              disabled: !row.checkoutUrl,
            },
            ...(row.checkoutUrl
              ? [
                  {
                    id: "open-recovery",
                    label: th("openCheckout"),
                    icon: <RotateCcw className="h-4 w-4" />,
                    href: row.checkoutUrl,
                  },
                ]
              : []),
          ]
        : []),
    ];
  };
  // No column at all when no row on the page has anything to offer — a vendor's
  // page without a recovered order, or staff who may only look. The store's
  // list always has its recovery actions.
  const showRowActions =
    isStore || list.items.some((row) => rowActions(row).length > 0);

  return (
    <>
    <DataTable
      data={list.items}
      columns={columns}
      keyField="_id"
      // The vendor page carries its own heading above the tiles.
      title={modernLook ? undefined : tableHeader.title}
      titleIcon={modernLook ? undefined : <ShoppingCart className="h-5 w-5" />}
      actions={tableHeader.actions.length ? tableHeader.actions : undefined}
      tabs={tabs}
      activeTab={list.activeTab}
      onTabChange={list.handleTabChange}
      searchable
      searchPlaceholder={
        isVendor
          ? th("searchVendor")
          : th("searchStore")
      }
      toolbarActions={tableHeader.toolbarActions}
      searchValue={list.search}
      onSearchChange={list.handleSearchChange}
      filters={filters}
      filterValues={list.filters}
      onFilterChange={list.handleFilterChange}
      pagination={list.pagination}
      onPageChange={list.handlePageChange}
      onPageSizeChange={list.handlePageSizeChange}
      sortColumn={list.sortBy}
      sortDirection={list.sortOrder}
      onSortChange={list.handleSortChange}
      isLoading={list.isLoading}
      loadingMode="rows"
      rowActions={showRowActions ? rowActions : undefined}
      rowActionsHeader={t("common.actions")}
      rowActionsVariant="dropdown"
      emptyMessage={
        isVendor
          ? th("emptyVendor")
          : th("emptyStore")
      }
      emptyIcon={<ShoppingCart className="h-8 w-8" />}
      appearance={tableHeader.appearance}
      toolbarLayout={tableHeader.toolbarLayout}
      tabsVariant={tableHeader.tabsVariant}
      filtersVariant={tableHeader.filtersVariant}
      stackedTopControls={tableHeader.stackedTopControls}
      showToolbarSortButton={tableHeader.showToolbarSortButton}
      className={cn("overflow-hidden [&_thead_th]:text-xs [&_tbody_td]:text-xs", modernLook && "rounded-2xl p-0 shadow-sm max-sm:border-0 max-sm:bg-transparent max-sm:shadow-none sm:p-4")}
      rowClassName={modernLook ? (row) => statusRowClass(abandonedCheckoutHue(row)) : undefined}
    />

    {offerTarget && offers ? (
      <SendOfferDialog
        key={offerTarget.nonce}
        open
        onOpenChange={closeOffer}
        checkoutId={offerTarget.row._id}
        productNames={(offerTarget.row.items || []).map((item) => item.name)}
        subtotal={Number(offerTarget.row.subtotalPrice ?? offerTarget.row.totalPrice ?? 0)}
        limits={offers.limits}
        onSent={() => list.refetch()}
      />
    ) : null}

    {automaticOpen ? (
      <AutomaticOfferDialog open onOpenChange={closeAutomatic} />
    ) : null}

    {isVendor ? null : (
      <CheckoutPaymentTimelineDialog
        open={Boolean(timelineRow)}
        onOpenChange={(open) => !open && setTimelineRow(null)}
        locale={locale}
        customerName={timelineRow?.customerName || t("common.guest")}
        contact={timelineRow?.email || timelineRow?.phone}
        statusBadge={<RecoveryBadge status={timelineRow?.recoveryStatus} />}
        events={timelineRow?.paymentEvents || []}
      />
    )}
    </>
  );
}
