"use client";

import { useSyncExternalStore } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Store } from "lucide-react";
import Link from "@/components/language/link";
import { cn } from "@/lib/utils";

const noop = () => () => {};
const useMounted = () => useSyncExternalStore(noop, () => true, () => false);

export interface FlashSlot {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  live: boolean;
  vendorName?: string;
}

/**
 * The sale rounds as a row of tabs, the way shoppers know them: the time
 * window large, "On now" or the day it starts beneath. Times are the
 * shopper's own, so they are written after mount.
 */
export function FlashSlotTabs({
  slots,
  activeId,
  vendor,
}: {
  slots: FlashSlot[];
  activeId?: string;
  vendor?: string;
}) {
  const t = useTranslations("flashSale");
  const locale = useLocale();
  const mounted = useMounted();
  if (slots.length < 2) return null;

  const time = (value: string) =>
    mounted ? new Date(value).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }) : "--:--";
  const day = (value: string) =>
    mounted ? new Date(value).toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" }) : "";

  return (
    <nav aria-label={t("rounds")} className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <ul className="flex min-w-max gap-2 sm:gap-3">
        {slots.map((slot) => {
          const active = slot.id === activeId;
          const query = new URLSearchParams({ sale: slot.id });
          if (vendor) query.set("vendor", vendor);
          return (
            <li key={slot.id}>
              <Link
                href={`/flash-sale?${query.toString()}`}
                scroll={false}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-w-[9.5rem] flex-col items-center rounded-2xl border px-4 py-2.5 text-center transition",
                  active
                    ? "border-transparent bg-[linear-gradient(135deg,var(--primary),color-mix(in_oklab,var(--primary)_65%,var(--highlight)))] text-white shadow-lg shadow-primary/25"
                    : "bg-card hover:border-[color-mix(in_oklab,var(--primary)_40%,transparent)] hover:bg-muted/50",
                )}
              >
                <span className="font-mono text-lg font-extrabold tabular-nums">
                  {time(slot.startsAt)}–{time(slot.endsAt)}
                </span>
                <span
                  className={cn(
                    "mt-0.5 inline-flex items-center gap-1.5 text-xs font-semibold",
                    active ? "text-white/90" : slot.live ? "text-[var(--primary)]" : "text-muted-foreground",
                  )}
                >
                  {slot.live ? (
                    <span className="relative flex size-2">
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-70" />
                      <span className="relative inline-flex size-2 rounded-full bg-current" />
                    </span>
                  ) : null}
                  {slot.live ? t("onNow") : day(slot.startsAt) || t("upcoming")}
                </span>
                {slot.vendorName ? (
                  <span className={cn("mt-1 inline-flex max-w-[9rem] items-center gap-1 truncate text-[10px]", active ? "text-white/80" : "text-muted-foreground")}>
                    <Store className="size-3 shrink-0" />
                    <span className="truncate">{slot.vendorName}</span>
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
