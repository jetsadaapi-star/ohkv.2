import type { Metadata } from "next";
import { Clapperboard, Radio } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import Link from "@/components/language/link";
import { LiveCard } from "@/components/live/live-card";
import { LiveTopRanking } from "@/components/live/live-top-ranking";
import { buildStorefrontAlternates } from "@/lib/storefront/storefront-metadata";
import { listPublicLives } from "@/lib/live/live-service";
import type { LiveCard as LiveCardData } from "@/lib/live/live-types";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return {
    title: t("live.feedTitle"),
    description: t("live.feedSubtitle"),
    alternates: await buildStorefrontAlternates({ locale, page: "/live" }),
  };
}

/** Stores live now, and the lives coming up. */
export default async function LivePage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  const { live, upcoming } = await listPublicLives({ limit: 24 }).catch(() => ({ live: [], upcoming: [] }));
  const time = (value: string | null) =>
    value
      ? new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value))
      : "";
  const labels = (card: LiveCardData) => ({
    live: t("live.badgeLive"),
    viewers: t("live.viewersCount", { count: card.viewers }),
    products: t("live.productsCount", { count: card.productCount }),
    startsAt: t("live.startsAt", { time: time(card.scheduledAt) }),
  });

  return (
    <div className="container mx-auto space-y-10 px-4 py-6 lg:py-10">
      <section className="relative isolate overflow-hidden rounded-3xl bg-linear-to-br from-rose-600 via-red-500 to-amber-500 px-6 py-10 text-white shadow-xl sm:px-10">
        <span aria-hidden className="absolute -end-10 -top-16 -z-10 size-72 rounded-full bg-white/15 blur-3xl" />
        <span aria-hidden className="absolute -bottom-24 start-1/3 -z-10 size-72 rounded-full bg-amber-300/30 blur-3xl" />
        <p className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-bold ring-1 ring-inset ring-white/30">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-white opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-white" />
          </span>
          {t("live.badgeLive")}
        </p>
        <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">{t("live.feedTitle")}</h1>
        <p className="mt-2 max-w-2xl text-white/90">{t("live.feedSubtitle")}</p>
      </section>

      <section>
        <h2 className="mb-4 flex items-center gap-2 text-xl font-bold">
          <Radio className="size-5 text-red-600" />
          {t("live.liveNow")}
        </h2>
        {live.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed bg-white px-6 py-14 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-500">
              <Radio className="size-7" />
            </span>
            <p className="font-semibold">{t("live.noLive")}</p>
            <p className="text-sm text-muted-foreground">{t("live.noLiveHint")}</p>
            <Link
              href="/clips"
              className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white"
            >
              <Clapperboard className="size-4" />
              {t("live.watchClips")}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {live.map((card) => (
              <LiveCard key={card.id} live={card} labels={labels(card)} />
            ))}
          </div>
        )}
      </section>

      <LiveTopRanking
        locale={locale}
        title={t("live.topTitle")}
        subtitle={t("live.topSubtitle")}
        className="px-0 py-0 sm:py-0"
      />

      {upcoming.length > 0 ? (
        <section>
          <h2 className="mb-4 text-xl font-bold">{t("live.upcoming")}</h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {upcoming.map((card) => (
              <LiveCard key={card.id} live={card} labels={labels(card)} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
