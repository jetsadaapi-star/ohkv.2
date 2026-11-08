import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils";

const CHIPS = [
  { key: "unread", tone: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30", dot: "bg-rose-500" },
  { key: "open", tone: "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/30", dot: "bg-sky-500" },
  { key: "pending", tone: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30", dot: "bg-amber-500" },
  { key: "resolved", tone: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30", dot: "bg-emerald-500" },
] as const;

/**
 * What is waiting at a glance, over the conversations the page loaded (the
 * newest 100): unread red, open blue, pending amber, resolved green. A count
 * of nothing goes grey, so the colour only ever means "look here".
 */
export async function InboxStatusChips({
  locale,
  conversations,
}: {
  locale: string;
  conversations: Array<{ unreadCount: number; status: string }>;
}) {
  const t = await getTranslations({ locale, namespace: "admin.hc.vendorInbox" });
  const counts = {
    unread: conversations.filter((conversation) => conversation.unreadCount > 0).length,
    open: conversations.filter((conversation) => conversation.status === "open").length,
    pending: conversations.filter((conversation) => conversation.status === "pending").length,
    resolved: conversations.filter((conversation) => conversation.status === "resolved").length,
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {CHIPS.map((chip) => {
        const value = counts[chip.key];
        return (
          <span
            key={chip.key}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
              value > 0 ? chip.tone : "bg-muted/50 text-muted-foreground ring-border",
            )}
          >
            <span className={cn("size-1.5 rounded-full", value > 0 ? chip.dot : "bg-muted-foreground/40")} />
            {t(chip.key)}
            <span className="tabular-nums">{value.toLocaleString(locale)}</span>
          </span>
        );
      })}
    </div>
  );
}
