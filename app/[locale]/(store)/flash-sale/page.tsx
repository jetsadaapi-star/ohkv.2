import type { Metadata } from "next";
import { BadgePercent, Package, Store, Zap } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import Link from "@/components/language/link";
import { buildStorefrontAlternates } from "@/lib/storefront/storefront-metadata";
import { publicFlashSales } from "@/lib/catalog/flash-sales";
import { getStorefrontProductCards } from "@/lib/products/storefront-product-cards";
import type { ModernProduct } from "@/lib/products/modern-product";
import {
  FlashCountdown,
  FlashCountdownLarge,
  FlashDealGrid,
} from "@/components/flash-sale/flash-sale-client";
import { FlashSlotTabs } from "@/components/flash-sale/flash-slot-tabs";
import { KHIT_TILE, SILK_GRADIENT } from "@/components/auth/silk-pattern";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "flashSale" });
  return {
    title: t("pageTitle"),
    description: t("pageSubtitle"),
    alternates: await buildStorefrontAlternates({ locale, page: "/flash-sale" }),
  };
}

const one = (value: string | string[] | undefined) => (typeof value === "string" ? value : undefined);

/**
 * Flash Sale: the rounds as tabs (on now first, then what starts this week),
 * the chosen round's countdown and numbers in the hero, the stores taking
 * part as chips, and its deals as a grid.
 */
export default async function FlashSalePage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const search = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "flashSale" });

  const sales = await publicFlashSales({ limit: 30 }).catch(() => []);
  const wanted = one(search.sale);
  const vendorSlug = one(search.vendor);
  const sale =
    sales.find((entry) => entry.id === wanted) ??
    // From a store's page: that store's round first.
    (vendorSlug ? sales.find((entry) => entry.vendor?.slug === vendorSlug) : undefined) ??
    sales.find((entry) => entry.live) ??
    sales[0];

  const cards: ModernProduct[] = sale?.items.length
    ? await getStorefrontProductCards({ ids: sale.items.map((item) => item.productId), limit: 100 }).catch(() => [])
    : [];

  // The stores in this round, by how many of its deals they have.
  const storeCounts = new Map<string, { name: string; slug: string; count: number }>();
  for (const card of cards) {
    const vendor = card.vendorId && typeof card.vendorId === "object" ? card.vendorId : null;
    if (!vendor?.slug) continue;
    const entry = storeCounts.get(vendor.slug) ?? { name: vendor.storeName, slug: vendor.slug, count: 0 };
    entry.count += 1;
    storeCounts.set(vendor.slug, entry);
  }
  const stores = [...storeCounts.values()].sort((a, b) => b.count - a.count);
  const activeStore = vendorSlug ? storeCounts.get(vendorSlug) : undefined;
  const shown = activeStore
    ? cards.filter((card) => typeof card.vendorId === "object" && card.vendorId?.slug === activeStore.slug)
    : cards;

  const shownIds = new Set(cards.map((card) => String(card._id)));
  const liveItems = sale?.items.filter((item) => shownIds.has(item.productId)) ?? [];
  const maxDiscount = liveItems.reduce((max, item) => Math.max(max, item.discountPercent), 0);

  const storeHref = (slug?: string) => {
    const query = new URLSearchParams();
    if (sale) query.set("sale", sale.id);
    if (slug) query.set("vendor", slug);
    const value = query.toString();
    return value ? `/flash-sale?${value}` : "/flash-sale";
  };

  return (
    <div className="container mx-auto space-y-6 px-4 py-6 lg:space-y-8 lg:py-10">
      {/* Hero */}
      <section
        className="relative isolate overflow-hidden rounded-[2rem] px-6 py-8 text-white shadow-2xl shadow-primary/25 sm:px-10 sm:py-10"
        style={{ background: SILK_GRADIENT }}
      >
        <span aria-hidden className="absolute inset-0 -z-10 opacity-[0.12]" style={{ backgroundImage: KHIT_TILE }} />
        <span aria-hidden className="absolute -end-20 -top-24 -z-10 size-80 rounded-full bg-[var(--highlight)]/35 blur-3xl" />
        <span aria-hidden className="absolute -bottom-28 start-1/3 -z-10 size-72 rounded-full bg-white/10 blur-3xl" />
        <Zap aria-hidden className="absolute -end-6 bottom-0 -z-10 size-56 rotate-12 fill-white/[0.06] text-white/[0.06] sm:size-72" />

        <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-[var(--highlight)] px-3 py-1 text-sm font-extrabold italic text-[#3b2410] shadow-md">
              <Zap className="size-4 fill-current" />
              FLASH SALE
            </p>
            <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-5xl">
              {sale?.name ?? t("pageTitle")}
            </h1>
            <p className="mt-2 max-w-2xl text-white/90 sm:text-lg">
              {activeStore ? t("storeSubtitle", { store: activeStore.name }) : t("pageSubtitle")}
            </p>
            {sale ? (
              <div className="mt-6 space-y-2">
                <p className="text-sm font-semibold text-white/85">{sale.live ? t("endsIn") : t("startsIn")}</p>
                <FlashCountdownLarge to={sale.live ? sale.endsAt : sale.startsAt} />
              </div>
            ) : null}
          </div>

          {sale ? (
            <dl className="grid grid-cols-3 gap-2 sm:gap-3 lg:w-[22rem]">
              {[
                { icon: Package, label: t("stats.deals"), value: liveItems.length.toLocaleString(locale) },
                { icon: BadgePercent, label: t("stats.upTo"), value: `${maxDiscount}%` },
                { icon: Store, label: t("stats.stores"), value: Math.max(stores.length, 1).toLocaleString(locale) },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="rounded-2xl bg-white/12 p-3 text-center ring-1 ring-white/20 backdrop-blur sm:p-4">
                  <Icon className="mx-auto size-5 text-[var(--highlight)]" />
                  <dd className="mt-1.5 text-2xl font-extrabold tabular-nums">{value}</dd>
                  <dt className="text-[11px] font-medium text-white/80">{label}</dt>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      </section>

      {sales.length === 0 || !sale ? (
        <div className="rounded-3xl border border-dashed bg-card p-12 text-center">
          <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--highlight)_20%,transparent)]">
            <Zap className="size-8 fill-[var(--highlight)] text-[var(--highlight)]" />
          </span>
          <p className="mt-4 text-lg font-bold">{t("none")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("noneHint")}</p>
          <Link
            href="/products"
            className="mt-6 inline-flex rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/20"
          >
            {t("browse")}
          </Link>
        </div>
      ) : (
        <>
          <FlashSlotTabs
            slots={sales.map((entry) => ({
              id: entry.id,
              name: entry.name,
              startsAt: entry.startsAt,
              endsAt: entry.endsAt,
              live: entry.live,
              vendorName: entry.vendor?.name,
            }))}
            activeId={sale.id}
            vendor={activeStore?.slug}
          />

          {stores.length > 1 ? (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-muted-foreground">{t("storesTakingPart")}</p>
              <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <Link
                  href={storeHref()}
                  scroll={false}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition",
                    !activeStore ? "border-transparent bg-foreground text-background" : "bg-card hover:bg-muted",
                  )}
                >
                  {t("allStores")}
                  <span className="text-xs tabular-nums opacity-70">{cards.length}</span>
                </Link>
                {stores.map((store) => (
                  <Link
                    key={store.slug}
                    href={storeHref(store.slug)}
                    scroll={false}
                    className={cn(
                      "inline-flex shrink-0 items-center gap-2 rounded-full border py-1.5 ps-1.5 pe-4 text-sm font-medium transition",
                      activeStore?.slug === store.slug
                        ? "border-transparent bg-foreground text-background"
                        : "bg-card hover:bg-muted",
                    )}
                  >
                    <span className="flex size-7 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--primary),var(--highlight))] text-xs font-extrabold text-white">
                      {store.name.trim().charAt(0).toUpperCase()}
                    </span>
                    <span className="max-w-[10rem] truncate">{store.name}</span>
                    <span className="text-xs tabular-nums opacity-70">{store.count}</span>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}

          <section className="space-y-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h2 className="inline-flex items-center gap-2 text-xl font-extrabold tracking-tight">
                {sale.live ? (
                  <span className="relative flex size-2.5">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--primary)] opacity-60" />
                    <span className="relative inline-flex size-2.5 rounded-full bg-[var(--primary)]" />
                  </span>
                ) : null}
                {sale.live ? t("onNowTitle") : t("upcomingTitle")}
              </h2>
              <span className="text-sm text-muted-foreground">{t("dealCount", { count: shown.length })}</span>
              {sale.vendor ? (
                <Link
                  href={`/vendors/${sale.vendor.slug}`}
                  className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground transition hover:text-foreground"
                >
                  <Store className="size-3.5" />
                  {t("byStore", { store: sale.vendor.name })}
                </Link>
              ) : null}
              <span className="ms-auto inline-flex items-center gap-2 text-sm text-muted-foreground">
                {sale.live ? t("endsIn") : t("startsIn")}
                <FlashCountdown to={sale.live ? sale.endsAt : sale.startsAt} boxClassName="bg-[var(--primary)]" />
              </span>
            </div>

            {shown.length > 0 ? (
              <FlashDealGrid products={shown} items={sale.items} upcoming={!sale.live} startsAt={sale.startsAt} />
            ) : (
              <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">{t("noDealsHere")}</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
