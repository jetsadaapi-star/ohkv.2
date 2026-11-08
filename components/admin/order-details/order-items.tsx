"use client";

import { pageLocale } from "@/lib/intl/date-locale";
import { useTranslations } from "next-intl";
import Link from "@/components/language/link";
import { ShoppingBag } from "lucide-react";
import { SectionCard } from "@/components/admin/customers/section-card";
import { cn } from "@/lib/utils";
import { WarningBanner } from "@/components/ui/warning-banner";
import { Badge } from "@/components/ui/badge";
import { AppImage } from "@/components/ui/app-image";
import { useCurrency } from "@/providers/currency-provider";
import { IOrder } from "@/types";

interface OrderItemsProps {
  order: IOrder;
}

export function OrderItems({ order }: OrderItemsProps) {
  const t = useTranslations("admin");
  const op = useTranslations("admin.hc.orderPage");
  // The order is settled in the currency frozen at checkout, not whatever the
  // store's default happens to be today.
  const { formatPrice } = useCurrency();

  const isSplitShipment = order.subOrders && order.subOrders.length > 1;
  const discount = Number(order.discount || 0);
  const dutyAmount = Number(order.customs?.dutyAmount || 0);
  const refundedTotal = Number(order.refundedTotal || 0);

  const itemCount = order.items.reduce((n, item) => n + Number(item.quantity || 0), 0);
  const paid = order.paymentStatus === "paid";

  const SummaryRow = ({
    label,
    value,
    negative,
    strong,
  }: {
    label: React.ReactNode;
    value: number;
    negative?: boolean;
    strong?: boolean;
  }) => (
    <div className={cn("flex items-center justify-between gap-4 text-sm", strong && "font-medium")}>
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("tabular-nums", negative && "text-red-600")}>
        {negative ? "-" : ""}
        {formatPrice(value)}
      </span>
    </div>
  );

  return (
    <SectionCard
      icon={ShoppingBag}
      tone="violet"
      title={t("orderDetails.orderItems")}
      description={op("itemsDescription", { lines: order.items.length, count: itemCount })}
      contentClassName="p-0"
    >
      {isSplitShipment && (
        <div className="px-5 pt-4">
          <WarningBanner title={t("orderDetails.splitShipment")}>
            {t("orderDetails.splitShipmentDescription")}
          </WarningBanner>
        </div>
      )}

      <ul className="divide-y">
        {order.items.map((item, index) => (
          <li key={index} className="flex items-start gap-4 px-5 py-4">
            <div className="relative size-16 shrink-0 overflow-hidden rounded-xl border bg-muted">
              <AppImage src={item.image} alt={item.name} fill className="object-cover" />
              {item.quantity > 1 ? (
                <span className="absolute -end-0 -top-0 rounded-bl-lg bg-slate-900/85 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  ×{item.quantity}
                </span>
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 font-semibold leading-snug">{item.name}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {item.sku ? (
                  <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                    {item.sku}
                  </span>
                ) : null}
                {/* Sold at a negotiated price rather than the catalogue's;
                    the quote holds how it was agreed. */}
                {item.quoteId ? (
                  <Link
                    href={`/admin/quotes?quote=${String(item.quoteId)}`}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    {t("orderDetails.quotedPrice")}
                  </Link>
                ) : null}
                {/* Preorder lines ship on a different clock than the rest of
                    the order. */}
                {item.purchaseType === "preorder" ? (
                  <Badge variant="outline">
                    {item.preorderReleaseDate
                      ? t("orderDetails.preorderReleases", {
                          date: new Date(item.preorderReleaseDate).toLocaleDateString(pageLocale()),
                        })
                      : t("orderDetails.preorderItem")}
                  </Badge>
                ) : null}
              </div>
              <p className="mt-1.5 text-sm text-muted-foreground tabular-nums">
                {formatPrice(item.price)} × {item.quantity}
              </p>
            </div>
            <p className="shrink-0 text-end font-semibold tabular-nums">
              {formatPrice(item.price * item.quantity)}
            </p>
          </li>
        ))}
      </ul>

      <div className="border-t bg-muted/30 px-5 py-4">
        <div className="ms-auto max-w-sm space-y-2">
          <SummaryRow label={t("orderDetails.subtotal")} value={order.subtotal} />
          <SummaryRow
            label={
              <>
                {t("orderDetails.shipping")}
                {order.shippingMethod?.name ? ` · ${order.shippingMethod.name}` : ""}
              </>
            }
            value={order.shippingCost}
          />
          {Number(order.tax || 0) > 0 ? <SummaryRow label={t("orderDetails.tax")} value={order.tax} /> : null}
          {/* Added to the total at checkout; without its own row the lines
              above did not add up to it. */}
          {dutyAmount > 0 ? <SummaryRow label={t("orderDetails.importDuties")} value={dutyAmount} /> : null}
          {discount > 0 ? (
            <SummaryRow
              label={
                <>
                  {t("orderDetails.discount")}
                  {order.coupon?.code ? (
                    <span className="ms-1.5 rounded-md bg-emerald-50 px-1.5 py-0.5 font-mono text-[11px] text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                      {order.coupon.code}
                    </span>
                  ) : null}
                </>
              }
              value={discount}
              negative
            />
          ) : null}
          <div className="flex items-center justify-between gap-4 rounded-2xl bg-card px-4 py-3 shadow-sm ring-1 ring-border">
            <div>
              <p className="text-sm font-semibold">{t("orderDetails.totalLabel")}</p>
              <p className={cn("text-xs font-medium", paid ? "text-emerald-600" : "text-amber-600")}>
                {t(`orderDetails.paymentStatus.${order.paymentStatus}`)}
              </p>
            </div>
            <p className="text-2xl font-extrabold tracking-tight tabular-nums">{formatPrice(order.total)}</p>
          </div>
          {/* The part the shopper's store credit paid (R8); the payment
              method took the rest. */}
          {order.storeCredit?.state !== "released" && Number(order.storeCredit?.applied || 0) > 0 ? (
            <SummaryRow
              label={
                order.exchangeOf?.returnNumber
                  ? t("orderDetails.paidByReturn", { returnNumber: order.exchangeOf.returnNumber })
                  : t("orderDetails.paidWithStoreCredit")
              }
              value={Number(order.storeCredit?.applied || 0)}
            />
          ) : null}
          {/* How much was refunded, and what the order nets after it. */}
          {refundedTotal > 0 ? (
            <>
              <SummaryRow label={t("orderDetails.refunded")} value={refundedTotal} negative />
              <SummaryRow
                label={t("orderDetails.netTotal")}
                value={Math.max(0, Number(order.total || 0) - refundedTotal)}
                strong
              />
            </>
          ) : null}
        </div>
      </div>
    </SectionCard>
  );
}
