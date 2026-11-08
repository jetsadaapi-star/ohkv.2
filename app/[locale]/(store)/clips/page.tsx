import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ClipFeed } from "@/components/clips/clip-feed";
import { buildStorefrontAlternates } from "@/lib/storefront/storefront-metadata";
import { listClipFeed } from "@/lib/clips/clips-service";

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return {
    title: t("clips.feedTitle"),
    description: t("clips.feedSubtitle"),
    alternates: await buildStorefrontAlternates({ locale, page: "/clips" }),
  };
}

/**
 * Product review clips — full screen on phones, a three-column player on
 * desktop (components/clips/clip-feed.tsx). `?start=<id>` opens on one clip,
 * `?saved=1` shows the shopper's saved clips.
 */
export default async function ClipsPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, search] = await Promise.all([getTranslations({ locale }), searchParams]);
  const start = Array.isArray(search.start) ? search.start[0] : search.start;
  const saved = Boolean(Array.isArray(search.saved) ? search.saved[0] : search.saved);
  const feed = saved
    ? { items: [], nextCursor: null }
    : await listClipFeed({ startId: start ?? null }).catch(() => ({ items: [], nextCursor: null }));

  return (
    <>
      <h1 className="sr-only lg:hidden">{t("clips.feedTitle")}</h1>
      <ClipFeed
        key={saved ? "saved" : "feed"}
        initialItems={feed.items}
        initialCursor={feed.nextCursor}
        mode={saved ? "saved" : "feed"}
      />
    </>
  );
}
