"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Heart, Loader2, Package, Pin, ShoppingBag } from "lucide-react";
import Link from "@/components/language/link";
import { toast } from "@/components/ui/toast-notification";
import { useCartActions } from "@/hooks/use-cart";
import { useEmbeddedCheckout } from "@/components/checkout/embedded-checkout";
import { refusalMessage } from "@/lib/api/client";
import { useCurrency } from "@/providers/currency-provider";
import type { LiveChatItem, LiveShopProduct, LiveStatus } from "@/lib/live/live-types";
import { cn } from "@/lib/utils";

/** System lines are stored as codes so each viewer reads them in their language. */
export function useChatText() {
  const t = useTranslations("live");
  return (message: LiveChatItem) => {
    if (message.kind !== "system") return message.text;
    if (message.text === "live_started") return t("sysStarted");
    if (message.text === "live_ended") return t("sysEnded");
    if (message.text.startsWith("pinned:")) return t("sysPinned", { name: message.text.slice(7) });
    return message.text;
  };
}

/** The chat as a stack of bubbles, newest at the bottom, scrolled into view. */
export function LiveChatList({
  messages,
  variant,
  className,
}: {
  messages: LiveChatItem[];
  /** "overlay" sits over the video (white on dark), "panel" on a card. */
  variant: "overlay" | "panel";
  className?: string;
}) {
  const t = useTranslations("live");
  const text = useChatText();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  return (
    <div
      ref={ref}
      className={cn(
        "space-y-1.5 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        variant === "overlay" &&
          "[mask-image:linear-gradient(to_bottom,transparent,black_30%)]",
        className,
      )}
    >
      {messages.length === 0 && variant === "panel" ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{t("chatEmpty")}</p>
      ) : null}
      {messages.map((m) =>
        m.kind === "system" ? (
          <p
            key={m.id}
            className={cn(
              "flex items-center gap-1.5 text-xs font-medium",
              variant === "overlay" ? "text-amber-200" : "text-amber-700",
            )}
          >
            <Pin className="size-3 shrink-0" />
            {text(m)}
          </p>
        ) : (
          <p
            key={m.id}
            className={cn(
              "w-fit max-w-full rounded-2xl px-2.5 py-1 text-[13px] leading-snug",
              variant === "overlay" ? "bg-black/35 text-white backdrop-blur-sm" : "bg-muted",
            )}
          >
            <span
              className={cn(
                "me-1.5 font-semibold",
                m.host
                  ? "text-rose-400"
                  : variant === "overlay"
                    ? "text-white/70"
                    : "text-muted-foreground",
              )}
            >
              {m.host ? (
                <span className="me-1 rounded bg-rose-500 px-1 py-px text-[10px] font-bold text-white">
                  {t("host")}
                </span>
              ) : null}
              {m.name}
            </span>
            {m.text}
          </p>
        ),
      )}
    </div>
  );
}

const HEART_COLORS = ["text-rose-500", "text-pink-400", "text-red-500", "text-fuchsia-400", "text-amber-400"];

/** Hearts drifting up the right edge, TikTok style. Call `burst(n)` to add some. */
export function useFloatingHearts() {
  const [hearts, setHearts] = useState<Array<{ id: number; x: number; color: string; scale: number }>>([]);
  const seq = useRef(0);
  const burst = (n: number) => {
    const fresh = Array.from({ length: Math.min(n, 12) }, (_, i) => ({
      id: ++seq.current + i * 0.001,
      x: Math.round(Math.random() * 36) - 18,
      color: HEART_COLORS[Math.floor(Math.random() * HEART_COLORS.length)],
      scale: 0.8 + Math.random() * 0.6,
    }));
    setHearts((current) => [...current, ...fresh].slice(-40));
    for (const h of fresh) {
      setTimeout(() => setHearts((current) => current.filter((x) => x.id !== h.id)), 2600);
    }
  };
  const layer = (
    <div className="pointer-events-none absolute bottom-28 end-4 h-72 w-16">
      {hearts.map((h, i) => (
        <Heart
          key={h.id}
          className={cn("live-heart absolute bottom-0 start-1/2 size-7 fill-current", h.color)}
          style={
            {
              "--heart-x": `${h.x}px`,
              "--heart-scale": h.scale,
              animationDelay: `${(i % 6) * 90}ms`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
  return { burst, layer };
}

/**
 * Add a live product to the cart, or buy it now in the checkout modal — the
 * live keeps playing behind it.
 */
export function useAddLiveProduct(product: LiveShopProduct) {
  const t = useTranslations();
  const { addItem } = useCartActions();
  const checkout = useEmbeddedCheckout();
  const [adding, setAdding] = useState<false | "cart" | "buy">(false);
  const put = async () =>
    addItem({
      productId: product.id,
      variantId: product.variantId,
      name: product.variantName ? `${product.name} - ${product.variantName}` : product.name,
      price: product.price,
      image: product.image,
      quantity: 1,
    });
  const add = async () => {
    if (!product.quickAdd || adding) return;
    setAdding("cart");
    try {
      await put();
      toast.success(t("cart.itemAdded"));
    } catch (error) {
      toast.error(refusalMessage(error) ?? t("common.error"));
    } finally {
      setAdding(false);
    }
  };
  const buy = async () => {
    if (adding) return;
    // Options to choose first: the product page, in the same modal.
    if (!product.quickAdd) {
      if (checkout) checkout.open(`/products/${product.slug}`, "options");
      else window.location.href = `/products/${product.slug}`;
      return;
    }
    setAdding("buy");
    try {
      await put();
      if (checkout) checkout.open("/checkout");
      else window.location.href = "/checkout";
    } catch (error) {
      toast.error(refusalMessage(error) ?? t("common.error"));
    } finally {
      setAdding(false);
    }
  };
  return { add, buy, adding };
}

/** One product: image, name, live price and the buy button. */
export function LiveProductRow({
  product,
  status,
  index,
  compact = false,
  action,
}: {
  product: LiveShopProduct;
  status: LiveStatus;
  index?: number;
  compact?: boolean;
  /** Replaces the buy button (the studio's pin button). */
  action?: React.ReactNode;
}) {
  const t = useTranslations("live");
  const { formatPrice } = useCurrency();
  const onAir = status === "live";
  return (
    <div className={cn("flex items-center gap-3 rounded-2xl bg-card", compact ? "p-1.5" : "border p-2")}>
      {typeof index === "number" ? (
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-rose-500 text-xs font-bold text-white">
          {index}
        </span>
      ) : null}
      <ProductLink slug={product.slug} className="flex min-w-0 flex-1 items-center gap-3 text-start">
        <span
          className={cn(
            "relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted",
            compact ? "size-12" : "size-16",
          )}
        >
          {product.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.image} alt="" className="size-full object-cover" />
          ) : (
            <Package className="size-5 text-muted-foreground" />
          )}
          {product.discountPercent > 0 ? (
            <span className="absolute inset-x-0 bottom-0 bg-rose-600 text-center text-[10px] font-bold text-white">
              -{product.discountPercent}%
            </span>
          ) : null}
        </span>
        <span className="min-w-0">
          <span className={cn("block truncate font-semibold text-foreground", compact ? "text-xs" : "text-sm")}>
            {product.name}
          </span>
          <span className="flex flex-wrap items-baseline gap-x-1.5">
            <span className={cn("font-bold text-rose-600", compact ? "text-sm" : "text-base")}>
              {formatPrice(product.price)}
            </span>
            {product.comparePrice ? (
              <span className="text-[11px] text-muted-foreground line-through">
                {formatPrice(product.comparePrice)}
              </span>
            ) : null}
          </span>
          {product.discountPercent > 0 ? (
            <span className="text-[11px] font-medium text-rose-600">
              {onAir ? t("liveDeal") : t("liveDealSoon", { pct: product.discountPercent })}
            </span>
          ) : null}
        </span>
      </ProductLink>
      {action ?? <LiveBuyButton product={product} compact={compact} />}
    </div>
  );
}

/** The storefront's buttons: a cart button and "buy now" (checkout in a modal). */
function LiveBuyButton({ product, compact }: { product: LiveShopProduct; compact: boolean }) {
  const t = useTranslations("embeddedCheckout");
  const tl = useTranslations("live");
  const { add, buy, adding } = useAddLiveProduct(product);
  if (!product.available) {
    return (
      <span className="shrink-0 rounded-xl bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground">
        {tl("soldOut")}
      </span>
    );
  }
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      {product.quickAdd ? (
        <button
          type="button"
          onClick={() => void add()}
          disabled={Boolean(adding)}
          aria-label={t("addToCart")}
          title={t("addToCart")}
          className={cn(
            "flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-600 transition-transform active:scale-95 disabled:opacity-60",
            compact ? "size-9" : "size-10",
          )}
        >
          {adding === "cart" ? <Loader2 className="size-4 animate-spin" /> : <ShoppingBag className="size-4" />}
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => void buy()}
        disabled={Boolean(adding)}
        className={cn(
          "inline-flex items-center justify-center gap-1 rounded-xl bg-linear-to-r from-rose-500 to-red-600 font-bold text-white shadow-md transition-transform active:scale-95 disabled:opacity-60",
          compact ? "h-9 px-3 text-xs" : "h-10 px-4 text-sm",
        )}
      >
        {adding === "buy" ? <Loader2 className="size-4 animate-spin" /> : null}
        {product.quickAdd ? t("buyNow") : tl("chooseOptions")}
      </button>
    </span>
  );
}

/**
 * The product's page: in the checkout modal where there is one (the live
 * room, so the stream keeps playing), a plain link elsewhere.
 */
export function ProductLink({
  slug,
  className,
  children,
}: {
  slug: string;
  className?: string;
  children: React.ReactNode;
}) {
  const checkout = useEmbeddedCheckout();
  if (!checkout) {
    return (
      <Link href={`/products/${slug}`} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={() => checkout.open(`/products/${slug}`, "options")} className={className}>
      {children}
    </button>
  );
}
