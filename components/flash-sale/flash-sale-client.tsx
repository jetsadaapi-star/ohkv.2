"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronRight, Zap } from "lucide-react";
import Link from "@/components/language/link";
import { cn } from "@/lib/utils";

export interface PublicFlashSaleItem {
  productId: string;
  discountPercent: number;
  quantityLimit: number | null;
  soldCount: number;
  soldOut: boolean;
}

export interface PublicFlashSaleData {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  live: boolean;
  items: PublicFlashSaleItem[];
}

/** One read of /api/flash-sales per page view, shared by every banner on it. */
let salesRequest: Promise<PublicFlashSaleData[]> | null = null;
function loadSales() {
  salesRequest ??= fetch("/api/flash-sales")
    .then((response) => response.json())
    .then((body) => (body?.success ? (body.data.sales as PublicFlashSaleData[]) : []))
    .catch(() => []);
  return salesRequest;
}

function useFlashSales() {
  const [sales, setSales] = useState<PublicFlashSaleData[] | null>(null);
  useEffect(() => {
    let alive = true;
    void loadSales().then((value) => {
      if (alive) setSales(value);
    });
    return () => {
      alive = false;
    };
  }, []);
  return sales;
}

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
  const pad = (n: number) => String(n).padStart(2, "0");
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

/** Sold units against the cap, as a bar. */
export function FlashSoldBar({ item, className }: { item: PublicFlashSaleItem; className?: string }) {
  const t = useTranslations("flashSale");
  if (!item.quantityLimit) return null;
  const ratio = Math.min(1, item.soldCount / item.quantityLimit);
  return (
    <div className={cn("space-y-1", className)}>
      <div className="relative h-4 overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--highlight)_25%,transparent)]">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,var(--highlight),var(--primary))]"
          style={{ width: `${Math.max(6, ratio * 100)}%` }}
        />
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white drop-shadow">
          {item.soldOut ? t("soldOut") : t("sold", { sold: item.soldCount, limit: item.quantityLimit })}
        </span>
      </div>
    </div>
  );
}

/**
 * On a product page: the sale this product is in, its discount, the
 * countdown to its end and how many of the cap are gone. Nothing when the
 * product is in no running sale.
 */
export function FlashSaleProductBanner({ productId }: { productId: string }) {
  const t = useTranslations("flashSale");
  const sales = useFlashSales();
  const sale = sales?.find((entry) => entry.items.some((item) => item.productId === productId));
  const item = sale?.items.find((entry) => entry.productId === productId);
  if (!sale || !item || (item.soldOut && sale.live)) return null;

  return (
    <div className="relative isolate mb-3 overflow-hidden rounded-2xl bg-[linear-gradient(110deg,var(--primary),color-mix(in_oklab,var(--primary)_60%,var(--highlight)))] p-3 text-white shadow-md shadow-primary/20">
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
      {sale.live ? <FlashSoldBar item={item} className="mt-2.5" /> : null}
    </div>
  );
}

/** A slim strip at the top of the home page while a sale runs. */
export function FlashSaleStrip() {
  const t = useTranslations("flashSale");
  const sales = useFlashSales();
  const live = sales?.find((sale) => sale.live);
  const next = live ? undefined : sales?.find((sale) => !sale.live);
  const sale = live ?? next;
  if (!sale) return null;
  return (
    <div className="container mx-auto px-4 pt-4">
      <Link
        href="/flash-sale"
        className="group relative isolate flex flex-wrap items-center gap-x-4 gap-y-2 overflow-hidden rounded-2xl bg-[linear-gradient(110deg,var(--primary),color-mix(in_oklab,var(--primary)_55%,var(--highlight)))] px-4 py-3 text-white shadow-lg shadow-primary/20 sm:px-6"
      >
        <span aria-hidden className="absolute -end-10 -top-10 -z-10 size-40 rounded-full bg-[var(--highlight)]/30 blur-2xl" />
        <span className="inline-flex items-center gap-1.5 text-lg font-extrabold italic tracking-tight">
          <Zap className="size-5 fill-[var(--highlight)] text-[var(--highlight)]" />
          FLASH SALE
        </span>
        <span className="text-sm font-medium text-white/90">{sale.name}</span>
        <span className="ms-auto inline-flex items-center gap-2 text-xs font-semibold">
          {live ? t("endsIn") : t("startsIn")}
          <FlashCountdown to={live ? sale.endsAt : sale.startsAt} />
          <ChevronRight className="size-4 transition group-hover:translate-x-0.5 rtl:rotate-180" />
        </span>
      </Link>
    </div>
  );
}
