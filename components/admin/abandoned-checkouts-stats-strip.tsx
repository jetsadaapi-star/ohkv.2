import {
  MailCheck,
  RotateCcw,
  ShoppingCart,
  TimerReset,
  WalletCards,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import {
  AdminStatsStrip,
  type AdminStatsStripItem,
} from "@/components/admin/admin-stats-strip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getStoreMoneyFormatter } from "@/lib/intl/server-currency";
import {
  fetchAbandonedCheckoutStats,
  fetchVendorAbandonedCheckoutStats,
} from "@/lib/orders/abandoned-checkout-stats";
import type { AbandonedCheckoutViewer } from "@/lib/orders/abandoned-checkout-list";

/**
 * The figures above an Abandoned checkouts table. Server components with their
 * own queries, so a page drops them in a `<Suspense>` and the table does not
 * wait on them — the Orders page's arrangement.
 */

/**
 * The store's figures, or a staff member's over their scope: the five the
 * admin page has always shown.
 */
export async function AbandonedCheckoutStatsStrip({
  locale,
  viewer,
  variant = "strip",
}: {
  locale: string;
  viewer?: AbandonedCheckoutViewer;
  /** "tiles" on the admin page; the staff area keeps the strip. */
  variant?: "strip" | "tiles";
}) {
  const [stats, formatMoney, t] = await Promise.all([
    fetchAbandonedCheckoutStats(viewer),
    getStoreMoneyFormatter(),
    getTranslations("admin.hc.abandonedCheckoutsStatsStrip"),
  ]);

  const items: AdminStatsStripItem[] = [
    {
      title: t("abandoned"),
      value: new Intl.NumberFormat(locale).format(stats.total),
      description: t("abandonedDesc"),
      icon: <ShoppingCart className="h-5 w-5" />,
      iconClassName: "text-amber-700 bg-amber-100",
    },
    {
      title: t("open"),
      value: new Intl.NumberFormat(locale).format(stats.open),
      description: t("openDesc"),
      icon: <TimerReset className="h-5 w-5" />,
      iconClassName: "text-orange-700 bg-orange-100",
    },
    {
      title: t("recovered"),
      value: new Intl.NumberFormat(locale).format(stats.recovered),
      description: t("recoveredDesc"),
      icon: <RotateCcw className="h-5 w-5" />,
      iconClassName: "text-green-700 bg-green-100",
    },
    {
      title: t("emailsSent"),
      value: new Intl.NumberFormat(locale).format(stats.emailsSent),
      description: t("emailsSentDesc"),
      icon: <MailCheck className="h-5 w-5" />,
      iconClassName: "text-blue-700 bg-blue-100",
    },
    {
      title: t("potentialRevenue"),
      value: formatMoney(stats.potentialRevenue),
      description: t("potentialRevenueDesc"),
      icon: <WalletCards className="h-5 w-5" />,
      iconClassName: "text-cyan-700 bg-cyan-100",
    },
  ];

  return <AdminStatsStrip items={items} variant={variant} />;
}

/**
 * A vendor's figures, over its own lines only, and the products of its that
 * shoppers leave behind most — the part a vendor can do something about.
 * There is no "emails sent": the recovery emails are the store's.
 */
export async function VendorAbandonedCheckoutStatsStrip({
  locale,
  vendorId,
}: {
  locale: string;
  vendorId: string;
}) {
  const [stats, formatMoney, t] = await Promise.all([
    fetchVendorAbandonedCheckoutStats(vendorId),
    getStoreMoneyFormatter(),
    getTranslations("admin.hc.abandonedCheckoutsStatsStrip"),
  ]);
  const count = (value: number) => new Intl.NumberFormat(locale).format(value);

  const items: AdminStatsStripItem[] = [
    {
      title: t("abandoned"),
      value: count(stats.total),
      description: t("vendorAbandonedDesc"),
      icon: <ShoppingCart className="h-5 w-5" />,
      iconClassName: "text-amber-700 bg-amber-100",
    },
    {
      title: t("open"),
      value: count(stats.open),
      description: t("vendorOpenDesc"),
      icon: <TimerReset className="h-5 w-5" />,
      iconClassName: "text-orange-700 bg-orange-100",
    },
    {
      title: t("recovered"),
      value: count(stats.recovered),
      description: t("vendorRecoveredDesc"),
      icon: <RotateCcw className="h-5 w-5" />,
      iconClassName: "text-green-700 bg-green-100",
    },
    {
      title: t("potentialRevenue"),
      value: formatMoney(stats.potentialRevenue),
      description: t("vendorPotentialRevenueDesc"),
      icon: <WalletCards className="h-5 w-5" />,
      iconClassName: "text-cyan-700 bg-cyan-100",
    },
  ];

  return (
    <div className="space-y-4">
      <AdminStatsStrip items={items} variant="tiles" />
      {stats.topProducts.length > 0 ? (
        <Card className="gap-0 rounded-2xl py-4 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              {t("mostOftenLeftBehind")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border text-sm">
              {stats.topProducts.map((product) => (
                <li
                  key={product.productId ?? product.name}
                  className="flex items-center justify-between gap-4 py-2"
                >
                  <span className="min-w-0 truncate font-medium">{product.name}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {t("checkoutCount", { count: product.checkouts })} ·{" "}
                    {formatMoney(product.value)}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
