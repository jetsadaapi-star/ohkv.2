"use client";

import { ORDER_STATUS_CLASSES } from "@/lib/theme-colors/status";

import Link from "@/components/language/link";
import { useTranslations } from "next-intl";
import {
  Package,
  ShoppingBag,
  ChevronRight,
  Crown,
  Heart,
  LayoutGrid,
  Truck,
  DollarSign,
  Bell,
  LogOut,
  MapPin,
  MessageSquare,
  Settings2,
  Shield,
  User,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { signOutAndReload } from "@/lib/auth/auth-client";
import { useCurrency } from "@/providers/currency-provider";
import { useFallbackTranslator } from "@/hooks/use-fallback-translator";
import { formatCurrency } from "@/lib/intl/money";
import { resolveCurrency } from "@/lib/intl/currencies";
import { cn } from "@/lib/utils";
import { SILK_GRADIENT, SilkBackdrop } from "@/components/auth/silk-pattern";
import { AccountEmpty, AccountSection, AccountStat, type AccountTone } from "./account-ui";
import { useAccountPrefetch } from "./use-account-prefetch";
import type { LoyaltyTier } from "@/types";
import { useLoyaltyEnabled } from "@/providers/app-settings-provider";
import type { PendingReview } from "@/lib/catalog/review-eligibility";
import {
  EMPTY_ATTENTION,
  type OverviewAttention,
  type OverviewOrder,
} from "@/lib/customers/overview-attention";
import {
  AttentionCard,
  ProductThumb,
  orderStatusLabel,
  productTitle,
} from "./overview-attention";

interface CustomerDashboardProps {
  locale: string;
  user: {
    name: string;
    email: string;
    image?: string;
  };
  stats: {
    totalOrders: number;
    wishlistCount: number;
    totalSpent?: number;
    loyaltyPoints?: number;
    loyaltyTier?: LoyaltyTier;
    memberSince?: string;
    notificationsCount?: number;
    inboxUnreadCount?: number;
  };
  /** The shopper's store credit, one entry per currency they hold. */
  storeCredit?: Array<{ currency: string; balance: number }>;
  /** What waits on the shopper; see `lib/customers/overview-attention.ts`. */
  attention?: OverviewAttention;
  /** The latest orders the attention card is not already showing. */
  recentOrders: OverviewOrder[];
  /** Delivered products still waiting for the shopper's review. */
  pendingReviews?: PendingReview[];
}


/** What a stat card is made of; a card with an href is the shortcut to its page. */
interface StatCard {
  key: string;
  icon: LucideIcon;
  value: string;
  label: string;
  href?: string;
}


export function CustomerDashboard({
  locale,
  user,
  stats,
  storeCredit = [],
  attention = EMPTY_ATTENTION,
  recentOrders,
  pendingReviews = [],
}: CustomerDashboardProps) {
  const loyaltyEnabled = useLoyaltyEnabled();
  const warm = useAccountPrefetch();
  const t = useTranslations();
  const tf = useFallbackTranslator(t);
  const { currency, formatPrice } = useCurrency();
  const plusMore = (count: number) =>
    tf("account.overview.plusMore", "+{count} more", { count });

  const firstName =
    user.name?.trim().split(/\s+/)[0] || user.email.split("@")[0] || "";

  // The orders the attention card already carries must not read as "no
  // orders" when it is all that is left of the list below it.
  const hasAttentionOrder = Boolean(
    attention.addressHold || attention.payment || attention.inFlight,
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const handleLogout = async () => {
    await signOutAndReload(locale);
  };

  // Credit is held per currency and never converted. The store's own currency
  // leads; credit left in another one still shows rather than reading as none.
  const storeCurrency = String(currency?.code ?? "").toUpperCase();
  const heldCredit =
    storeCredit.find(
      (entry) =>
        entry.balance > 0 && entry.currency.toUpperCase() === storeCurrency,
    ) ?? storeCredit.find((entry) => entry.balance > 0);
  const creditValue = heldCredit
    ? heldCredit.currency.toUpperCase() === storeCurrency
      ? formatPrice(heldCredit.balance)
      : formatCurrency(
          heldCredit.balance,
          heldCredit.currency,
          resolveCurrency(heldCredit.currency).locale,
        )
    : formatPrice(0);

  // On phones this page is the account's whole map (the pill row is gone), so
  // each destination gets exactly one home: the stat cards carry Orders,
  // Wishlist and Store credit, and everything else lands in these two groups.
  // "Activity" is the pair a shopper checks (with their unread counts);
  // "Settings" is configuration only — no more Profile living in two lists at
  // once.
  const activityLinks = [
    {
      href: "/account/inbox",
      icon: MessageSquare,
      // Same fallback as the sidebar: `account.inbox` is a namespace object,
      // so only the .title leaf is safe to translate.
      label: t.has("account.inbox.title") ? t("account.inbox.title") : "Inbox",
      count: stats.inboxUnreadCount ?? 0,
    },
    {
      href: "/account/notifications",
      icon: Bell,
      label: t("common.notifications"),
      count: stats.notificationsCount ?? 0,
    },
  ];
  const settingsMenuLinks = [
    { href: "/account/profile", icon: User, label: t("account.profile") },
    {
      href: "/account/addresses",
      icon: MapPin,
      label: t("account.addresses"),
    },
    { href: "/account/security", icon: Shield, label: t("account.security") },
    {
      href: "/account/preferences",
      icon: Settings2,
      label: t("customerProfile.preferences"),
    },
  ];

  // A card without an href (Total Spent) is a plain read-out — every other
  // number doubles as the shortcut to its page, which is why Orders, Wishlist
  // and Store credit need no row in the menus below. The count of orders still
  // on their way is not a card any more: the order itself is in the attention
  // card above.
  const statCards: StatCard[] = [
    {
      key: "orders",
      icon: ShoppingBag,
      value: String(stats.totalOrders),
      label: t("account.totalOrders"),
      href: "/account/orders",
    },
    {
      key: "spent",
      icon: DollarSign,
      value: formatPrice(stats.totalSpent ?? 0),
      label: t("customerProfile.totalSpent"),
    },
    {
      key: "wishlist",
      icon: Heart,
      value: String(stats.wishlistCount),
      label: t("account.wishlistItems"),
      href: "/account/wishlist",
    },
    {
      key: "credit",
      icon: Wallet,
      value: creditValue,
      label: tf("account.storeCredit", "Store credit"),
      href: "/account/store-credit",
    },
  ];

  const initials =
    (user.name || user.email)
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join("")
      .toUpperCase() || "?";
  const memberSince = stats.memberSince
    ? new Date(stats.memberSince).toLocaleDateString(locale, { year: "numeric", month: "long" })
    : null;
  const statTones: Record<string, AccountTone> = {
    orders: "silk",
    spent: "gold",
    wishlist: "madder",
    credit: "jade",
  };
  const shortcutLinks = [...activityLinks, ...settingsMenuLinks.map((link) => ({ ...link, count: 0 }))];

  return (
    // A column rather than the full width: on a wide screen a list row
    // stretched edge to edge leaves its name and its price far apart.
    <div className="mx-auto w-full max-w-6xl space-y-6">
      {/* The welcome, on the store's silk: who is signed in, since when, and
          their tier — at every width, since it is the page's whole title. */}
      <section
        className="relative isolate overflow-hidden rounded-3xl p-5 text-white shadow-lg shadow-primary/20 sm:p-7"
        style={{ background: SILK_GRADIENT }}
      >
        <SilkBackdrop lotusClassName="-bottom-24 -right-20 size-80 opacity-30" />
        <div className="flex flex-wrap items-center gap-4">
          <span className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/15 text-xl font-bold ring-2 ring-[var(--highlight)]/70 sm:size-16">
            {user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.image} alt="" className="size-full object-cover" />
            ) : (
              initials
            )}
          </span>
          <div className="min-w-0 flex-1 basis-52">
            <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">
              {t("account.welcome", { name: firstName })}
            </h1>
            <p className="mt-0.5 text-sm text-white/80">
              {memberSince
                ? `${t("customerProfile.memberSince")} ${memberSince}`
                : t("account.overviewDesc")}
            </p>
          </div>
          {/* Hidden with the rest of loyalty (see `useLoyaltyEnabled`). */}
          {loyaltyEnabled && stats.loyaltyTier ? (
            <Link
              href="/account/rewards"
              className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3.5 py-1.5 text-sm font-semibold ring-1 ring-inset ring-white/25 backdrop-blur transition hover:bg-white/25"
            >
              <Crown className="size-4 text-[var(--highlight)]" />
              {t(`customerProfile.${stats.loyaltyTier}`)}
              {typeof stats.loyaltyPoints === "number" ? (
                <span className="rounded-full bg-[var(--highlight)] px-2 text-xs font-bold text-[#3b2410]">
                  {stats.loyaltyPoints.toLocaleString(locale)} {t("customerProfile.loyaltyPoints")}
                </span>
              ) : null}
            </Link>
          ) : null}
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href="/account/orders"
            className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-primary shadow-sm transition hover:bg-white/90"
          >
            <Truck className="size-4" />
            {tf("account.hub.trackOrders", "Track my orders")}
          </Link>
          <Link
            href="/products"
            className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold ring-1 ring-inset ring-white/30 transition hover:bg-white/20"
          >
            <ShoppingBag className="size-4" />
            {t("account.startShopping")}
          </Link>
        </div>
      </section>

      {/* Only what waits on the shopper — and not on the page at all when
          nothing does. "Where is my order" is the most common reason this page
          is opened, so the order on its way is in it at every width. */}
      <AttentionCard locale={locale} attention={attention} pendingReviews={pendingReviews} />

      {/* Every figure but the total spent is the shortcut to its page. */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 xl:gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          const tile = (
            <AccountStat
              tone={statTones[card.key]}
              icon={<Icon aria-hidden />}
              value={card.value}
              label={card.label}
              className="h-full"
            />
          );
          return card.href ? (
            <Link
              key={card.key}
              href={card.href}
              onPointerEnter={() => warm(card.href!)}
              onTouchStart={() => warm(card.href!)}
              className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
              {tile}
            </Link>
          ) : (
            <div key={card.key}>{tile}</div>
          );
        })}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* Recent Orders. Not asked about twice: an order the attention card
            shows is left out, so a shopper whose only order is in it has no
            list here — which is not the same as having no orders. */}
        {recentOrders.length > 0 || !hasAttentionOrder ? (
          <AccountSection
            icon={<Package />}
            title={t("account.recentOrders")}
            action={
              <Button variant="ghost" size="sm" className="-me-2 text-primary" asChild>
                <Link href="/account/orders">
                  {t("common.viewAll")}
                  <ChevronRight className="ms-0.5 size-4 rtl:rotate-180" />
                </Link>
              </Button>
            }
            bodyClassName="px-0 py-0 sm:px-0"
          >
            {recentOrders.length === 0 ? (
              <div className="px-5 pb-6 sm:px-6">
                <AccountEmpty
                  icon={<Package />}
                  title={t("account.noOrders")}
                  action={
                    <Button asChild className="rounded-xl">
                      <Link href="/products">{t("account.startShopping")}</Link>
                    </Button>
                  }
                />
              </div>
            ) : (
              <ul className="divide-y border-t">
                {recentOrders.map((order) => (
                  <li key={order._id}>
                    <Link
                      href={`/account/orders/${order._id}`}
                      className="group flex min-h-[76px] items-center gap-3 px-5 py-3 transition-colors hover:bg-primary/[0.03] sm:gap-4 sm:px-6"
                    >
                      <ProductThumb product={order.product} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold leading-5">
                          {productTitle(order.product, order.orderNumber, order.moreItems, plusMore)}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          #{order.orderNumber} · {formatDate(order.createdAt)}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="whitespace-nowrap text-sm font-bold tabular-nums">
                          {formatPrice(order.totalAmount)}
                        </span>
                        {order.status === "delivered" ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span className="size-1.5 rounded-full bg-status-on-positive" aria-hidden />
                            {orderStatusLabel(t, order.status)}
                          </span>
                        ) : (
                          <Badge variant="secondary" className={cn("rounded-full", ORDER_STATUS_CLASSES[order.status])}>
                            {orderStatusLabel(t, order.status)}
                          </Badge>
                        )}
                      </div>
                      <ChevronRight className="hidden size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 sm:block rtl:rotate-180" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </AccountSection>
        ) : (
          <div className="hidden lg:block" />
        )}

        {/* Shortcuts: the rest of the account in one card. On phones it is
            the account's whole map, so it ends with signing out. */}
        <AccountSection
          icon={<LayoutGrid />}
          tone="gold"
          title={tf("account.hub.shortcuts", "Shortcuts")}
          bodyClassName="pt-3"
          className="h-fit"
        >
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
            {shortcutLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onPointerEnter={() => warm(link.href)}
                  onTouchStart={() => warm(link.href)}
                  className="group flex min-h-12 items-center gap-2.5 rounded-xl border bg-background/60 px-3 py-2.5 text-sm font-medium transition hover:border-primary/30 hover:bg-primary/[0.04]"
                >
                  <Icon className="size-4 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1 truncate">{link.label}</span>
                  {link.count > 0 ? (
                    <span className="rounded-full bg-primary px-1.5 text-[11px] font-bold tabular-nums text-primary-foreground">
                      {link.count > 99 ? "99+" : link.count}
                    </span>
                  ) : (
                    <ChevronRight className="size-3.5 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 rtl:rotate-180" />
                  )}
                </Link>
              );
            })}
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-destructive/20 text-sm font-semibold text-destructive transition hover:bg-destructive/5 lg:hidden"
          >
            <LogOut className="size-4" />
            {t("auth.signOut")}
          </button>
        </AccountSection>
      </div>
    </div>
  );
}
