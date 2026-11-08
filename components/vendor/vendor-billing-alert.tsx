"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CreditCard } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast-notification";
import { SubscriptionPaymentDialog } from "@/components/vendor/subscription-payment-dialog";

/**
 * Past-due banner. Stripe subscriptions route to the Stripe billing portal
 * (Stripe owns their retries); every other provider renews with a one-shot
 * charge through the gateway picker.
 */
export function VendorBillingAlert({
  locale,
  provider,
  gracePeriodEnd,
}: {
  locale: string;
  provider?: string | null;
  gracePeriodEnd?: string | null;
}) {
  const t = useTranslations("admin.hc.vendorBillingAlert");
  const [loading, setLoading] = useState(false);
  const [renewOpen, setRenewOpen] = useState(false);
  const isStripe = provider === "stripe";

  async function openPortal() {
    setLoading(true);
    try {
      const response = await fetch("/api/vendor/subscription/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.data?.url) {
        toast.error(body?.message || t("portalError"));
        return;
      }
      window.location.assign(body.data.url);
    } catch {
      toast.error(t("portalError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Alert variant="destructive">
        <CreditCard className="h-4 w-4" />
        <AlertTitle>
          {isStripe ? t("paymentFailedTitle") : t("renewalDueTitle")}
        </AlertTitle>
        <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span>
            {gracePeriodEnd
              ? t(isStripe ? "updatePaymentBefore" : "renewBefore", {
                  date: new Date(gracePeriodEnd).toLocaleString(),
                })
              : t(isStripe ? "updatePaymentGrace" : "renewGrace")}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={isStripe ? openPortal : () => setRenewOpen(true)}
            disabled={loading}
            className="shrink-0"
          >
            {loading ? t("opening") : isStripe ? t("updatePayment") : t("renewNow")}
          </Button>
        </AlertDescription>
      </Alert>
      {!isStripe ? (
        <SubscriptionPaymentDialog
          open={renewOpen}
          onOpenChange={setRenewOpen}
          locale={locale}
          endpoint="/api/vendor/subscription/renew"
          excludeStripe
          title={t("renewDialogTitle")}
          description={t("renewDialogDescription")}
        />
      ) : null}
    </>
  );
}
