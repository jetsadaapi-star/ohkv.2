import { Eye, Flame, Heart, Radio } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "@/components/language/link";
import { listTopLives } from "@/lib/live/live-service";
import { cn } from "@/lib/utils";

const RANK_TONES = [
  "from-amber-300 to-amber-500",
  "from-slate-200 to-slate-400",
  "from-orange-300 to-orange-600",
  "from-rose-300 to-rose-500",
  "from-rose-300 to-rose-500",
];

/**
 * The five most-watched lives of the last 30 days, ranked by how many people
 * watched — big rank numbers beside each card. On-air ones say LIVE and open
 * the stream; ended ones open the room with its products.
 */
export async function LiveTopRanking({
  locale,
  title,
  subtitle,
  limit = 5,
  preview,
  className,
}: {
  locale: string;
  title: string;
  subtitle?: string;
  limit?: number;
  preview?: boolean;
  className?: string;
}) {
  const t = await getTranslations({ locale });
  const lives = await listTopLives({ limit }).catch(() => []);
  if (lives.length === 0 && !preview) return null;
  const compact = (n: number) =>
    new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(n);

  return (
    <section className={cn("container mx-auto px-4 py-8 sm:py-10", className)}>
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2.5 text-xl font-bold tracking-tight sm:text-2xl">
            <span className="flex size-9 items-center justify-center rounded-xl bg-linear-to-br from-orange-500 to-red-600 text-white shadow-md shadow-red-500/30">
              <Flame className="size-5" />
            </span>
            {title}
          </h2>
          {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
      </div>
      {lives.length === 0 ? (
        <div className="flex items-center gap-3 rounded-2xl border border-dashed bg-white p-6 text-sm text-muted-foreground">
          <Radio className="size-5 text-red-500" />
          {t("live.topEmpty")}
        </div>
      ) : (
        <ol className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-3 [scrollbar-width:none] lg:mx-0 lg:grid lg:grid-cols-5 lg:gap-3 lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden">
          {lives.map((live, index) => {
            const cover = live.coverUrl || live.productImages[0];
            const onAir = live.status === "live";
            return (
              <li key={live.id} className="relative w-56 shrink-0 snap-start ps-10 lg:w-auto">
                {/* The rank, standing behind the card's left edge */}
                <span
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute -start-1 bottom-2 z-0 bg-linear-to-b bg-clip-text text-[7rem] font-black leading-none text-transparent [-webkit-text-stroke:2px_rgba(15,23,42,0.12)]",
                    RANK_TONES[index] ?? RANK_TONES[4],
                  )}
                >
                  {index + 1}
                </span>
                <Link
                  href={`/live/${live.id}`}
                  className="group relative z-10 block aspect-3/4 overflow-hidden rounded-2xl bg-slate-900 shadow-lg ring-1 ring-black/5 transition-transform hover:-translate-y-1"
                >
                  {cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cover} alt="" className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  ) : (
                    <span className="absolute inset-0 bg-linear-to-br from-rose-500 via-red-500 to-amber-400" />
                  )}
                  <span className="absolute inset-0 bg-linear-to-t from-black/85 via-black/10 to-black/40" />
                  <span className="absolute inset-x-2 top-2 flex items-center gap-1">
                    {onAir ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        <span className="size-1.5 animate-pulse rounded-full bg-white" />
                        {t("live.badgeLive")}
                      </span>
                    ) : (
                      <span className="rounded-md bg-black/50 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
                        {t("live.statusEnded")}
                      </span>
                    )}
                    <span className="ms-auto inline-flex items-center gap-1 rounded-md bg-black/50 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
                      <Eye className="size-3" />
                      {compact(live.totalViews)}
                    </span>
                  </span>
                  <span className="absolute inset-x-2.5 bottom-2.5 text-white">
                    <span className="block truncate text-[11px] font-medium text-white/80">{live.store.name}</span>
                    <span className="mt-0.5 line-clamp-2 text-sm font-bold leading-snug">{live.title}</span>
                    <span className="mt-1.5 flex items-center gap-2 text-[11px] text-white/85">
                      <span className="inline-flex items-center gap-0.5">
                        <Eye className="size-3" />
                        {t("live.totalViews", { count: live.totalViews })}
                      </span>
                      <span className="inline-flex items-center gap-0.5">
                        <Heart className="size-3 fill-current" />
                        {compact(live.likeCount)}
                      </span>
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
