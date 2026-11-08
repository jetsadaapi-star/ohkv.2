"use client";

import { pageLocale } from "@/lib/intl/date-locale";
import { useCallback, useEffect, useState } from "react";
import { Banknote, Info } from "lucide-react";
import { useTranslations } from "next-intl";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast-notification";
import { useConfirmation } from "@/components/ui/confirmation-dialog";
import { apiClient } from "@/lib/api/client";
import { useCurrencyFormatter } from "@/providers/currency-provider";
import { formatCurrency } from "@/lib/intl/money";
import { resolveCurrency } from "@/lib/intl/currencies";

/**
 * The other direction of the money.
 *
 * Every other figure on this tab is the platform owing the vendor. This one is
 * the vendor owing the platform, and it exists because a cash sale never
 * reaches the platform at all — the merchant took the notes at their own
 * counter, so there is no payout to deduct the commission from. Without a
 * surface an admin has no way to know the balance is there.
 */

interface CommissionInvoice {
  id: string;
  amount: number;
  currency: string;
  status: "open" | "paid" | "cancelled";
  paidAt: string | null;
  orderCount: number;
  note: string | null;
  createdAt: string;
}

interface CommissionResponse {
  currency: string;
  owed: {
    amount: number;
    grossSales: number;
    orderCount: number;
    /** Owed in a currency this card cannot bill — an invoice is raised in one. */
    otherCurrencies?: string[];
  };
  invoices: CommissionInvoice[];
}

/** Each invoice in its own currency — the list can hold more than one. */
function formatInvoiceAmount(invoice: Pick<CommissionInvoice, "amount" | "currency">) {
  const currency = resolveCurrency(String(invoice.currency || "").toUpperCase());
  return formatCurrency(invoice.amount, currency.code, currency.locale);
}

const STATUS_VARIANT = {
  open: "outline",
  paid: "default",
  cancelled: "secondary",
} as const;

const STATUS_LABEL_KEY = {
  open: "invoiceStatusOpen",
  paid: "invoiceStatusPaid",
  cancelled: "invoiceStatusCancelled",
} as const;

export function CommissionOwedCard({ vendorId }: { vendorId: string }) {
  const t = useTranslations("admin.hc.commissionOwedCard");
  const { confirm } = useConfirmation();
  const [data, setData] = useState<CommissionResponse | null>(null);
  // Null is the store's own currency; set when the admin switches to another
  // currency the vendor also owes in.
  const [currency, setCurrency] = useState<string | null>(null);
  const format = useCurrencyFormatter(data?.currency);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);

  const load = useCallback(
    () =>
      apiClient
        .get<CommissionResponse>(
          `/api/admin/vendors/${vendorId}/commission${
            currency ? `?currency=${encodeURIComponent(currency)}` : ""
          }`,
        )
        .then((res) => setData(res))
        .catch((error) => {
          console.error("Failed to load commission balance:", error);
          toast.error(t("loadFailed"));
        })
        .finally(() => setIsLoading(false)),
    [vendorId, currency, t],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const raise = async () => {
    setIsBusy(true);
    try {
      await apiClient.post(
        `/api/admin/vendors/${vendorId}/commission`,
        data?.currency ? { currency: data.currency } : {},
      );
      toast.success(t("invoiceRaised"));
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("raiseFailed"),
      );
    } finally {
      setIsBusy(false);
    }
  };

  const act = async (invoice: CommissionInvoice, action: "collect" | "cancel") => {
    if (action === "cancel") {
      const ok = await confirm({
        title: t("cancelInvoiceTitle"),
        description: t("cancelInvoiceDescription"),
        confirmText: t("cancelInvoice"),
        variant: "destructive",
      });
      if (!ok) return;
    }

    setIsBusy(true);
    try {
      await apiClient.patch(`/api/admin/vendors/${vendorId}/commission`, {
        invoiceId: invoice.id,
        action,
      });
      toast.success(
        action === "collect" ? t("recordedCollected") : t("invoiceCancelled"),
      );
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("actionFailed"),
      );
    } finally {
      setIsBusy(false);
    }
  };

  const owed = data?.owed;
  const invoices = data?.invoices ?? [];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Banknote className="h-4 w-4" />
              {t("title")}
            </CardTitle>
            <CardDescription>
              {t("description")}
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={raise}
            disabled={isLoading || isBusy || !owed || owed.amount <= 0}
          >
            {t("raiseInvoice")}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading ? (
          <Skeleton className="h-9 w-40" />
        ) : (
          <>
            <p className="text-3xl font-semibold tabular-nums">
              {format(owed?.amount ?? 0)}
            </p>
            <p className="text-sm text-muted-foreground">
              {!owed?.orderCount ? (
                t("nothingOutstanding")
              ) : (
                t("owedSummary", {
                  count: owed.orderCount,
                  gross: format(owed.grossSales),
                })
              )}
            </p>
            {/*
              An invoice is raised in ONE currency, so a debt in another cannot
              ride along in this figure. Named rather than dropped — a balance
              nobody is told about is a balance nobody collects.
            */}
            {owed?.otherCurrencies?.length ? (
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>
                  {t("otherCurrencies", {
                    currencies: owed.otherCurrencies.join(", "),
                  })}
                </span>
                {owed.otherCurrencies.map((code) => (
                  <Button
                    key={code}
                    size="sm"
                    variant="outline"
                    className="h-7 px-2"
                    disabled={isBusy}
                    onClick={() => {
                      setIsLoading(true);
                      setCurrency(code);
                    }}
                  >
                    {code}
                  </Button>
                ))}
              </div>
            ) : null}

            {invoices.length > 0 && (
              <div className="divide-y rounded-lg border">
                {invoices.map((invoice) => (
                  <div
                    key={invoice.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium tabular-nums">
                          {formatInvoiceAmount(invoice)}
                        </span>
                        <Badge
                          variant={STATUS_VARIANT[invoice.status]}
                          className="text-[10px] px-1.5 py-0"
                        >
                          {t(STATUS_LABEL_KEY[invoice.status])}
                        </Badge>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {t("invoiceOrders", { count: invoice.orderCount })} ·{" "}
                        {new Date(invoice.createdAt).toLocaleDateString(pageLocale())}
                        {invoice.note ? ` · ${invoice.note}` : ""}
                      </p>
                    </div>

                    {invoice.status === "open" && (
                      <div className="flex shrink-0 gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={isBusy}
                          onClick={() => act(invoice, "cancel")}
                        >
                          {t("cancel")}
                        </Button>
                        <Button
                          size="sm"
                          disabled={isBusy}
                          onClick={() => act(invoice, "collect")}
                        >
                          {t("markCollected")}
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                {t("markCollectedHint")}
              </AlertDescription>
            </Alert>
          </>
        )}
      </CardContent>
    </Card>
  );
}
