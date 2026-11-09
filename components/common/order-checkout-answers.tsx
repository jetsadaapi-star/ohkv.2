"use client";

import { useTranslations } from "next-intl";
import { ClipboardList, Gift } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { OrderCheckoutField } from "@/types";

interface OrderCheckoutAnswersProps {
  customerNote?: string;
  checkoutFields?: OrderCheckoutField[];
  /** Wrapped as a gift, with its message — for whoever packs the parcel. */
  giftWrap?: { enabled?: boolean; message?: string } | null;
  className?: string;
  /**
   * `stack` (default) lists the answers down a side column, as the admin and
   * vendor pages show them. `columns` spreads them across a full-width card,
   * with the note on its own line underneath.
   */
  layout?: "stack" | "columns";
}

/**
 * What the shopper told the store at checkout: their order note and the
 * answers to the store's own checkout fields. The labels are the ones the
 * order was placed with, so a field renamed or deleted since still reads
 * right. Shared by the admin, vendor and customer order pages.
 */
export function OrderCheckoutAnswers({
  customerNote,
  checkoutFields,
  giftWrap,
  className,
  layout = "stack",
}: OrderCheckoutAnswersProps) {
  const t = useTranslations();
  const tr = (key: string, fallback: string) => (t.has(key) ? t(key) : fallback);
  const fields = (checkoutFields ?? []).filter((field) => field.value);
  const note = customerNote?.trim();
  const gift = giftWrap?.enabled ? giftWrap : null;
  if (!note && fields.length === 0 && !gift) return null;

  const display = (field: OrderCheckoutField) =>
    field.type === "checkbox"
      ? field.value === "true"
        ? tr("common.yes", "Yes")
        : tr("common.no", "No")
      : field.value;

  return (
    <Card className={className ?? "gap-4"}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardList className="h-4 w-4" />
          {tr("checkout.additionalInformation", "Additional information")}
        </CardTitle>
      </CardHeader>
      <CardContent
        className={cn(
          "text-sm",
          layout === "columns"
            ? "grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3"
            : "space-y-3",
        )}
      >
        {gift ? (
          <div
            className={cn(
              "flex gap-3 rounded-xl bg-[color-mix(in_oklab,var(--highlight)_14%,transparent)] p-3 ring-1 ring-inset ring-[color-mix(in_oklab,var(--highlight)_45%,transparent)]",
              layout === "columns" && "sm:col-span-full",
            )}
          >
            <Gift className="mt-0.5 size-4 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="font-semibold">{tr("checkout.giftWrap.orderTitle", "Wrap as a gift")}</p>
              {gift.message ? (
                <p className="mt-0.5 whitespace-pre-wrap break-words text-muted-foreground">
                  “{gift.message}”
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
        {fields.map((field) => (
          <div key={field.key} className="min-w-0">
            <p className="text-muted-foreground">{field.label}</p>
            <p className="mt-0.5 whitespace-pre-wrap break-words font-medium">
              {display(field)}
            </p>
          </div>
        ))}
        {note ? (
          <div className={layout === "columns" ? "min-w-0 sm:col-span-full" : undefined}>
            <p className="text-muted-foreground">
              {tr("checkout.orderNote", "Order note")}
            </p>
            <p className="mt-0.5 whitespace-pre-wrap break-words">{note}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
