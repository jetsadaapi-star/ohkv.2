import type { Metadata } from "next";
import { ArrowRight, MapPin, Store } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import Link from "@/components/language/link";
import { StoreBreadcrumb } from "@/components/store/store-breadcrumb";
import {
  KALASIN_DISTRICTS,
  KALASIN_PROVINCE,
} from "@/config/kalasin-districts";
import { getLocaleRouting } from "@/lib/i18n/locale-routing";
import { buildStorefrontAlternates } from "@/lib/storefront/storefront-metadata";
import { getDistrictStoreCounts } from "@/lib/zones/zone-data";
import { ZONE_TONES } from "@/components/zones/zone-tones";
import { cn } from "@/lib/utils";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return {
    title: t("zones.title"),
    description: t("zones.subtitle"),
    alternates: await buildStorefrontAlternates({ locale, page: "/zones" }),
  };
}

/** Every Kalasin district, each a way into its stores and their products. */
export default async function ZonesPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [{ storeDefault }, t, counts] = await Promise.all([
    getLocaleRouting(),
    getTranslations({ locale }),
    getDistrictStoreCounts(),
  ]);
  const th = locale === "th";
  const totalStores = Object.values(counts).reduce((sum, n) => sum + (n ?? 0), 0);
  const activeZones = KALASIN_DISTRICTS.filter((d) => (counts[d.code] ?? 0) > 0).length;

  return (
    <div className="container mx-auto px-4 py-8 lg:py-12">
      <StoreBreadcrumb
        className="mb-4"
        locale={locale}
        storeDefault={storeDefault}
        items={[{ label: t("zones.title") }]}
      />

      <section className="relative isolate mb-10 overflow-hidden rounded-3xl bg-linear-to-br from-emerald-600 via-teal-600 to-sky-600 px-6 py-10 text-white shadow-lg shadow-emerald-600/20 sm:px-10 sm:py-14">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-24 -z-10 size-80 rounded-full bg-white/15 blur-3xl"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-24 left-1/4 -z-10 size-72 rounded-full bg-amber-300/25 blur-3xl"
        />
        <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold ring-1 ring-inset ring-white/25">
          <MapPin className="size-3.5" />
          {th ? `จังหวัด${KALASIN_PROVINCE.th}` : `${KALASIN_PROVINCE.en} Province`}
        </p>
        <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
          {t("zones.title")}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-white/85 sm:text-base">
          {t("zones.subtitle")}
        </p>
        <div className="mt-6 flex flex-wrap gap-3 text-sm">
          <span className="rounded-xl bg-white/15 px-4 py-2 font-semibold ring-1 ring-inset ring-white/20">
            {t("zones.statDistricts", { count: KALASIN_DISTRICTS.length })}
          </span>
          <span className="rounded-xl bg-white/15 px-4 py-2 font-semibold ring-1 ring-inset ring-white/20">
            {t("zones.statStores", { count: totalStores })}
          </span>
          <span className="rounded-xl bg-white/15 px-4 py-2 font-semibold ring-1 ring-inset ring-white/20">
            {t("zones.statActive", { count: activeZones })}
          </span>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {KALASIN_DISTRICTS.map((district, index) => {
          const count = counts[district.code] ?? 0;
          const tone = ZONE_TONES[index % ZONE_TONES.length];
          return (
            <Link
              key={district.code}
              href={`/zones/${district.code}`}
              className={cn(
                "group relative isolate flex items-center gap-4 overflow-hidden rounded-2xl border bg-linear-to-br p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
                tone.card,
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "pointer-events-none absolute -right-6 -top-8 -z-10 size-24 rounded-full blur-2xl",
                  tone.glow,
                )}
              />
              <span
                className={cn(
                  "flex size-12 shrink-0 items-center justify-center rounded-xl text-white shadow-md",
                  tone.icon,
                )}
              >
                <MapPin className="size-6" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-bold text-foreground">
                  {th ? `อ.${district.th}` : district.en}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {th ? district.en : district.th}
                </span>
                <span
                  className={cn(
                    "mt-1.5 inline-flex items-center gap-1 text-xs font-semibold",
                    count > 0 ? tone.text : "text-muted-foreground",
                  )}
                >
                  <Store className="size-3.5" />
                  {count > 0
                    ? t("zones.storeCount", { count })
                    : t("zones.noStoresShort")}
                </span>
              </span>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
