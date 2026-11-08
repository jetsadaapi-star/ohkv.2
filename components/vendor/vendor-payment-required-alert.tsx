"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WarningBanner } from "@/components/ui/warning-banner";
import { SubscriptionPaymentDialog } from "@/components/vendor/subscription-payment-dialog";

export function VendorPaymentRequiredAlert({
  locale,
  paymentDueAt,
}: {
  locale: string;
  paymentDueAt?: string | null;
}) {
  const t = useTranslations("admin.hc.vendorPaymentRequiredAlert");
  const [payOpen, setPayOpen] = useState(false);

  return (
    <>
      <WarningBanner
        role="alert"
        icon={CreditCard}
        title={t("title")}
        action={
          <Button
            type="button"
            size="sm"
            onClick={() => setPayOpen(true)}
            className="shrink-0"
          >
            {t("completePayment")}
          </Button>
        }
      >
        {t("body", {
          until: paymentDueAt
            ? new Date(paymentDueAt).toLocaleString()
            : t("endOfSetupPeriod"),
        })}
      </WarningBanner>
      <SubscriptionPaymentDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        locale={locale}
        endpoint="/api/vendor/applications/checkout"
        title={t("dialogTitle")}
        description={t("dialogDescription")}
      />
    </>
  );
}
