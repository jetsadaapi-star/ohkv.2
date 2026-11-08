"use client";

import { Clock3, MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { statusBadgeClass } from "@/lib/ui/status-palette";

/**
 * A vendor consignment's fulfilment state, worded and coloured as the vendor
 * order list's Fulfillment column shows it. The dashboard's recent orders use
 * the same badge, so one order never reads two different ways.
 *
 * A consignment collected in person shows its pickup progress instead.
 */
export function VendorFulfillmentBadge({
  status,
  pickupStatus,
  className,
}: {
  status: string;
  pickupStatus?: string;
  className?: string;
}) {
  const t = useTranslations();
  const shown = pickupStatus || status;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-semibold ring-1 ring-inset",
        // The shared palette: pending amber, processing blue, shipped indigo,
        // delivered green, cancelled red.
        statusBadgeClass(shown),
        className,
      )}
    >
      {pickupStatus ? (
        <MapPin className="h-3.5 w-3.5 shrink-0" />
      ) : (
        <Clock3 className="h-3.5 w-3.5 shrink-0" />
      )}
      {pickupStatus
        ? `${t("checkout.pickup.localPickup")} · ${t(`checkout.pickup.${pickupStatus}`)}`
        : t(`vendor.fulfillmentStatus.${status}`)}
    </span>
  );
}
