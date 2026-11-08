import { CalendarClock, Eye, Package, Radio } from "lucide-react";
import Link from "@/components/language/link";
import type { LiveCard as LiveCardData } from "@/lib/live/live-types";
import { cn } from "@/lib/utils";

/**
 * One live in a storefront list: a tall card with the cover (or the products'
 * photos), LIVE badge and viewer count, or the start time for upcoming ones.
 */
export function LiveCard({
  live,
  labels,
  className,
}: {
  live: LiveCardData;
  labels: { live: string; viewers: string; products: string; startsAt: string };
  className?: string;
}) {
  const cover = live.coverUrl || live.productImages[0];
  const onAir = live.status === "live";
  return (
    <Link
      href={`/live/${live.id}`}
      className={cn(
        "group relative block aspect-3/4 overflow-hidden rounded-3xl bg-slate-900 shadow-md ring-1 ring-black/5 transition-transform hover:-translate-y-0.5 hover:shadow-xl",
        className,
      )}
    >
      {cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cover} alt="" className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-105" />
      ) : (
        <span className="absolute inset-0 bg-linear-to-br from-rose-500 via-red-500 to-amber-400" />
      )}
      <span className="absolute inset-0 bg-linear-to-t from-black/85 via-black/20 to-black/40" />
      <span className="absolute inset-x-3 top-3 flex items-center gap-1.5">
        {onAir ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-red-600 px-2 py-0.5 text-[11px] font-bold tracking-wide text-white shadow">
            <span className="size-1.5 animate-pulse rounded-full bg-white" />
            {labels.live}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-400 px-2 py-0.5 text-[11px] font-bold text-slate-900">
            <CalendarClock className="size-3" />
            {labels.startsAt}
          </span>
        )}
        {onAir ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-black/45 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur">
            <Eye className="size-3" />
            {labels.viewers}
          </span>
        ) : null}
      </span>
      {onAir ? (
        <span className="absolute end-3 top-3 flex size-8 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur">
          <Radio className="size-4" />
        </span>
      ) : null}
      <span className="absolute inset-x-3 bottom-3 text-white">
        <span className="flex items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-linear-to-br from-rose-500 to-red-600 text-xs font-bold">
            {live.store.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={live.store.logo} alt="" className="size-full object-cover" />
            ) : (
              live.store.name.trim().charAt(0)
            )}
          </span>
          <span className="truncate text-xs font-semibold text-white/90">{live.store.name}</span>
        </span>
        <span className="mt-2 line-clamp-2 text-sm font-bold leading-snug">{live.title}</span>
        <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[11px] backdrop-blur">
          <Package className="size-3" />
          {labels.products}
        </span>
      </span>
    </Link>
  );
}
