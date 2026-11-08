"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Clock3, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast-notification";
import { WarningBanner } from "@/components/ui/warning-banner";
import { apiClient, describeApiError } from "@/lib/api/client";

/**
 * Shown to a vendor this store has not cleared for pre-orders yet.
 *
 * Without a way to ask, the admin's approval queue would never have anything in
 * it and the only route in would be emailing someone — which is what this
 * replaces. It appears solely when the store actually requires review, so a
 * shop that leaves review off never sees a gate that is not there.
 *
 * `requestedAt` is passed from the server rather than fetched, so the pending
 * state is right on first paint instead of flashing "Request access" at a
 * vendor who already asked yesterday.
 */
export function VendorPreorderAccessNotice(props: {
  requestedAt?: string | null;
  maxLeadDays: number;
  maxDepositPercent: number;
}) {
  const t = useTranslations("admin.hc.preorderAccessNotice");
  const [requested, setRequested] = useState(Boolean(props.requestedAt));
  const [isSubmitting, setIsSubmitting] = useState(false);

  const request = async () => {
    setIsSubmitting(true);
    try {
      await apiClient.post("/api/vendor/preorder-access");
      setRequested(true);
      toast.success(t("requestSent"));
    } catch (error) {
      toast.error(describeApiError(error, t("requestFailed")));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <WarningBanner
      icon={requested ? Clock3 : Lock}
      title={
        requested
          ? t("pendingTitle")
          : t("reviewTitle")
      }
      action={
        !requested ? (
          // `type="button"`: this notice also sits inside the product editor's
          // form, where a default-typed button would submit the product.
          <Button
            type="button"
            size="sm"
            disabled={isSubmitting}
            onClick={() => void request()}
          >
            {isSubmitting ? t("sending") : t("requestAccess")}
          </Button>
        ) : null
      }
    >
      {requested
        ? t("pendingBody")
        : t("reviewBody", {
            maxLeadDays: props.maxLeadDays,
            maxDepositPercent: props.maxDepositPercent,
          })}
    </WarningBanner>
  );
}
