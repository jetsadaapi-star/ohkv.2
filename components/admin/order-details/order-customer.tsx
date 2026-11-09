"use client";

import { IOrder } from "@/types";
import { useTranslations } from "next-intl";
import Link from "@/components/language/link";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Copy,
  Mail,
  MapPin,
  PackageOpen,
  Phone,
  ReceiptText,
  StickyNote,
  Store,
  UserCheck,
  UserRound,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/admin/customers/section-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getPaymentMethodMeta } from "@/components/common/payment-method-meta";
import { OrderCheckoutAnswers } from "@/components/common/order-checkout-answers";
import { isPosWalkIn, posWalkInName } from "@/lib/orders/pos-walk-in";

interface OrderCustomerProps {
  order: IOrder & {
    customerId?: {
      _id: string;
      name: string;
      email: string;
      phone?: string;
      image?: string;
      createdAt?: string | Date;
    } | string;
    /**
     * Resolved by `GET /api/admin/orders/[id]` from the stored `posLocationId`,
     * which is a bare string and cannot be populated. Absent for online orders
     * and for a counter sale rung up on shared stock.
     */
    posLocationName?: string;
    /**
     * Who rang a POS sale up, resolved on the server from `staffId` (a bare
     * string). Absent for online orders and when that user no longer exists.
     */
    soldByName?: string;
  };
}

export function OrderCustomer({ order }: OrderCustomerProps) {
  const t = useTranslations("admin");
  const tRoot = useTranslations();
  const op = useTranslations("admin.hc.orderPage");
  const payment = getPaymentMethodMeta(tRoot, order.paymentMethod);

  // A counter sale with no customer chosen is filed under its cashier. It
  // names nobody: not the cashier's name, email, phone or join date.
  const walkIn = isPosWalkIn(order);
  const customer =
    !walkIn && typeof order.customerId === "object" ? order.customerId : null;
  const shipping = order.shippingAddress;
  const billing = order.billingAddress || shipping;
  const getAddressName = (address: typeof shipping) =>
    address.fullName ||
    [address.firstName, address.lastName].filter(Boolean).join(" ");
  // The signup year, not "now". This read `new Date().getFullYear()`, so every
  // customer on every order appeared to have joined the current year.
  const customerSinceYear = customer?.createdAt
    ? new Date(customer.createdAt).getFullYear()
    : null;
  // Guest orders carry the checkout email on the order itself — customerId
  // points at the guest's cart and populates nothing.
  const contactEmail = customer?.email || order.guestEmail;
  const contactPhone = order.contactPhone || customer?.phone || shipping.phone;

  const customerId = customer && typeof customer === "object" ? customer._id : null;
  const sameAsShipping =
    !order.billingAddress ||
    [billing.street, billing.city, billing.state, billing.postalCode].join("|") ===
      [shipping.street, shipping.city, shipping.state, shipping.postalCode].join("|");
  const looksLikePhone = (value?: string) => Boolean(value && !value.includes("@") && /\d{6,}/.test(value.replace(/\D/g, "")));

  const AddressBlock = ({ address }: { address: typeof shipping }) => (
    <div className="space-y-0.5 text-sm leading-relaxed">
      {getAddressName(address) ? <p className="font-semibold">{getAddressName(address)}</p> : null}
      <p>{[address.street, address.apartment].filter(Boolean).join(" ")}</p>
      <p>{[address.city, address.state, address.postalCode].filter(Boolean).join(" ")}</p>
      {address.country && !["th", "tha", "thailand", "ประเทศไทย"].includes(address.country.trim().toLowerCase()) ? (
        <p>{address.country}</p>
      ) : null}
      {looksLikePhone(address.phone) ? (
        <a href={`tel:${address.phone}`} className="mt-1 inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
          <Phone className="size-3.5" />
          {address.phone}
        </a>
      ) : null}
    </div>
  );

  const copyAddress = (address: typeof shipping) => {
    const text = [
      getAddressName(address),
      [address.street, address.apartment].filter(Boolean).join(" "),
      [address.city, address.state, address.postalCode].filter(Boolean).join(" "),
      looksLikePhone(address.phone) ? address.phone : "",
    ]
      .filter(Boolean)
      .join("\n");
    void navigator.clipboard?.writeText(text).then(
      () => toast.success(op("addressCopied")),
      () => undefined,
    );
  };

  return (
    <div className="space-y-5">
      {/* Customer */}
      <SectionCard icon={UserRound} tone="sky" title={t("orderDetails.customer")}>
        <div className="flex items-center gap-3">
          <Avatar className="size-12 ring-2 ring-background">
            <AvatarImage src={customer?.image} />
            <AvatarFallback className="bg-sky-100 font-semibold text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
              {walkIn ? (
                <UserRound className="size-5" aria-hidden />
              ) : (
                customer?.name?.charAt(0).toUpperCase() || "C"
              )}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate font-semibold">
              {walkIn
                ? (posWalkInName(order) ?? t("orderDetails.walkInCustomer"))
                : customer?.name || t("orderDetails.guestCheckout")}
            </p>
            {customerSinceYear ? (
              <p className="text-xs text-muted-foreground">
                {t("orderDetails.customerSince")} {customerSinceYear}
              </p>
            ) : !walkIn && !customer ? (
              <span className="mt-0.5 inline-block rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {op("guest")}
              </span>
            ) : null}
          </div>
        </div>

        {/* Nothing to show for a walk-in unless the till took a number. */}
        {contactEmail || contactPhone ? (
          <div className="mt-4 grid gap-2">
            {contactEmail ? (
              <a
                href={`mailto:${contactEmail}`}
                className="flex items-center gap-2.5 rounded-xl border px-3 py-2 text-sm transition-colors hover:bg-muted/50"
              >
                <Mail className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{contactEmail}</span>
              </a>
            ) : null}
            {contactPhone && looksLikePhone(contactPhone) ? (
              <a
                href={`tel:${contactPhone}`}
                className="flex items-center gap-2.5 rounded-xl border px-3 py-2 text-sm transition-colors hover:bg-muted/50"
              >
                <Phone className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{contactPhone}</span>
              </a>
            ) : null}
          </div>
        ) : null}

        {customerId ? (
          <Link
            href={`/admin/customers/${customerId}`}
            className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            {op("viewCustomer")}
            <ChevronRight className="size-4" />
          </Link>
        ) : null}
      </SectionCard>

      {/* Delivery */}
      <SectionCard
        icon={order.digitalOnly ? PackageOpen : MapPin}
        tone="emerald"
        title={order.digitalOnly ? t("orderDetails.digitalOnlyOrder") : t("orderDetails.shippingAddress")}
        action={
          order.digitalOnly ? null : (
            <Button type="button" variant="ghost" size="sm" className="h-8 gap-1.5" onClick={() => copyAddress(shipping)}>
              <Copy className="size-3.5" />
              {op("copy")}
            </Button>
          )
        }
      >
        {/* Digital-only checkouts never collect a shipping address. */}
        {order.digitalOnly ? (
          <p className="text-sm text-muted-foreground">{t("orderDetails.noShippingRequired")}</p>
        ) : (
          <>
            <AddressBlock address={shipping} />
            {/* Beside the address it is about, so nobody copies it onto a
                parcel while the banner above says it can't be delivered to. */}
            {order.addressHold?.state === "open" ? (
              <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-destructive/5 px-3 py-2 text-xs text-destructive">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                <span>{order.addressHold.message || op("addressUndeliverable")}</span>
              </p>
            ) : null}
          </>
        )}
      </SectionCard>

      {/* Billing */}
      <SectionCard icon={ReceiptText} tone="slate" title={t("orderDetails.billingAddress")}>
        {sameAsShipping && !order.digitalOnly ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="size-4 text-emerald-600" />
            {op("sameAsShipping")}
          </p>
        ) : (
          <AddressBlock address={billing} />
        )}
      </SectionCard>

      {/* Payment & channel */}
      <SectionCard icon={Wallet} tone="amber" title={t("orderDetails.payment")}>
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-muted">
            {order.paymentMethod === "promptpay" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src="/banks/icons/PromptPay.png" alt="" className="size-8 rounded-lg object-contain" />
            ) : (
              <payment.Icon className="size-5 text-muted-foreground" />
            )}
          </span>
          <div className="min-w-0">
            <p className="font-semibold">{payment.label}</p>
            <p className="text-xs text-muted-foreground">
              {t(`orderDetails.paymentStatus.${order.paymentStatus}`)}
            </p>
          </div>
        </div>
        {/* An in-store sale and a web order looked identical; the counter
            matters too, since a return is traced to its branch's stock. */}
        {order.channel === "pos" ? (
          <div className="mt-3 space-y-1.5 border-t pt-3 text-sm">
            <p className="flex items-center gap-2">
              <Store className="size-4 text-muted-foreground" />
              {t("orderDetails.posSale")}
              {order.posLocationName ? <span className="text-muted-foreground">· {order.posLocationName}</span> : null}
            </p>
            {order.soldByName ? (
              <p className="flex items-center gap-2">
                <UserCheck className="size-4 text-muted-foreground" />
                {t("orderDetails.soldBy", { name: order.soldByName })}
              </p>
            ) : null}
          </div>
        ) : null}
      </SectionCard>

      <OrderCheckoutAnswers customerNote={order.customerNote} checkoutFields={order.checkoutFields} giftWrap={(order as { giftWrap?: { enabled?: boolean; message?: string } }).giftWrap} />

      {/* Internal notes were captured on the order but had nowhere to
          surface. */}
      {order.notes ? (
        <SectionCard icon={StickyNote} tone="rose" title={t("orderDetails.internalNotes")}>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{order.notes}</p>
        </SectionCard>
      ) : null}
    </div>
  );
}
