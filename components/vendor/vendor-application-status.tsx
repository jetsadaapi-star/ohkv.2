"use client";

import { useState } from "react";
import Link from "@/components/language/link";
import { useRouter } from "@/hooks/use-locale-navigation";
import { AlertTriangle, CheckCircle2, Clock, XCircle } from "lucide-react";
import { VENDOR_STATUS } from "@/config/app.config";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast-notification";
import { SubscriptionPaymentDialog } from "@/components/vendor/subscription-payment-dialog";
import { formatCurrency } from "@/lib/intl/money";
import { resolveCurrency } from "@/lib/intl/currencies";
import { useTranslations } from "next-intl";

/**
 * The pending charge is quoted in the currency the plan was priced in, which is
 * frozen on the application — so it is formatted with that code rather than the
 * store default (which an admin may have changed since).
 */
function formatPlanCharge(price: number, currencyCode?: string | null) {
  const currency = resolveCurrency(currencyCode);
  return formatCurrency(price, currency.code, currency.locale);
}

const STATUS_LABEL_KEYS: Record<string, string> = {
  pending: "statusPending",
  payment_required: "statusPaymentRequired",
  approved: "statusApproved",
  rejected: "statusRejected",
  suspended: "statusSuspended",
};

const INTERVAL_LABEL_KEYS: Record<string, string> = {
  monthly: "intervalMonthly",
  yearly: "intervalYearly",
};

interface VendorApplicationStatusProps {
  status?: string;
  storeName?: string;
  locale?: string;
  payment?: {
    status?: string | null;
    dueAt?: string | null;
    planName?: string | null;
    price?: number | null;
    currency?: string | null;
    billingInterval?: string | null;
  } | null;
  canContinueToDashboard?: boolean;
  setupAccessExpired?: boolean;
  /** The paid plan's free trial ran out unpaid. A different situation from an
   * expired setup window: the vendor has been selling, and is being asked for
   * the first payment now rather than for the one they never made. */
  trialEnded?: boolean;
  /**
   * A suspended seller's money, read-only: what is held for them (payouts are
   * frozen meanwhile) and their latest payouts. Suspension locks the dashboard
   * but not their right to see what they are owed.
   */
  money?: {
    currency: string;
    ready: number;
    held: number;
    payouts: Array<{ number: string; status: string; net: number; currency: string; createdAt: string }>;
  } | null;
}

export function VendorApplicationStatus({
  status,
  storeName,
  locale = "en",
  payment,
  canContinueToDashboard = false,
  setupAccessExpired = false,
  trialEnded = false,
  money = null,
}: VendorApplicationStatusProps) {
  const tMoney = useTranslations("vendor.suspendedMoney");
  const t = useTranslations("admin.hc.vendorApplicationStatus");
  const router = useRouter();
  const [payOpen, setPayOpen] = useState(false);
  const [isContinuing, setIsContinuing] = useState(false);
  const isPending = status === VENDOR_STATUS.PENDING;
  const isPaymentRequired = status === VENDOR_STATUS.PAYMENT_REQUIRED;
  const isRejected = status === VENDOR_STATUS.REJECTED;
  const isSuspended = status === VENDOR_STATUS.SUSPENDED;

  async function continueToDashboard() {
    setIsContinuing(true);
    try {
      const response = await fetch("/api/vendor/applications/continue", {
        method: "POST",
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        toast.error(body?.message || t("openDashboardError"));
        return;
      }
      router.replace("/vendor/dashboard");
      router.refresh();
    } catch {
      toast.error(t("openDashboardError"));
    } finally {
      setIsContinuing(false);
    }
  }

  const Icon = isPending
    ? Clock
    : isPaymentRequired
      ? Clock
      : isRejected
        ? XCircle
        : isSuspended
          ? AlertTriangle
          : CheckCircle2;

  const title = isPending
    ? t("titlePending")
    : isPaymentRequired
      ? trialEnded
        ? t("titleTrialEnded")
        : t("titlePaymentRequired")
      : isRejected
        ? t("titleRejected")
        : isSuspended
          ? t("titleSuspended")
          : t("titleDefault");

  const description = isPending
    ? t("descriptionPending")
    : isPaymentRequired
      ? trialEnded
        ? t("descriptionTrialEnded")
        : setupAccessExpired
          ? t("descriptionSetupExpired")
          : t("descriptionPaymentRequired")
      : isRejected
        ? t("descriptionRejected")
        : isSuspended
          ? t("descriptionSuspended")
          : t("descriptionDefault");

  const statusValue = status || "pending";
  const statusLabelKey = STATUS_LABEL_KEYS[statusValue];
  const intervalLabelKey = payment?.billingInterval
    ? INTERVAL_LABEL_KEYS[payment.billingInterval]
    : undefined;

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-10">
      <div className="mx-auto flex min-h-[70vh] max-w-2xl items-center">
        <Card className="w-full border-border bg-card shadow-sm">
          <CardContent className="p-8 text-center">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <Icon className="h-7 w-7 text-muted-foreground" />
            </div>
            <Badge variant="outline" className="mb-4 capitalize">
              {statusLabelKey
                ? t(statusLabelKey)
                : statusValue.replaceAll("_", " ")}
            </Badge>
            <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
            {storeName ? (
              <p className="mt-2 text-sm font-medium text-muted-foreground">
                {storeName}
              </p>
            ) : null}
            <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
              {description}
            </p>
            {isPaymentRequired && payment ? (
              <div className="mx-auto mt-6 max-w-md border-y py-4 text-left text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">{t("plan")}</span>
                  <span className="font-medium">{payment.planName || "-"}</span>
                </div>
                <div className="mt-2 flex justify-between gap-4">
                  <span className="text-muted-foreground">{t("price")}</span>
                  <span className="font-medium">
                    {formatPlanCharge(
                      Number(payment.price || 0),
                      payment.currency,
                    )}{" "}
                    /{" "}
                    {intervalLabelKey
                      ? t(intervalLabelKey)
                      : payment.billingInterval || t("intervalPeriod")}
                  </span>
                </div>
                {trialEnded ? null : (
                  <div className="mt-2 flex justify-between gap-4">
                    <span className="text-muted-foreground">
                      {t("setupAccessUntil")}
                    </span>
                    <span className="text-right font-medium">
                      {payment.dueAt
                        ? `${new Date(payment.dueAt).toLocaleString()}`
                        : "-"}
                    </span>
                  </div>
                )}
              </div>
            ) : null}
            {isPaymentRequired ? (
              <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                <Button
                  onClick={() => setPayOpen(true)}
                  disabled={isContinuing}
                >
                  {trialEnded ? t("payAndReopen") : t("completePayment")}
                </Button>
                {canContinueToDashboard && !setupAccessExpired ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={continueToDashboard}
                    disabled={isContinuing}
                  >
                    {isContinuing
                      ? t("openingDashboard")
                      : t("continueToDashboard")}
                  </Button>
                ) : null}
              </div>
            ) : null}
            {isSuspended && money ? (
              <div className="mx-auto mt-6 max-w-md border-y py-4 text-start text-sm">
                <p className="font-medium">{tMoney("title")}</p>
                <p className="mt-1 text-xs text-muted-foreground">{tMoney("frozen")}</p>
                <div className="mt-3 flex justify-between gap-4">
                  <span className="text-muted-foreground">{tMoney("ready")}</span>
                  <span className="font-medium tabular-nums">{formatCurrency(money.ready, money.currency)}</span>
                </div>
                <div className="mt-2 flex justify-between gap-4">
                  <span className="text-muted-foreground">{tMoney("held")}</span>
                  <span className="font-medium tabular-nums">{formatCurrency(money.held, money.currency)}</span>
                </div>
                {money.payouts.length > 0 ? (
                  <>
                    <p className="mt-4 font-medium">{tMoney("payouts")}</p>
                    <ul className="mt-1 divide-y">
                      {money.payouts.map((payout) => (
                        <li key={payout.number} className="flex flex-wrap justify-between gap-2 py-1.5">
                          <span className="min-w-0 truncate">
                            {payout.number}
                            <span className="ms-2 text-xs text-muted-foreground">{tMoney(`status.${payout.status}`)}</span>
                          </span>
                          <span className="tabular-nums">{formatCurrency(payout.net, payout.currency)}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </div>
            ) : null}
            {isRejected ? (
              <div className="mt-6 flex justify-center">
                <Button asChild>
                  <Link href="/become-vendor">{t("applyAgain")}</Link>
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
      <SubscriptionPaymentDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        locale={locale}
        endpoint="/api/vendor/applications/checkout"
        title={t("dialogTitle")}
        description={
          payment?.planName
            ? t("dialogDescriptionPlan", { plan: payment.planName })
            : t("dialogDescription")
        }
      />
    </div>
  );
}
