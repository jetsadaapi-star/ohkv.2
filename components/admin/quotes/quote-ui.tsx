"use client";

import { STATUS_TONE_CLASS } from "@/lib/ui/status-palette";
import { pageLocale } from "@/lib/intl/date-locale";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Circle, Package } from "lucide-react";
import { AppImage } from "@/components/ui/app-image";
import { cn } from "@/lib/utils";
import {
  vendorQuoteMoves,
  type QuoteActorRole,
  type QuoteStage,
} from "@/lib/quotes/quote-status";
import type { QuoteLotLimit } from "@/lib/quotes/quote-lot-fit";
import type { AdminQuoteRow } from "@/lib/quotes/quotes";

/**
 * The small pieces the Quotes table, the detail sheet and the price dialog
 * all draw, so the three never show the same quote two different ways.
 */

/**
 * Whose Quotes page this is. The store's works every quote through
 * `/api/admin/quotes`; a vendor's works its own through `/api/vendor/quotes`,
 * which answers with the same rows minus what the vendor may not see.
 */
export type QuoteScope = "admin" | "vendor";

export function quoteApiPath(scope: QuoteScope, id?: string, sub?: "offer") {
  return `/api/${scope}/quotes${id ? `/${id}` : ""}${sub ? `/${sub}` : ""}`;
}

/**
 * The moves a quote offers on this page, before the viewer's own grant
 * (`canManage`) is applied. The store may make any move the quote's stage
 * allows; a vendor only those `vendorQuoteMoves` leaves it — the same rule its
 * routes enforce — and never a delete.
 */
export function quoteMovesFor(
  scope: QuoteScope,
  quote: Pick<
    AdminQuoteRow,
    "stage" | "status" | "pricedByAdmin" | "lostByRole" | "offer"
  >,
) {
  if (scope === "vendor") {
    return { ...vendorQuoteMoves(quote), canDelete: false };
  }
  const open =
    quote.stage === "needs_reply" ||
    quote.stage === "offer_sent" ||
    quote.stage === "expired";
  const onOrder = quote.stage === "ordered" || quote.stage === "won";
  const canReopen =
    quote.stage === "closed" && quote.status === "lost" && !quote.offer?.withdrawnAt;
  return {
    lockedByStore: false,
    canSendPrice:
      !onOrder && (open || (quote.stage === "closed" && Boolean(quote.offer) && !canReopen)),
    canWithdraw: quote.stage === "offer_sent",
    canMarkLost: open,
    canReopen,
    canDelete: true,
  };
}

/** Who sent a price — the store or the vendor — beside the price itself. */
export function QuoteOfferBy({
  role,
  className,
}: {
  role: QuoteActorRole;
  className?: string;
}) {
  const t = useTranslations("admin.quotesPage.by");
  return (
    <span
      className={cn(
        "inline-flex h-[18px] shrink-0 items-center rounded-sm px-1.5 text-[10px] font-semibold",
        role === "vendor"
          ? "bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-200"
          : "bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-200",
        className,
      )}
    >
      {t(role)}
    </span>
  );
}

/**
 * One colour per stage, in the Orders list's pill style. The order of warmth
 * is the order of urgency: amber waits on the merchant, rose lapsed and wants
 * a nudge, blue and cyan wait on the customer, green is done, slate is over.
 */
const STAGE_STYLES: Record<QuoteStage, string> = {
  // The shared palette (lib/ui/status-palette): waiting on the merchant amber,
  // waiting on the customer blue, lapsed red, done green, over grey.
  needs_reply: STATUS_TONE_CLASS.warning,
  offer_sent: STATUS_TONE_CLASS.info,
  expired: STATUS_TONE_CLASS.danger,
  ordered: STATUS_TONE_CLASS.info,
  won: STATUS_TONE_CLASS.success,
  closed: STATUS_TONE_CLASS.neutral,
};

export function QuoteStageBadge({
  stage,
  className,
}: {
  stage: QuoteStage;
  className?: string;
}) {
  const t = useTranslations("admin.quotesPage.stage");
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-semibold ring-1 ring-inset",
        STAGE_STYLES[stage],
        className,
      )}
    >
      <Circle className="h-2.5 w-2.5 fill-current stroke-0" />
      {t(stage)}
    </span>
  );
}

/** "Guest" beside a name that has no account behind it. */
export function GuestChip() {
  const t = useTranslations("common");
  return (
    <span className="inline-flex h-[18px] shrink-0 items-center rounded-sm bg-muted px-1.5 text-[10px] font-semibold text-muted-foreground">
      {t("guest")}
    </span>
  );
}

export function QuoteProductThumb({
  src,
  alt,
  size = 36,
}: {
  src?: string;
  alt: string;
  size?: 36 | 48;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted text-muted-foreground",
        size === 48 ? "h-12 w-12" : "h-9 w-9",
      )}
    >
      {src && !failed ? (
        <AppImage
          src={src}
          alt={alt}
          fill
          sizes="48px"
          className="object-cover"
          onImageError={() => setFailed(true)}
        />
      ) : (
        <Package className="h-4 w-4" />
      )}
    </span>
  );
}

/** Short date, the way the Orders list prints one. */
export function formatQuoteDate(value?: string | Date | null) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(pageLocale(), {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Why a quoted lot cannot be checked out, in a table cell's few words or the
 * sentence the sheet and the dialog print. Null when it can.
 */
export function useLotMessage() {
  const t = useTranslations("admin.quotesPage.lot");
  return {
    short(limit: QuoteLotLimit) {
      switch (limit.reason) {
        case "stock":
          return t("stockShort", { max: limit.max ?? 0 });
        case "preorder":
          return t("preorderShort", { max: limit.max ?? 0 });
        case "needs_variant":
          return t("needsVariantShort");
        default:
          return t("unavailableShort");
      }
    },
    long(limit: QuoteLotLimit, quantity: number) {
      switch (limit.reason) {
        case "stock":
          return t("stock", { max: limit.max ?? 0, quantity });
        case "preorder":
          return t("preorder", { max: limit.max ?? 0, quantity });
        case "needs_variant":
          return t("needsVariant");
        default:
          return t("unavailable");
      }
    },
  };
}
