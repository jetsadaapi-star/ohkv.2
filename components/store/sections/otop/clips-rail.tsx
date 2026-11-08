import { Clapperboard, Heart, MessageCircle, Play, ShoppingBag } from "lucide-react";
import Link from "@/components/language/link";
import { listClipFeed } from "@/lib/clips/clips-service";
import { OtopSectionHeading } from "./otop-section-heading";
import { ClipRailVideo } from "./clip-rail-video";

/**
 * Shoppable clips on the home page: a row of vertical cards, each opening the
 * clip feed at that clip. Absent when no store has published one — except in
 * the editor's preview, which says what will appear here.
 */
export async function ClipsRail({
  title,
  subtitle,
  viewAllLabel,
  limit,
  preview,
  labels,
}: {
  title: string;
  subtitle: string;
  viewAllLabel: string;
  limit: number;
  preview?: boolean;
  labels: { products: (count: number) => string; empty: string };
}) {
  const { items } = await listClipFeed({ limit }).catch(() => ({ items: [] }));
  if (items.length === 0 && !preview) return null;

  return (
    <section className="container mx-auto px-4 py-8 sm:py-10">
      <OtopSectionHeading
        title={title}
        subtitle={subtitle}
        viewAllLabel={viewAllLabel}
        viewAllHref="/clips"
      />
      {items.length === 0 ? (
        <div className="flex items-center gap-3 rounded-2xl border border-dashed bg-white p-6 text-sm text-muted-foreground">
          <Clapperboard className="size-5 text-rose-500" />
          {labels.empty}
        </div>
      ) : (
        <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:gap-4 [&::-webkit-scrollbar]:hidden">
          {items.map((clip) => (
            <Link
              key={clip.id}
              href={`/clips?start=${clip.id}`}
              className="group relative block aspect-9/16 w-40 shrink-0 snap-start overflow-hidden rounded-2xl bg-slate-900 shadow-md sm:w-48"
            >
              <ClipRailVideo src={clip.videoUrl} poster={clip.posterUrl} />
              <span className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/80 via-black/10 to-black/30" />
              <span className="absolute start-2 top-2 inline-flex items-center gap-1 rounded-full bg-rose-500 px-2 py-0.5 text-[11px] font-semibold text-white shadow">
                <ShoppingBag className="size-3" />
                {labels.products(clip.products.length)}
              </span>
              <span className="absolute inset-0 flex items-center justify-center opacity-90 transition-opacity group-hover:opacity-0">
                <span className="flex size-11 items-center justify-center rounded-full bg-white/25 text-white backdrop-blur">
                  <Play className="size-5 fill-current" />
                </span>
              </span>
              <span className="absolute inset-x-2 bottom-2 text-white">
                <span className="line-clamp-2 text-sm font-semibold leading-snug">
                  {clip.title || clip.caption}
                </span>
                <span className="mt-0.5 block truncate text-[11px] text-white/80">
                  {clip.store.name}
                </span>
                <span className="mt-1 flex items-center gap-2.5 text-[11px] font-semibold text-white/90">
                  <span className="inline-flex items-center gap-0.5">
                    <Heart className="size-3 fill-current" />
                    {clip.likeCount.toLocaleString()}
                  </span>
                  <span className="inline-flex items-center gap-0.5">
                    <MessageCircle className="size-3" />
                    {clip.commentCount.toLocaleString()}
                  </span>
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
