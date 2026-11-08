"use client";

import { pageLocale } from "@/lib/intl/date-locale";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DataTable,
  CurrencyCell,
  DateCell,
  StatusCell,
  type DataTableColumn,
} from "@/components/ui/data-table";
import { toast } from "@/components/ui/toast-notification";
import { useConfirmation } from "@/components/ui/confirmation-dialog";
import { apiClient } from "@/lib/api/client";
import { useCurrency } from "@/providers/currency-provider";
import type { VendorSubscriptionSummary } from "../vendor-detail-types";

interface PlanOption {
  _id: string;
  name: string;
  price: number;
  billingInterval: string;
  commissionRate: number;
  status: string;
}

interface SubscriptionTabProps {
  vendorId?: string;
  readOnly?: boolean;
  plansEnabled?: boolean;
  subscription?: VendorSubscriptionSummary | null;
  onSubscriptionChange?: () => void;
}

function formatInterval(
  interval: string | undefined,
  labels: { monthly: string; yearly: string },
) {
  if (!interval || interval === "none") return "";
  if (interval === "monthly") return labels.monthly;
  if (interval === "yearly") return labels.yearly;
  return `/${interval}`;
}

/**
 * Billing states that cost the store money or access if nobody acts.
 *
 * These used to render as muted text in the detail grid alongside a dozen
 * other fields, which is where an unpaid vendor goes unnoticed. Anything that
 * needs a human is promoted to an alert instead.
 */
function billingDistress(subscription?: VendorSubscriptionSummary | null): {
  titleKey: string;
  detail?: string;
  detailKey?: string;
  detailValues?: Record<string, string>;
} | null {
  if (!subscription) return null;

  const status = String(subscription.status || "").toLowerCase();
  const providerStatus = String(
    subscription.providerStatus || "",
  ).toLowerCase();
  const lastPaymentStatus = String(
    subscription.lastPayment?.status || "",
  ).toLowerCase();

  if (subscription.lastReconcileError) {
    return {
      titleKey: "distressReconcileTitle",
      detail: subscription.lastReconcileError,
    };
  }
  if (status === "past_due" || providerStatus === "past_due") {
    return {
      titleKey: "distressPastDueTitle",
      detailKey: subscription.gracePeriodEnd
        ? "distressPastDueGrace"
        : "distressPastDueUncollected",
      detailValues: subscription.gracePeriodEnd
        ? { date: new Date(subscription.gracePeriodEnd).toLocaleString() }
        : undefined,
    };
  }
  if (status === "expired" || providerStatus === "canceled") {
    return {
      titleKey: "distressInactiveTitle",
      detailKey: "distressInactiveDetail",
    };
  }
  if (lastPaymentStatus === "failed") {
    return {
      titleKey: "distressInvoiceFailedTitle",
      detailKey: "distressInvoiceFailedDetail",
    };
  }
  return null;
}

interface InvoiceRow {
  _id: string;
  providerInvoiceId: string;
  status: string;
  amountDue: number;
  amountPaid: number;
  amountRefunded: number;
  currency: string;
  periodStart: string | null;
  periodEnd: string | null;
  attemptCount: number;
  failureMessage: string | null;
  createdAt: string;
}

interface InvoicesResponse {
  data: InvoiceRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}


/**
 * Billing history for the vendor's subscription.
 *
 * Split out because the panel above shows only the latest invoice, which
 * cannot distinguish "never billed" from "failed three months running" — and
 * it is the evidence behind the subscription figure in the Payouts tab.
 */
function InvoiceHistory({ vendorId }: { vendorId: string }) {
  const t = useTranslations("admin.hc.subscriptionTab");
  const { formatPrice } = useCurrency();
  const INVOICE_STATUS_MAP = {
    paid: { label: t("invoicePaid"), variant: "default" as const },
    open: { label: t("invoiceOpen"), variant: "outline" as const },
    failed: { label: t("invoiceFailed"), variant: "destructive" as const },
    void: { label: t("invoiceVoid"), variant: "secondary" as const },
    refunded: { label: t("invoiceRefunded"), variant: "destructive" as const },
  };
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<{
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  } | null>(null);

  useEffect(() => {
    let active = true;

    apiClient
      .get<InvoicesResponse>(
        `/api/admin/vendors/${vendorId}/subscription/payments?page=${page}&limit=10`,
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
        console.error("Failed to load subscription invoices:", error);
        toast.error(t("loadHistoryFailed"));
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [vendorId, page]);

  const columns: DataTableColumn<InvoiceRow>[] = [
    {
      id: "invoice",
      header: t("colInvoice"),
      cell: (row) => (
        <span className="font-mono text-xs">{row.providerInvoiceId}</span>
      ),
      className: "w-[200px]",
    },
    {
      id: "date",
      header: t("colDate"),
      cell: (row) => <DateCell date={row.createdAt} format="medium" />,
      className: "w-[130px]",
    },
    {
      id: "period",
      header: t("colPeriod"),
      cell: (row) =>
        row.periodStart && row.periodEnd ? (
          <span className="text-xs text-muted-foreground">
            {new Date(row.periodStart).toLocaleDateString(pageLocale())} –{" "}
            {new Date(row.periodEnd).toLocaleDateString(pageLocale())}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: "status",
      header: t("colStatus"),
      cell: (row) => (
        <div className="min-w-0">
          <StatusCell status={row.status} statusMap={INVOICE_STATUS_MAP} />
          {row.failureMessage && (
            <p className="mt-0.5 line-clamp-2 text-xs text-destructive">
              {row.failureMessage}
            </p>
          )}
          {!row.failureMessage && row.attemptCount > 1 && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("attempts", { count: row.attemptCount })}
            </p>
          )}
        </div>
      ),
      className: "w-[190px]",
    },
    {
      id: "amount",
      header: t("colAmount"),
      cell: (row) => (
        <div className="min-w-0">
          <CurrencyCell value={row.amountPaid || row.amountDue} />
          {row.amountRefunded > 0 && (
            <p className="truncate text-xs text-muted-foreground">
              {t("refundedAmount", { amount: formatPrice(row.amountRefunded) })}
            </p>
          )}
        </div>
      ),
      className: "w-[140px]",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("billingHistoryTitle")}</CardTitle>
        <CardDescription>
          {t("billingHistoryDescription")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable
          data={rows}
          columns={columns}
          keyField="_id"
          isLoading={isLoading}
          loadingMode="rows"
          pagination={pagination ?? undefined}
          onPageChange={setPage}
          emptyMessage={t("billingHistoryEmpty")}
        />
      </CardContent>
    </Card>
  );
}

export function SubscriptionTab({
  vendorId,
  readOnly,
  plansEnabled,
  subscription,
  onSubscriptionChange,
}: SubscriptionTabProps) {
  const t = useTranslations("admin.hc.subscriptionTab");
  const intervalLabels = {
    monthly: t("intervalMonthly"),
    yearly: t("intervalYearly"),
  };
  const { formatPrice } = useCurrency();
  const { confirm } = useConfirmation();
  const showPlans = Boolean(plansEnabled && vendorId);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [selectedPlan, setSelectedPlan] = useState("");
  const [isLoadingPlans, setIsLoadingPlans] = useState(showPlans);
  const [isAssigning, setIsAssigning] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isReversingCancellation, setIsReversingCancellation] = useState(false);
  const [isCancellingChange, setIsCancellingChange] = useState(false);
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);

  // A downgrade to a free plan is staged as a period-end cancellation, so
  // `cancelAtPeriodEnd` on its own cannot tell "the vendor is leaving" from
  // "the vendor is moving to a cheaper plan". The pending change decides which
  // undo is the honest one to offer — offering "Keep subscription" against a
  // scheduled downgrade is what sent admins into a raw Stripe error.
  const hasScheduledDowngrade = Boolean(
    subscription?.pendingChangeType === "downgrade" &&
      subscription?.pendingChangeStatus === "scheduled",
  );
  const hasPendingCancellation = Boolean(
    subscription?.cancelAtPeriodEnd && !hasScheduledDowngrade,
  );

  // Is there a real Stripe subscription behind this row? `provider` alone is
  // not the answer: buildSubscriptionForPlan stamps "stripe" on EVERY paid
  // incomplete row as a placeholder, and the real rail is only written once a
  // period is actually collected. The provider ref is what distinguishes a
  // live Stripe subscription from a not-yet-paid placeholder.
  const hasLiveStripeBilling = Boolean(
    subscription?.provider === "stripe" && subscription?.paymentProviderRef,
  );

  // Mirrors the DELETE route: only a live Stripe subscription cancels at
  // period end; everything else is cancelled immediately.
  const cancelsAtPeriodEnd = hasLiveStripeBilling;

  // Offline payment / comp-extend covers every paid plan Stripe is not
  // already billing — one-shot gateways, manual rows, and a vendor whose
  // first period is being settled by bank transfer.
  const canRecordPayment = Boolean(
    subscription &&
    !hasLiveStripeBilling &&
    subscription.billingInterval &&
    subscription.billingInterval !== "none",
  );

  const handleRecordPayment = async () => {
    if (!vendorId) return;
    const confirmed = await confirm({
      title: t("recordPaymentTitle"),
      description: t("recordPaymentDescription"),
      confirmText: t("recordPaymentConfirm"),
      cancelText: t("cancel"),
    });
    if (!confirmed) return;
    setIsRecordingPayment(true);
    try {
      await apiClient.patch(`/api/admin/vendors/${vendorId}/subscription`, {
        action: "record_payment",
      });
      toast.success(t("paymentRecorded"));
      onSubscriptionChange?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("recordPaymentFailed"),
      );
    } finally {
      setIsRecordingPayment(false);
    }
  };

  const distress = billingDistress(subscription);

  useEffect(() => {
    if (!showPlans) return;
    let active = true;

    apiClient
      .get<{ data: PlanOption[] }>(
        "/api/admin/vendors/plans?limit=100&status=active",
      )
      .then((res) => {
        if (active) setPlans(res.data || []);
      })
      .catch((error) => {
        if (!active) return;
        console.error("Failed to load plans:", error);
      })
      .finally(() => {
        if (active) setIsLoadingPlans(false);
      });

    return () => {
      active = false;
    };
  }, [showPlans]);

  const handleAssign = async () => {
    if (!vendorId || !selectedPlan) return;
    setIsAssigning(true);
    try {
      await apiClient.post(`/api/admin/vendors/${vendorId}/subscription`, {
        planId: selectedPlan,
      });
      toast.success(
        subscription?.planName ? t("planChangeStaged") : t("planAssigned"),
      );
      setSelectedPlan("");
      onSubscriptionChange?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("assignPlanFailed"),
      );
    } finally {
      setIsAssigning(false);
    }
  };

  const handleCancel = async () => {
    if (!vendorId) return;
    const ok = await confirm({
      title: t("cancelSubscriptionTitle"),
      description: cancelsAtPeriodEnd
        ? `${t("cancelAtPeriodEndDescription")}${
            hasScheduledDowngrade ? ` ${t("cancelDropsDowngrade")}` : ""
          }`
        : t("cancelImmediateDescription"),
      confirmText: cancelsAtPeriodEnd
        ? t("scheduleCancellation")
        : t("cancelNow"),
      cancelText: t("keepPlan"),
      variant: "destructive",
    });
    if (!ok) return;

    setIsCancelling(true);
    try {
      await apiClient.delete(`/api/admin/vendors/${vendorId}/subscription`);
      toast.success(
        cancelsAtPeriodEnd
          ? t("cancellationScheduled")
          : t("subscriptionCancelled"),
      );
      onSubscriptionChange?.();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("cancelSubscriptionFailed"),
      );
    } finally {
      setIsCancelling(false);
    }
  };

  const handleReverseCancellation = async () => {
    if (!vendorId) return;
    setIsReversingCancellation(true);
    try {
      await apiClient.patch(`/api/admin/vendors/${vendorId}/subscription`, {});
      toast.success(t("cancellationReversed"));
      onSubscriptionChange?.();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("reverseCancellationFailed"),
      );
    } finally {
      setIsReversingCancellation(false);
    }
  };

  const handleCancelScheduledChange = async () => {
    if (!vendorId) return;
    const ok = await confirm({
      title: t("cancelDowngradeTitle"),
      description: t("cancelDowngradeDescription", {
        plan: subscription?.planName || t("theirCurrentPlan"),
      }),
      confirmText: t("cancelDowngradeConfirm"),
      cancelText: t("keepDowngrade"),
    });
    if (!ok) return;

    setIsCancellingChange(true);
    try {
      await apiClient.patch(`/api/admin/vendors/${vendorId}/subscription`, {
        action: "cancel_scheduled_change",
      });
      toast.success(t("downgradeCancelled"));
      onSubscriptionChange?.();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("cancelDowngradeFailed"),
      );
    } finally {
      setIsCancellingChange(false);
    }
  };

  if (!showPlans) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("subscriptionPlanTitle")}</CardTitle>
          <CardDescription>
            {t("plansDisabled")}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("subscriptionPlanTitle")}</CardTitle>
          <CardDescription>
            {t("subscriptionPlanDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {distress && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>{t(distress.titleKey)}</AlertTitle>
              <AlertDescription>
                {distress.detailKey
                  ? t(distress.detailKey, distress.detailValues)
                  : distress.detail}
              </AlertDescription>
            </Alert>
          )}

          {subscription?.planName ? (
            <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{subscription.planName}</p>
                  {subscription.status && (
                    <Badge variant="secondary" className="capitalize">
                      {subscription.status}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {formatPrice(subscription.price ?? 0)}
                  {formatInterval(subscription.billingInterval, intervalLabels)}
                  {typeof subscription.commissionRateSnapshot === "number"
                    ? ` · ${t("commissionPercent", { rate: subscription.commissionRateSnapshot })}`
                    : ""}
                </p>
                {subscription.pendingChangeStatus ? (
                  <p className="text-xs text-muted-foreground">
                    {t("pendingChange", {
                      type: subscription.pendingChangeType || "",
                    })}{" "}
                    {subscription.pendingPlanName || t("currentPlan")} (
                    {subscription.pendingChangeStatus.replaceAll("_", " ")})
                    {subscription.pendingChangeEffectiveAt
                      ? ` · ${new Date(
                          subscription.pendingChangeEffectiveAt,
                        ).toLocaleString()}`
                      : ""}
                  </p>
                ) : null}
                <div className="grid gap-x-6 gap-y-1 pt-2 text-xs text-muted-foreground sm:grid-cols-2">
                  <span>
                    {t("providerLabel")}{" "}
                    {subscription.providerStatus || t("notStarted")}
                  </span>
                  <span>
                    {t("priceLabel")}{" "}
                    {subscription.stripePriceId || t("notLinked")}
                  </span>
                  <span>
                    {t("latestInvoiceLabel")}{" "}
                    {subscription.lastPayment?.providerInvoiceId ||
                      subscription.stripeLatestInvoiceId ||
                      t("none")}
                  </span>
                  <span>
                    {t("invoiceStatusLabel")}{" "}
                    {subscription.lastPayment?.status || t("unknown")}
                  </span>
                  <span>
                    {t("periodLabel")}{" "}
                    {subscription.currentPeriodStart
                      ? new Date(
                          subscription.currentPeriodStart,
                        ).toLocaleDateString(pageLocale())
                      : "—"}{" "}
                    –{" "}
                    {subscription.currentPeriodEnd
                      ? new Date(
                          subscription.currentPeriodEnd,
                        ).toLocaleDateString(pageLocale())
                      : "—"}
                  </span>
                  <span>
                    {t("graceDeadlineLabel")}{" "}
                    {subscription.gracePeriodEnd
                      ? new Date(subscription.gracePeriodEnd).toLocaleString()
                      : t("none")}
                  </span>
                  <span>
                    {t("lastReconciledLabel")}{" "}
                    {subscription.lastReconciledAt
                      ? new Date(subscription.lastReconciledAt).toLocaleString()
                      : t("never")}
                  </span>
                  {subscription.lastReconcileError ? (
                    <span className="text-destructive sm:col-span-2">
                      {t("reconciliationErrorLabel")}{" "}
                      {subscription.lastReconcileError}
                    </span>
                  ) : null}
                </div>
              </div>
              {!readOnly && (
                <div className="flex flex-col items-end gap-2">
                  {hasScheduledDowngrade && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleCancelScheduledChange}
                      disabled={isCancellingChange}
                    >
                      {isCancellingChange && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      {t("cancelDowngradeTitle")}
                    </Button>
                  )}
                  {hasPendingCancellation ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleReverseCancellation}
                      disabled={isReversingCancellation}
                    >
                      {isReversingCancellation && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      {t("keepSubscription")}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleCancel}
                      disabled={isCancelling}
                    >
                      {isCancelling && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      {cancelsAtPeriodEnd
                        ? t("cancelAtPeriodEnd")
                        : t("cancelSubscriptionTitle")}
                    </Button>
                  )}
                  {canRecordPayment ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleRecordPayment}
                      disabled={isRecordingPayment}
                    >
                      {isRecordingPayment && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      {t("recordPaymentExtend")}
                    </Button>
                  ) : null}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("noPlan")}
            </p>
          )}

          {!readOnly && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-2">
                <Label>
                  {subscription?.planName ? t("changePlan") : t("assignPlan")}
                </Label>
                <Select
                  value={selectedPlan}
                  onValueChange={setSelectedPlan}
                  disabled={isLoadingPlans || plans.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        isLoadingPlans
                          ? t("loadingPlans")
                          : plans.length === 0
                            ? t("noActivePlans")
                            : t("selectPlan")
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {plans.map((plan) => (
                      <SelectItem key={plan._id} value={plan._id}>
                        {plan.name} — {formatPrice(plan.price)}
                        {formatInterval(plan.billingInterval, intervalLabels)} ·{" "}
                        {plan.commissionRate}%
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                onClick={handleAssign}
                disabled={!selectedPlan || isAssigning}
              >
                {isAssigning && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {t("assign")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {vendorId && <InvoiceHistory vendorId={vendorId} />}
    </div>
  );
}
