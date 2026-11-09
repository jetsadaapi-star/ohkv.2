"use client";

import { pageLocale } from "@/lib/intl/date-locale";
import { useState } from "react";
import { useTranslations } from "next-intl";
import Link from "@/components/language/link";
import { useRouter } from "@/hooks/use-locale-navigation";
import { FileText, Loader2, ShoppingCart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AccountEmpty } from "./account-ui";
import { toast } from "@/components/ui/toast-notification";
import { useCartActions } from "@/hooks/use-cart";
import { useLiveResource } from "@/hooks/use-live-resource";
import { useSuspenseResource } from "@/hooks/use-suspense-resource";
import { useCurrency } from "@/providers/currency-provider";
import type { QuoteRequestRow } from "@/lib/quotes/quotes";
import { shopperQuoteState, type ShopperQuoteState } from "@/lib/quotes/quote-status";

/**
 * "I asked for a price — where is it?"
 *
 * The shopper's side of the quote inbox. Each row is one request, and the only
 * one that does anything is a request the merchant has answered: that card
 * carries the price, what it covers, and the button that turns it into a
 * normal cart line. Everything after that is the ordinary checkout, because
 * the offer travels on the line rather than being a separate way to pay.
 *
 * Polled rather than static: a shopper who has just asked for a price is very
 * often sitting on this page when it arrives. The first read suspends (the
 * page's `<ClientSuspense>` shows the loading state) and is kept, so coming
 * back to the page shows the list at once; the poll resumes where it left off
 * and writes each new answer into that same copy.
 *
 * Only what the shopper can act on is shown. The store's own working labels
 * ("In progress", "Won", "Lost") are for the merchant; a request the store
 * closed reads "Closed", with a way to ask again.
 */

const STATE_BADGE: Record<
  ShopperQuoteState,
  { key: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  awaiting: { key: "awaitingPrice", variant: "outline" },
  ready: { key: "priceReady", variant: "default" },
  ordered: { key: "ordered", variant: "secondary" },
  expired: { key: "priceExpired", variant: "destructive" },
  withdrawn: { key: "priceWithdrawn", variant: "destructive" },
  closed: { key: "closed", variant: "outline" },
};

function formatDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString(pageLocale(), {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
}

export function CustomerQuotes() {
  const t = useTranslations("account.quotesList");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { addItem } = useCartActions();
  const { formatPrice } = useCurrency();
  const {
    data,
    fetchedAt,
    mutate,
  } = useSuspenseResource<QuoteRequestRow[]>("/api/quotes/mine");
  const { refresh } = useLiveResource<QuoteRequestRow[]>("/api/quotes/mine", {
    onData: mutate,
    initialFetchedAt: fetchedAt,
  });
  const [addingId, setAddingId] = useState<string | null>(null);

  const quotes = data ?? [];

  const buy = async (row: QuoteRequestRow) => {
    if (!row.offer) return;
    setAddingId(row._id);
    try {
      await addItem({
        productId: row.productId,
        // The cart takes a product with variants only with one named; the
        // price is for this variant and no other.
        variantId: row.variantId,
        // The offer is good for one exact lot, so the quantity is the
        // merchant's, not the shopper's — the cart refuses any other.
        quantity: row.offer.quantity,
        price: row.offer.unitPrice,
        name: row.productName,
      });
      router.push("/checkout");
    } catch (error) {
      toast.error(
        error instanceof Error && error.message ? error.message : t("addFailed"),
      );
      // The likeliest failure is an offer that stopped being valid while the
      // page was open, and the list is what says so.
      void refresh();
    } finally {
      setAddingId(null);
    }
  };

  if (quotes.length === 0) {
    return (
      <AccountEmpty
        icon={<FileText />}
        title={t("empty")}
        action={
          <Button asChild className="rounded-xl">
            <Link href="/products">{tCommon("browseProducts")}</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      {quotes.map((row) => {
        const state = shopperQuoteState(row);
        const badge = STATE_BADGE[state];
        const canAskAgain =
          Boolean(row.productSlug) &&
          (state === "expired" || state === "withdrawn" || state === "closed");
        return (
          <div
            key={row._id}
            className={cn(
              "relative overflow-hidden rounded-2xl border bg-card transition hover:shadow-md",
              state === "ready" && "border-[color-mix(in_oklab,var(--highlight)_60%,transparent)] shadow-[0_8px_24px_-14px_color-mix(in_oklab,var(--highlight)_70%,transparent)]",
            )}
          >
            {state === "ready" ? (
              <span aria-hidden className="absolute inset-y-0 start-0 w-1 bg-[var(--highlight)]" />
            ) : null}
            <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  {row.productSlug ? (
                    <Link
                      href={`/products/${row.productSlug}`}
                      className="font-medium hover:underline"
                    >
                      {row.productName}
                    </Link>
                  ) : (
                    <span className="font-medium">{row.productName}</span>
                  )}
                  <Badge variant={badge.variant} className="rounded-full">{t(badge.key)}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {row.variantName ? `${row.variantName} · ` : ""}
                  {t("askedFor", {
                    quantity: row.quantity,
                    date: formatDate(row.createdAt),
                  })}
                </p>
                {row.offer ? (
                  <p className="mt-1 inline-flex flex-wrap items-baseline gap-x-1 rounded-xl bg-muted/60 px-3 py-1.5 text-sm">
                    <span className="font-bold text-primary">
                      {t("each", { price: formatPrice(row.offer.unitPrice) })}
                    </span>
                    <span className="text-muted-foreground">
                      {" · "}
                      {t("lotTotal", {
                        quantity: row.offer.quantity,
                        total: formatPrice(
                          row.offer.unitPrice * row.offer.quantity,
                        ),
                      })}
                    </span>
                  </p>
                ) : null}
                {row.offer && state === "ready" ? (
                  <p className="text-xs text-muted-foreground">
                    {t("beforeShippingTax")}
                  </p>
                ) : null}
                {row.offer?.note ? (
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                    {row.offer.note}
                  </p>
                ) : null}
                {state === "ready" && row.offer?.expiresAt ? (
                  <p className="text-xs text-muted-foreground">
                    {t("heldUntil", { date: formatDate(row.offer.expiresAt) })}
                  </p>
                ) : null}
              </div>

              <div className="shrink-0">
                {state === "ready" ? (
                  <Button
                    onClick={() => buy(row)}
                    disabled={addingId === row._id}
                    className="rounded-xl shadow-md shadow-primary/20"
                  >
                    {addingId === row._id ? (
                      <Loader2 className="me-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ShoppingCart className="me-2 h-4 w-4" />
                    )}
                    {t("addToCart")}
                  </Button>
                ) : state === "ordered" && row.orderId ? (
                  <Button asChild variant="outline" className="rounded-xl">
                    <Link href={`/account/orders/${row.orderId}`}>
                      {t("viewOrder")}
                    </Link>
                  </Button>
                ) : canAskAgain ? (
                  <Button asChild variant="outline" className="rounded-xl">
                    <Link href={`/products/${row.productSlug}`}>
                      {t("askAgain")}
                    </Link>
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
