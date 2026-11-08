import { statusTone, type StatusTone } from "@/lib/ui/status-palette";
import { LOW_STOCK_THRESHOLD } from "@/lib/inventory/low-stock";
import { productTracksStock, type StockPolicySource } from "@/lib/products/stock-policy";

/**
 * The vendor area's status colours, shared by its lists: a row tinted in its
 * status's hue with a coloured leading edge, so a queue reads at a glance.
 * Literal class strings so Tailwind sees every one.
 */
export type StatusHue =
  | "amber"
  | "orange"
  | "sky"
  | "indigo"
  | "violet"
  | "emerald"
  | "teal"
  | "rose"
  | "slate";

const ROW_TONE: Record<StatusHue, string> = {
  amber:
    "bg-amber-50/60 hover:bg-amber-50 dark:bg-amber-500/5 dark:hover:bg-amber-500/10 [&>td:first-child]:border-s-4 [&>td:first-child]:border-s-amber-400",
  orange:
    "bg-orange-50/60 hover:bg-orange-50 dark:bg-orange-500/5 dark:hover:bg-orange-500/10 [&>td:first-child]:border-s-4 [&>td:first-child]:border-s-orange-400",
  sky: "bg-sky-50/60 hover:bg-sky-50 dark:bg-sky-500/5 dark:hover:bg-sky-500/10 [&>td:first-child]:border-s-4 [&>td:first-child]:border-s-sky-400",
  indigo:
    "bg-indigo-50/60 hover:bg-indigo-50 dark:bg-indigo-500/5 dark:hover:bg-indigo-500/10 [&>td:first-child]:border-s-4 [&>td:first-child]:border-s-indigo-400",
  violet:
    "bg-violet-50/60 hover:bg-violet-50 dark:bg-violet-500/5 dark:hover:bg-violet-500/10 [&>td:first-child]:border-s-4 [&>td:first-child]:border-s-violet-400",
  emerald:
    "bg-emerald-50/50 hover:bg-emerald-50 dark:bg-emerald-500/5 dark:hover:bg-emerald-500/10 [&>td:first-child]:border-s-4 [&>td:first-child]:border-s-emerald-400",
  teal: "bg-teal-50/50 hover:bg-teal-50 dark:bg-teal-500/5 dark:hover:bg-teal-500/10 [&>td:first-child]:border-s-4 [&>td:first-child]:border-s-teal-400",
  rose: "bg-rose-50/50 hover:bg-rose-50 dark:bg-rose-500/5 dark:hover:bg-rose-500/10 [&>td:first-child]:border-s-4 [&>td:first-child]:border-s-rose-400",
  slate:
    "bg-slate-50/70 text-muted-foreground hover:bg-slate-100/70 dark:bg-slate-500/5 [&>td:first-child]:border-s-4 [&>td:first-child]:border-s-slate-300",
};

export function statusRowClass(hue: StatusHue): string {
  return ROW_TONE[hue];
}

const HUE_BY_TONE: Record<StatusTone, StatusHue> = {
  success: "emerald",
  warning: "amber",
  info: "sky",
  transit: "indigo",
  refund: "violet",
  danger: "rose",
  neutral: "slate",
};

/** A row's hue from the shared badge palette, so a row and its badge agree. */
export function statusRowHue(status: string | null | undefined, fallback: StatusTone = "neutral"): StatusHue {
  return HUE_BY_TONE[statusTone(status, fallback)];
}

/** Returns: waiting on the vendor is warm, in motion is blue, settled is green. */
export function returnStatusHue(status: string): StatusHue {
  return statusRowHue(status);
}

export function quoteStageHue(stage: string | undefined): StatusHue {
  return statusRowHue(stage);
}

export function preorderStatusHue(status: string): StatusHue {
  return statusRowHue(status);
}

export function abandonedCheckoutHue(row: {
  recoveryStatus?: string;
  offer?: { status: string };
}): StatusHue {
  if (row.recoveryStatus === "recovered") return "emerald";
  if (row.offer && ["pending", "sent"].includes(row.offer.status)) return "sky";
  return "amber";
}

/** The modern list card: rounded on desktop, edge to edge on a phone. */
export const MODERN_TABLE_CARD =
  "rounded-2xl p-0 shadow-sm max-sm:border-0 max-sm:bg-transparent max-sm:shadow-none sm:p-4";

/**
 * A catalogue row: on sale and stocked is green, on sale and running low is
 * amber, on sale with nothing left is red, and a draft or unlisted product
 * is grey, since no shopper can buy it either way.
 */
export function productRowHue(
  row: StockPolicySource & { status?: string; stock?: number; variants?: { stock?: number }[] },
): StatusHue {
  if (row.status !== "active") return "slate";
  // A download or an untracked product never runs out: its zero means nothing.
  if (!productTracksStock(row)) return "emerald";
  const units = row.variants?.length
    ? row.variants.reduce((sum, variant) => sum + (variant.stock ?? 0), 0)
    : (row.stock ?? 0);
  return stockRowHue(units);
}

/** A stock line, by what the store can still sell. */
export function stockRowHue(available: number): StatusHue {
  if (available <= 0) return "rose";
  if (available <= LOW_STOCK_THRESHOLD) return "amber";
  return "emerald";
}

/** On or off: a live category, collection or location is green, a hidden one grey. */
export function activeRowHue(isActive: boolean): StatusHue {
  return isActive ? "emerald" : "slate";
}

/** A brand: waiting on review is amber, refused red, archived or hidden grey. */
export function brandRowHue(row: {
  isActive: boolean;
  approvalStatus?: string;
  deletedAt?: string | null;
}): StatusHue {
  if (row.deletedAt) return "slate";
  if (row.approvalStatus === "pending") return "amber";
  if (row.approvalStatus === "rejected") return "rose";
  return activeRowHue(row.isActive);
}

/** A review: on hold waits on the admin, a low score wants a look, the rest is fine. */
export function reviewRowHue(row: { isApproved: boolean; rating: number }): StatusHue {
  if (!row.isApproved) return "amber";
  if (row.rating <= 2) return "rose";
  return "emerald";
}
