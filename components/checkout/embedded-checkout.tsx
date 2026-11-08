"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocale, useTranslations } from "next-intl";
import { CheckCircle2, ExternalLink, Loader2, ShoppingBag, X } from "lucide-react";
import { toast } from "@/components/ui/toast-notification";
import { useCartActions } from "@/hooks/use-cart";

/**
 * Checkout over the page instead of in place of it — for the live room and
 * the review clip feed, where leaving the page means losing the stream.
 *
 * The modal frames the store's own checkout (and, for a product with options
 * to choose, its product page), so every rule of the real checkout — address,
 * shipping, payment, stock holds — applies unchanged. Framed store pages hide
 * their header, footer and bottom bar (the store layout marks the document
 * `data-embedded`). The frame is watched as it moves:
 *
 * - on the order-placed page, the modal says so and the cart is refreshed;
 * - on a page that is not part of buying (the home page after "continue
 *   shopping"), the modal simply closes;
 * - on another site (an external payment page that refuses to be framed),
 *   the shopper is offered the same step in a new tab.
 */

type Phase = "loading" | "ready" | "done" | "external";

interface EmbeddedCheckoutApi {
  /** Open a store path (`/checkout`, `/products/slug`) in the modal. */
  open: (path: string, kind?: "checkout" | "options") => void;
}

/** Fired on window when the modal opens. */
export const EMBEDDED_CHECKOUT_OPEN = "embedded-checkout:open";

const EmbeddedCheckoutContext = createContext<EmbeddedCheckoutApi | null>(null);

/** The modal's opener, or null outside a provider (callers then navigate). */
export function useEmbeddedCheckout(): EmbeddedCheckoutApi | null {
  return useContext(EmbeddedCheckoutContext);
}

const BUYING_PATHS = /^\/(checkout|cart|products|login|register|order|account\/addresses)(\/|$)/;
const DONE_PATHS = /^\/(checkout\/success|order\/)/;

export function EmbeddedCheckoutProvider({ children }: { children: React.ReactNode }) {
  const t = useTranslations("embeddedCheckout");
  const locale = useLocale();
  const { refreshCart } = useCartActions();
  const [target, setTarget] = useState<{ src: string; kind: "checkout" | "options" } | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [mounted, setMounted] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const phaseRef = useRef<Phase>("loading");
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => setMounted(true), []);

  const open = useCallback(
    (path: string, kind: "checkout" | "options" = "checkout") => {
      // Keep the locale prefix the shopper is browsing under (none for the default one).
      const here = window.location.pathname;
      const prefix = here === `/${locale}` || here.startsWith(`/${locale}/`) ? `/${locale}` : "";
      setPhase("loading");
      setTarget({ src: `${prefix}${path}`, kind });
      // Sheets on the page (product bags, comments) close: their focus trap
      // would otherwise keep the shopper out of the checkout.
      window.dispatchEvent(new Event(EMBEDDED_CHECKOUT_OPEN));
    },
    [locale],
  );

  const close = useCallback(() => {
    const placed = phaseRef.current === "done";
    setTarget(null);
    void refreshCart(true);
    if (placed) toast.success(t("orderPlaced"));
  }, [refreshCart, t]);

  // Escape closes, as any dialog.
  useEffect(() => {
    if (!target) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [target, close]);

  /** Where the frame is now, and what that means for the modal. */
  const inspect = useCallback(
    (fromLoad: boolean) => {
      const frame = frameRef.current;
      if (!frame) return;
      let pathname: string;
      try {
        pathname = frame.contentWindow?.location.pathname ?? "";
      } catch {
        // Another site (a payment page): we cannot see or frame it reliably.
        setPhase("external");
        return;
      }
      if (!pathname || pathname === "blank") return;
      const path = pathname.replace(new RegExp(`^/${locale}(?=/|$)`), "") || "/";
      // The title follows the frame: product options first, then checkout.
      if (/^\/(checkout|cart)(\/|$)/.test(path)) {
        setTarget((current) => (current && current.kind !== "checkout" ? { ...current, kind: "checkout" } : current));
      }
      if (DONE_PATHS.test(path)) {
        setPhase("done");
      } else if (BUYING_PATHS.test(path)) {
        if (fromLoad || phaseRef.current === "loading") setPhase("ready");
      } else if (phaseRef.current !== "loading") {
        // Left the buying flow ("continue shopping"): back to the live / clip.
        close();
      }
    },
    [locale, close],
  );
  const handleLoad = () => inspect(true);

  // Pages inside the frame change without a reload (client navigation), so
  // the load event alone would miss "order placed".
  useEffect(() => {
    if (!target) return;
    const timer = setInterval(() => inspect(false), 500);
    return () => clearInterval(timer);
  }, [target, inspect]);

  const currentSrc = () => {
    try {
      return frameRef.current?.contentWindow?.location.href ?? target?.src ?? "/checkout";
    } catch {
      return target?.src ?? "/checkout";
    }
  };

  const modal =
    target && mounted
      ? createPortal(
          <div
            className="pointer-events-auto fixed inset-0 z-[200] flex items-end justify-center bg-black/55 backdrop-blur-[2px] lg:items-center lg:p-6"
            onClick={(event) => {
              if (event.target === event.currentTarget) close();
            }}
            role="dialog"
            aria-modal="true"
            aria-label={target.kind === "options" ? t("optionsTitle") : t("checkoutTitle")}
          >
            <div className="flex h-[94dvh] w-full flex-col overflow-hidden rounded-t-[28px] bg-background shadow-2xl lg:h-[90vh] lg:max-w-[640px] lg:rounded-3xl">
              <div className="relative flex shrink-0 items-center gap-2 border-b px-4 py-3">
                <span className="absolute start-1/2 top-1.5 h-1 w-10 -translate-x-1/2 rounded-full bg-muted-foreground/25 lg:hidden" />
                <span className="flex size-8 items-center justify-center rounded-xl bg-linear-to-br from-rose-500 to-red-600 text-white">
                  {phase === "done" ? <CheckCircle2 className="size-4" /> : <ShoppingBag className="size-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-bold">
                    {phase === "done"
                      ? t("doneTitle")
                      : target.kind === "options"
                        ? t("optionsTitle")
                        : t("checkoutTitle")}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">{t("keepWatching")}</span>
                </span>
                <button
                  type="button"
                  onClick={close}
                  aria-label={t("close")}
                  className="flex size-9 items-center justify-center rounded-full hover:bg-muted"
                >
                  <X className="size-5" />
                </button>
              </div>

              <div className="relative min-h-0 flex-1">
                <iframe
                  ref={frameRef}
                  src={target.src}
                  title={target.kind === "options" ? t("optionsTitle") : t("checkoutTitle")}
                  onLoad={handleLoad}
                  className="size-full border-0 bg-background"
                />
                {phase === "loading" ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-background">
                    <Loader2 className="size-7 animate-spin text-muted-foreground" />
                  </div>
                ) : null}
                {phase === "external" ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background p-8 text-center">
                    <ExternalLink className="size-9 text-muted-foreground" />
                    <p className="max-w-sm text-sm text-muted-foreground">{t("externalPay")}</p>
                    <button
                      type="button"
                      onClick={() => {
                        window.open(currentSrc(), "_blank", "noopener");
                      }}
                      className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white"
                    >
                      {t("openNewTab")}
                    </button>
                  </div>
                ) : null}
              </div>

              {phase === "done" ? (
                <div className="shrink-0 border-t p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                  <button
                    type="button"
                    onClick={close}
                    className="h-12 w-full rounded-2xl bg-linear-to-r from-rose-500 to-red-600 text-base font-bold text-white shadow-lg"
                  >
                    {t("backToWatching")}
                  </button>
                </div>
              ) : null}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <EmbeddedCheckoutContext.Provider value={{ open }}>
      {children}
      {modal}
    </EmbeddedCheckoutContext.Provider>
  );
}
