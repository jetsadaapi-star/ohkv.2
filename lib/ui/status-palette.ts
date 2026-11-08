/**
 * The one colour language for statuses, everywhere a badge says one.
 *
 *   success  green   done and good: paid, delivered, active, approved, won
 *   warning  amber   waiting on someone: pending, unpaid, requested, reserved
 *   info     blue    moving along: processing, open, offer sent, scheduled
 *   transit  indigo  on its way: shipped, in transit, awaiting shipment
 *   refund   violet  money going back: refunded, partially refunded
 *   danger   red     stopped or failed: cancelled, failed, rejected, expired
 *   neutral  grey    off or set aside: draft, archived, inactive, closed
 *
 * Before this, "paid" was grey on the orders list and the theme's primary on
 * half the other tables; a merchant scanning for money that came in had no one
 * colour to look for.
 */
export type StatusTone =
  | "success"
  | "warning"
  | "info"
  | "transit"
  | "refund"
  | "danger"
  | "neutral";

export const STATUS_TONE_CLASS: Record<StatusTone, string> = {
  success:
    "bg-emerald-100 text-emerald-800 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30",
  warning:
    "bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30",
  info: "bg-sky-100 text-sky-800 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/30",
  transit:
    "bg-indigo-100 text-indigo-800 ring-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300 dark:ring-indigo-500/30",
  refund:
    "bg-violet-100 text-violet-800 ring-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-500/30",
  danger:
    "bg-rose-100 text-rose-700 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30",
  neutral:
    "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:ring-slate-500/30",
};

/** The dot beside a label, in the same tone. */
export const STATUS_TONE_DOT: Record<StatusTone, string> = {
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  info: "bg-sky-500",
  transit: "bg-indigo-500",
  refund: "bg-violet-500",
  danger: "bg-rose-500",
  neutral: "bg-slate-400",
};

const TONE_BY_STATUS: Record<string, StatusTone> = {
  // done and good
  paid: "success",
  delivered: "success",
  fulfilled: "success",
  completed: "success",
  complete: "success",
  active: "success",
  published: "success",
  live: "success",
  approved: "success",
  won: "success",
  recovered: "success",
  ready: "success",
  resolved: "success",
  succeeded: "success",
  success: "success",
  verified: "success",
  in_stock: "success",
  // waiting on someone
  pending: "warning",
  unpaid: "warning",
  unfulfilled: "warning",
  not_shipped: "warning",
  partially_paid: "warning",
  awaiting_payment: "warning",
  awaiting_approval: "warning",
  requested: "warning",
  reserved: "warning",
  payment_due: "warning",
  needs_reply: "warning",
  refund_pending: "warning",
  on_hold: "warning",
  paused: "warning",
  low_stock: "warning",
  not_recovered: "warning",
  partially_ready: "warning",
  ready_to_ship: "warning",
  payment_required: "warning",
  // moving along
  processing: "info",
  open: "info",
  in_progress: "info",
  offer_sent: "info",
  quoted: "info",
  scheduled: "info",
  received: "info",
  inspected: "info",
  ordered: "info",
  preordered: "info",
  confirmed: "info",
  // on its way
  shipped: "transit",
  in_transit: "transit",
  out_for_delivery: "transit",
  awaiting_shipment: "transit",
  // money going back
  refunded: "refund",
  partially_refunded: "refund",
  // stopped or failed
  cancelled: "danger",
  canceled: "danger",
  failed: "danger",
  rejected: "danger",
  declined: "danger",
  expired: "danger",
  banned: "danger",
  suspended: "danger",
  lost: "danger",
  out_of_stock: "danger",
  overdue: "danger",
  spam: "danger",
  delayed: "danger",
  // off or set aside
  draft: "neutral",
  withdrawn: "neutral",
  trash: "neutral",
  archived: "neutral",
  inactive: "neutral",
  closed: "neutral",
  ended: "neutral",
  unlisted: "neutral",
  hidden: "neutral",
  not_required: "neutral",
};

/** A status's tone, or `fallback` for one this file does not know. */
export function statusTone(status: string | null | undefined, fallback: StatusTone = "neutral"): StatusTone {
  if (!status) return fallback;
  return TONE_BY_STATUS[status.toLowerCase().replace(/[\s-]+/g, "_")] ?? fallback;
}

/** Whether the palette has an opinion on this status. */
export function hasStatusTone(status: string | null | undefined): boolean {
  return Boolean(status && TONE_BY_STATUS[status.toLowerCase().replace(/[\s-]+/g, "_")]);
}

/** The badge classes for a status: tinted fill, matching text and ring. */
export function statusBadgeClass(status: string | null | undefined, fallback: StatusTone = "neutral"): string {
  return STATUS_TONE_CLASS[statusTone(status, fallback)];
}
