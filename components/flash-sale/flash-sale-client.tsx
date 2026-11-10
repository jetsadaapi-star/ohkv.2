"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, Flame, Store, Zap } from "lucide-react";
import Link from "@/components/language/link";
import { AppImage } from "@/components/ui/app-image";
import { KHIT_TILE, SILK_GRADIENT } from "@/components/auth/silk-pattern";
import type { ModernProduct } from "@/lib/products/modern-product";
import { useCurrency } from "@/providers/currency-provider";
import { cn } from "@/lib/utils";

export interface PublicFlashSaleItem {
  productId: string;
  discountPercent: number;
  quantityLimit: number | null;
  soldCount: number;
  soldOut: boolean;
}

export interface PublicFlashSaleVendor {
  id: string;
  name: string;
  slug: string;
  logo?: string;
}

export interface PublicFlashSaleData {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  live: boolean;
  vendor: PublicFlashSaleVendor | null;
  items: PublicFlashSaleItem[];
}

/* ------------------------------------------------------------------ */
/* Reads                                                               */
/* ------------------------------------------------------------------ */

/** One read per URL per page view, shared by every component asking. */
const requests = new Map<string, Promise<unknown>>();
function loadOnce<T>(url: string, fallback: T): Promise<T> {
  let request = requests.get(url) as Promise<T> | undefined;
  if (!request) {
    request = fetch(url)
      .then((response) => response.json())
      .then((body) => (body?.success ? (body.data as T) : fallback))
      .catch(() => fallback);
    requests.set(url, request);
  }
  return request;
}

function useLoad<T>(url: string | null, fallback: T) {
  const [value, setValue] = useState<T | null>(null);
  useEffect(() => {
    if (!url) return;
    let alive = true;
    void loadOnce(url, fallback).then((data) => {
      if (alive) setValue(data);
    });
    return () => {
      alive = false;
    };
    // `fallback` is a constant at every call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);
  return value;
}

/* ------------------------------------------------------------------ */
/* Countdowns                                                          */
/* ------------------------------------------------------------------ */

/** The current time, ticking each second, for countdowns (null before mount). */
function useNow() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);
  return now;
}

function parts(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(total / 86_400),
    hours: Math.floor((total % 86_400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** HH:MM:SS boxes counting down to `to`; days shown when there are any. */
export function FlashCountdown({
  to,
  className,
  boxClassName,
}: {
  to: string;
  className?: string;
  boxClassName?: string;
}) {
  const t = useTranslations("flashSale");
  const now = useNow();
  const left = parts(now === null ? 0 : new Date(to).getTime() - now);
  const box = (value: string) => (
    <span
      className={cn(
        "inline-flex min-w-[2.1em] justify-center rounded-md bg-black/80 px-1.5 py-0.5 font-mono font-bold tabular-nums text-white",
        boxClassName,
      )}
    >
      {now === null ? "--" : value}
    </span>
  );
  return (
    <span className={cn("inline-flex items-center gap-1", className)} role="timer" aria-live="off">
      {left.days > 0 ? (
        <>
          {box(String(left.days))}
          <span className="text-xs">{t("days")}</span>
        </>
      ) : null}
      {box(pad(left.hours))}:{box(pad(left.minutes))}:{box(pad(left.seconds))}
    </span>
  );
}

/** The hero's countdown: large glass tiles, each with its unit beneath. */
export function FlashCountdownLarge({ to, className }: { to: string; className?: string }) {
  const t = useTranslations("flashSale");
  const now = useNow();
  const left = parts(now === null ? 0 : new Date(to).getTime() - now);
  const tiles = [
    ...(left.days > 0 ? [{ value: String(left.days), unit: t("unit.days") }] : []),
    { value: pad(left.hours), unit: t("unit.hours") },
    { value: pad(left.minutes), unit: t("unit.minutes") },
    { value: pad(left.seconds), unit: t("unit.seconds") },
  ];
  return (
    <div className={cn("flex items-start gap-2 sm:gap-3", className)} role="timer" aria-live="off">
      {tiles.map((tile, index) => (
        <div key={tile.unit} className="flex items-start gap-2 sm:gap-3">
          {index > 0 ? <span className="pt-2 text-2xl font-extrabold text-white/60 sm:pt-3 sm:text-3xl">:</span> : null}
          <div className="flex flex-col items-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-white/15 font-mono text-2xl font-extrabold tabular-nums text-white shadow-inner ring-1 ring-white/25 backdrop-blur sm:size-16 sm:text-3xl">
              {now === null ? "--" : tile.value}
            </span>
            <span className="mt-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/80">{tile.unit}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Units sold                                                          */
/* ------------------------------------------------------------------ */

/** Sold units against the cap, as a bar; without a cap, the count sold. */
export function FlashSoldBar({ item, className }: { item: PublicFlashSaleItem; className?: string }) {
  const t = useTranslations("flashSale");
  if (!item.quantityLimit) {
    if (item.soldCount <= 0) return null;
    return (
      <p className={cn("inline-flex items-center gap-1 text-xs font-semibold text-[var(--primary)]", className)}>
        <Flame className="size-3.5 fill-current" />
        {t("soldCount", { count: item.soldCount })}
      </p>
    );
  }
  const ratio = Math.min(1, item.soldCount / item.quantityLimit);
  const remaining = Math.max(0, item.quantityLimit - item.soldCount);
  const gone = item.soldOut || remaining === 0;
  const hot = !gone && ratio >= 0.7;
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between gap-2 text-[11px] font-semibold">
        <span className={cn("inline-flex items-center gap-1", hot || gone ? "text-[var(--primary)]" : "text-muted-foreground")}>
          {hot ? <Flame className="size-3 fill-current" /> : null}
          {gone ? t("soldOut") : hot ? t("almostGone", { count: remaining }) : t("sold", { sold: item.soldCount, limit: item.quantityLimit })}
        </span>
        {!gone && !hot ? <span className="tabular-nums text-muted-foreground">{Math.round(ratio * 100)}%</span> : null}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--highlight)_22%,var(--muted))]">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,var(--highlight),var(--primary))] transition-[width] duration-700"
          style={{ width: `${gone ? 100 : Math.max(4, ratio * 100)}%` }}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The deal card                                                       */
/* ------------------------------------------------------------------ */

const round2 = (n: number) => Math.round(n * 100) / 100;

const noop = () => () => {};
/** False on the server and the hydrating render, true after: for times shown in the shopper's zone. */
function useMounted() {
  return useSyncExternalStore(noop, () => true, () => false);
}

/**
 * One product in a sale: picture, the discount ribbon, the Flash price over
 * the regular one, the units bar and the store. Before the sale starts the
 * product still carries its regular price, so the Flash price is worked out
 * from the discount and shown as a teaser.
 */
export function FlashDealCard({
  product,
  item,
  upcoming,
  startsAt,
  className,
}: {
  product: ModernProduct;
  item: PublicFlashSaleItem;
  upcoming?: boolean;
  startsAt?: string;
  className?: string;
}) {
  const t = useTranslations("flashSale");
  const locale = useLocale();
  const mounted = useMounted();
  const { formatPrice } = useCurrency();
  const price = Number(product.price) || 0;
  const regular = upcoming ? price : Math.max(price, Number(product.comparePrice) || 0);
  const flashPrice = upcoming ? round2(price * (1 - item.discountPercent / 100)) : price;
  const soldOut = !upcoming && item.soldOut;
  const image = product.images?.[0];
  const vendor = product.vendorId && typeof product.vendorId === "object" ? product.vendorId : null;

  return (
    <Link
      href={`/products/${product.slug}`}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition duration-300 hover:-translate-y-1 hover:border-[color-mix(in_oklab,var(--primary)_35%,transparent)] hover:shadow-xl hover:shadow-primary/10",
        className,
      )}
    >
      <div className="relative aspect-square overflow-hidden bg-muted">
        {image ? (
          <AppImage
            src={image}
            alt={product.name}
            fill
            sizes="(min-width: 1280px) 18vw, (min-width: 768px) 30vw, 48vw"
            className={cn("object-cover transition duration-500 group-hover:scale-105", soldOut && "grayscale")}
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center">
            <Zap className="size-10 text-muted-foreground/40" />
          </span>
        )}

        {/* The ribbon: lightning and the discount. */}
        <span className="absolute start-0 top-3 z-10 inline-flex items-center gap-1 rounded-e-full bg-[linear-gradient(100deg,var(--primary),color-mix(in_oklab,var(--primary)_60%,var(--highlight)))] py-1 ps-2 pe-3 text-sm font-extrabold text-white shadow-md">
          <Zap className="size-3.5 fill-[var(--highlight)] text-[var(--highlight)]" />-{item.discountPercent}%
        </span>

        {upcoming && startsAt && mounted ? (
          <span className="absolute inset-x-2 bottom-2 z-10 rounded-full bg-black/65 px-2 py-1 text-center text-[11px] font-semibold text-white backdrop-blur">
            {t("startsAtShort", {
              time: new Date(startsAt).toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
            })}
          </span>
        ) : null}

        {soldOut ? (
          <span className="absolute inset-0 z-10 flex items-center justify-center bg-black/45">
            <span className="rotate-[-8deg] rounded-xl border-2 border-white px-4 py-1.5 text-lg font-extrabold uppercase tracking-wide text-white">
              {t("soldOut")}
            </span>
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <p className="line-clamp-2 min-h-[2.5rem] text-sm font-medium leading-5 text-foreground">{product.name}</p>
        <div className="mt-auto">
          {upcoming ? (
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("flashPrice")}</p>
          ) : null}
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-lg font-extrabold tracking-tight text-[var(--primary)]">{formatPrice(flashPrice)}</span>
            {regular > flashPrice ? (
              <span className="text-xs text-muted-foreground line-through">{formatPrice(regular)}</span>
            ) : null}
          </div>
        </div>
        {!upcoming ? <FlashSoldBar item={item} /> : null}
        {vendor?.storeName ? (
          <p className="inline-flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground">
            <Store className="size-3 shrink-0" />
            <span className="truncate">{vendor.storeName}</span>
          </p>
        ) : null}
      </div>
    </Link>
  );
}

/** A sale's products as deal cards. */
export function FlashDealGrid({
  products,
  items,
  upcoming,
  startsAt,
}: {
  products: ModernProduct[];
  items: PublicFlashSaleItem[];
  upcoming?: boolean;
  startsAt?: string;
}) {
  const byId = new Map(items.map((item) => [item.productId, item]));
  // Sold-out deals sink to the end: what can still be bought comes first.
  const rows = products
    .map((product) => ({ product, item: byId.get(String(product._id)) }))
    .filter((row): row is { product: ModernProduct; item: PublicFlashSaleItem } => Boolean(row.item))
    .sort((a, b) => Number(a.item.soldOut) - Number(b.item.soldOut));
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {rows.map(({ product, item }) => (
        <FlashDealCard key={String(product._id)} product={product} item={item} upcoming={upcoming} startsAt={startsAt} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The rail: home page and a store's page                              */
/* ------------------------------------------------------------------ */

/**
 * A sale in a band: the silk header with its countdown and a way to the full
 * list, then its deals in a row that scrolls sideways.
 */
export function FlashShowcase({
  sale,
  products,
  href,
  title,
  className,
}: {
  sale: PublicFlashSaleData;
  products: ModernProduct[];
  href: string;
  /** Shown beside the FLASH SALE mark; the sale's name by default. */
  title?: string;
  className?: string;
}) {
  const t = useTranslations("flashSale");
  const rail = useRef<HTMLDivElement>(null);
  const byId = new Map(sale.items.map((item) => [item.productId, item]));
  const rows = products
    .map((product) => ({ product, item: byId.get(String(product._id)) }))
    .filter((row): row is { product: ModernProduct; item: PublicFlashSaleItem } => Boolean(row.item))
    .sort((a, b) => Number(a.item.soldOut) - Number(b.item.soldOut));
  if (rows.length === 0) return null;

  const scroll = (direction: 1 | -1) => {
    const node = rail.current;
    if (!node) return;
    const rtl = getComputedStyle(node).direction === "rtl";
    node.scrollBy({ left: direction * (rtl ? -1 : 1) * node.clientWidth * 0.85, behavior: "smooth" });
  };

  return (
    <section
      className={cn(
        "overflow-hidden rounded-3xl border bg-card shadow-lg shadow-primary/5",
        className,
      )}
      aria-label={t("pageTitle")}
    >
      <div className="relative isolate flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 text-white sm:px-6" style={{ background: SILK_GRADIENT }}>
        <span aria-hidden className="absolute inset-0 -z-10 opacity-[0.1]" style={{ backgroundImage: KHIT_TILE }} />
        <span aria-hidden className="absolute -end-10 -top-12 -z-10 size-44 rounded-full bg-[var(--highlight)]/35 blur-3xl" />
        <span className="inline-flex items-center gap-1.5 text-xl font-extrabold italic tracking-tight">
          <Zap className="size-6 animate-pulse fill-[var(--highlight)] text-[var(--highlight)]" />
          FLASH SALE
        </span>
        <span className="min-w-0 max-w-full truncate text-sm font-medium text-white/90">{title ?? sale.name}</span>
        <span className="inline-flex items-center gap-2 text-xs font-semibold">
          {sale.live ? t("endsIn") : t("startsIn")}
          <FlashCountdown to={sale.live ? sale.endsAt : sale.startsAt} boxClassName="bg-white text-[var(--primary)]" />
        </span>
        <Link
          href={href}
          className="ms-auto inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold ring-1 ring-white/30 transition hover:bg-white/25"
        >
          {t("viewAll")}
          <ChevronRight className="size-4 rtl:rotate-180" />
        </Link>
      </div>

      <div className="relative">
        <div
          ref={rail}
          className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth p-4 [scrollbar-width:none] sm:gap-4 sm:p-5 [&::-webkit-scrollbar]:hidden"
        >
          {rows.map(({ product, item }) => (
            <FlashDealCard
              key={String(product._id)}
              product={product}
              item={item}
              upcoming={!sale.live}
              startsAt={sale.startsAt}
              className="w-[46%] shrink-0 snap-start sm:w-[31%] md:w-[23.5%] lg:w-[18.5%]"
            />
          ))}
        </div>
        {rows.length > 4 ? (
          <>
            <button
              type="button"
              aria-label={t("previous")}
              onClick={() => scroll(-1)}
              className="absolute start-1 top-1/2 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full border bg-background/90 shadow-md backdrop-blur transition hover:bg-background md:flex"
            >
              <ChevronLeft className="size-5 rtl:rotate-180" />
            </button>
            <button
              type="button"
              aria-label={t("next")}
              onClick={() => scroll(1)}
              className="absolute end-1 top-1/2 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full border bg-background/90 shadow-md backdrop-blur transition hover:bg-background md:flex"
            >
              <ChevronRight className="size-5 rtl:rotate-180" />
            </button>
          </>
        ) : null}
      </div>
    </section>
  );
}

/** The home page's band: the sale on now (or the next), read in the browser. */
export function FlashSaleHomeRail() {
  const data = useLoad<{ sale: PublicFlashSaleData | null; products: ModernProduct[] }>("/api/flash-sales?rail=1", {
    sale: null,
    products: [],
  });
  if (!data?.sale || data.products.length === 0) return null;
  return (
    <div className="container mx-auto px-4 pt-4 sm:pt-6">
      <FlashShowcase sale={data.sale} products={data.products} href={`/flash-sale?sale=${data.sale.id}`} />
    </div>
  );
}

/** @deprecated The home page shows the rail now; kept for any older import. */
export const FlashSaleStrip = FlashSaleHomeRail;

/* ------------------------------------------------------------------ */
/* Product page                                                        */
/* ------------------------------------------------------------------ */

/**
 * On a product page: the sale this product is in, its discount, the
 * countdown to its end and how many of the cap are gone. Nothing when the
 * product is in no running sale.
 */
export function FlashSaleProductBanner({ productId }: { productId: string }) {
  const t = useTranslations("flashSale");
  const data = useLoad<{ sales: PublicFlashSaleData[] }>(
    productId ? `/api/flash-sales?product=${encodeURIComponent(productId)}` : null,
    { sales: [] },
  );
  const sale = data?.sales.find((entry) => entry.items.some((item) => item.productId === productId));
  const item = sale?.items.find((entry) => entry.productId === productId);
  if (!sale || !item || (item.soldOut && sale.live)) return null;

  return (
    <Link
      href={`/flash-sale?sale=${sale.id}`}
      className="relative isolate mb-3 block overflow-hidden rounded-2xl bg-[linear-gradient(110deg,var(--primary),color-mix(in_oklab,var(--primary)_60%,var(--highlight)))] p-3 text-white shadow-md shadow-primary/20"
    >
      <span aria-hidden className="absolute -end-8 -top-10 -z-10 size-32 rounded-full bg-[var(--highlight)]/30 blur-2xl" />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--highlight)] px-2.5 py-0.5 text-xs font-extrabold text-[#3b2410]">
          <Zap className="size-3.5 fill-current" />
          FLASH SALE
        </span>
        <span className="text-sm font-bold">
          {sale.live ? t("off", { percent: item.discountPercent }) : t("comingOff", { percent: item.discountPercent })}
        </span>
        <span className="ms-auto inline-flex items-center gap-2 text-xs">
          {sale.live ? t("endsIn") : t("startsIn")}
          <FlashCountdown to={sale.live ? sale.endsAt : sale.startsAt} />
        </span>
      </div>
      {sale.live ? <FlashSoldBar item={item} className="mt-2.5 [&_span]:!text-white" /> : null}
    </Link>
  );
}
