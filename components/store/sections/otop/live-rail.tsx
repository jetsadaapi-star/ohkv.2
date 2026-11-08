import { Radio } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { LiveCard } from "@/components/live/live-card";
import { listPublicLives } from "@/lib/live/live-service";
import type { LiveCard as LiveCardData } from "@/lib/live/live-types";
import { OtopSectionHeading } from "./otop-section-heading";

/**
 * Live selling on the home page: stores on air now, then upcoming lives.
 * Absent when there is neither — except in the editor's preview.
 */
export async function LiveRail({
  locale,
  title,
  subtitle,
  viewAllLabel,
  limit,
  preview,
}: {
  locale: string;
  title: string;
  subtitle: string;
  viewAllLabel: string;
  limit: number;
  preview?: boolean;
}) {
  const t = await getTranslations({ locale });
  const { live, upcoming } = await listPublicLives({ limit }).catch(() => ({ live: [], upcoming: [] }));
  const cards = [...live, ...upcoming].slice(0, limit);
  if (cards.length === 0 && !preview) return null;
  const time = (value: string | null) =>
    value
      ? new Intl.DateTimeFormat(locale, { weekday: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value))
      : "";
  const labels = (card: LiveCardData) => ({
    live: t("live.badgeLive"),
    viewers: t("live.viewersCount", { count: card.viewers }),
    products: t("live.productsCount", { count: card.productCount }),
    startsAt: t("live.startsAt", { time: time(card.scheduledAt) }),
  });

  return (
    <section className="container mx-auto px-4 py-8 sm:py-10">
      <OtopSectionHeading title={title} subtitle={subtitle} viewAllLabel={viewAllLabel} viewAllHref="/live" />
      {cards.length === 0 ? (
        <div className="flex items-center gap-3 rounded-2xl border border-dashed bg-white p-6 text-sm text-muted-foreground">
          <Radio className="size-5 text-red-500" />
          {t("live.sectionEmpty")}
        </div>
      ) : (
        <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:gap-4 [&::-webkit-scrollbar]:hidden">
          {cards.map((card) => (
            <LiveCard key={card.id} live={card} labels={labels(card)} className="w-44 shrink-0 snap-start sm:w-56" />
          ))}
        </div>
      )}
    </section>
  );
}
