import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ArrowLeft, BadgeCheck, MapPin, Package, Store } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import Link from "@/components/language/link";
import { AppImage } from "@/components/ui/app-image";
import { StoreBreadcrumb } from "@/components/store/store-breadcrumb";
import { ProductGrid } from "@/components/products/product-grid";
import { ProductSkeleton } from "@/components/products/product-skeleton";
import { type Locale } from "@/config/i18n.config";
import {
  getKalasinDistrict,
  KALASIN_PROVINCE,
  kalasinDistrictLabel,
} from "@/config/kalasin-districts";
import { getLocaleRouting } from "@/lib/i18n/locale-routing";
import { buildStorefrontAlternates } from "@/lib/storefront/storefront-metadata";
import { getDistrictStores, type ZoneStore } from "@/lib/zones/zone-data";

interface PageProps {
  params: Promise<{ locale: string; district: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

const PAGE_SIZE = 24;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, district } = await params;
  const zone = getKalasinDistrict(district);
  if (!zone) return {};
  const t = await getTranslations({ locale });
  const name = kalasinDistrictLabel(zone.code, locale);
  return {
    title: t("zones.districtTitle", { district: name }),
    description: t("zones.districtSubtitle", { district: name }),
    alternates: await buildStorefrontAlternates({
      locale,
      page: `/zones/${zone.code}`,
    }),
  };
}

export default async function DistrictPage({ params, searchParams }: PageProps) {
  const { locale, district } = await params;
  const zone = getKalasinDistrict(district);
  if (!zone) notFound();
  setRequestLocale(locale);

  const [{ storeDefault }, t, search, stores] = await Promise.all([
    getLocaleRouting(),
    getTranslations({ locale }),
    searchParams,
    getDistrictStores(zone.code),
  ]);
  const th = locale === "th";
  const name = kalasinDistrictLabel(zone.code, locale);
  const rawPage = Number(Array.isArray(search.page) ? search.page[0] : search.page);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
  // The marketplace's own store has no store page of its own to link to.
  const sellerStores = stores.filter((store) => !store.isDefault);

  return (
    <div className="container mx-auto px-4 py-8 lg:py-12">
      <StoreBreadcrumb
        className="mb-4"
        locale={locale}
        storeDefault={storeDefault}
        items={[
          { label: t("zones.title"), href: "/zones" },
          { label: name },
        ]}
      />

      <section className="relative isolate mb-10 overflow-hidden rounded-3xl bg-linear-to-br from-emerald-600 via-teal-600 to-sky-600 px-6 py-8 text-white shadow-lg shadow-emerald-600/20 sm:px-10 sm:py-10">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-20 -z-10 size-72 rounded-full bg-white/15 blur-3xl"
        />
        <Link
          href="/zones"
          className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold ring-1 ring-inset ring-white/25 transition-colors hover:bg-white/25"
        >
          <ArrowLeft className="size-3.5 rtl:-scale-x-100" />
          {t("zones.allZones")}
        </Link>
        <h1 className="mt-4 flex items-center gap-3 text-3xl font-bold tracking-tight sm:text-4xl">
          <MapPin className="size-8 shrink-0 text-amber-200" aria-hidden />
          {th ? `อำเภอ${zone.th}` : `${zone.en} District`}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-white/85 sm:text-base">
          {th
            ? `${zone.en} · จังหวัด${KALASIN_PROVINCE.th}`
            : `${zone.th} · ${KALASIN_PROVINCE.en} Province`}
        </p>
        <p className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold ring-1 ring-inset ring-white/20">
          <Store className="size-4" />
          {t("zones.storeCount", { count: stores.length })}
        </p>
      </section>

      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 text-xl font-bold tracking-tight">
          <span
            aria-hidden
            className="h-6 w-1 rounded-full bg-linear-to-b from-emerald-500 to-sky-500"
          />
          {t("zones.districtStores", { district: name })}
        </h2>
        {sellerStores.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed py-12 text-center">
            <Store className="size-10 text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground">{t("zones.noStores")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {sellerStores.map((store) => (
              <ZoneStoreCard
                key={store.id}
                store={store}
                verifiedLabel={t("vendor.storefront.verified")}
                visitLabel={t("product.visitStore")}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-4 flex items-center gap-2 text-xl font-bold tracking-tight">
          <span
            aria-hidden
            className="h-6 w-1 rounded-full bg-linear-to-b from-emerald-500 to-sky-500"
          />
          <Package className="size-5 text-emerald-600" aria-hidden />
          {t("zones.districtProducts", { district: name })}
        </h2>
        <Suspense
          key={page}
          fallback={<ProductSkeleton count={8} />}
        >
          <ProductGrid
            locale={locale as Locale}
            district={zone.code}
            page={page}
            limit={PAGE_SIZE}
            emptyMessage={t("zones.noProducts")}
          />
        </Suspense>
      </section>
    </div>
  );
}

function ZoneStoreCard({
  store,
  verifiedLabel,
  visitLabel,
}: {
  store: ZoneStore;
  verifiedLabel: string;
  visitLabel: string;
}) {
  return (
    <Link
      href={`/vendors/${store.slug}`}
      className="group overflow-hidden rounded-2xl border bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative aspect-293/120 w-full overflow-hidden bg-linear-to-br from-emerald-100 to-sky-100 dark:from-emerald-950 dark:to-sky-950">
        {store.banner ? (
          <AppImage
            src={store.banner}
            alt=""
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Store className="size-8 text-emerald-600/40" aria-hidden />
          </div>
        )}
      </div>
      <div className="flex items-center gap-3 p-4">
        <div className="relative -mt-10 size-14 shrink-0 overflow-hidden rounded-2xl border-2 border-white bg-background shadow-md">
          {store.logo ? (
            <AppImage src={store.logo} alt="" fill className="object-cover" sizes="56px" />
          ) : (
            <div className="flex h-full items-center justify-center bg-linear-to-br from-emerald-500 to-sky-500 text-lg font-bold text-white">
              {store.storeName.trim().charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-1.5 text-[15px] font-semibold leading-5">
            <span className="truncate">{store.storeName}</span>
            {store.verified ? (
              <BadgeCheck
                className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                aria-label={verifiedLabel}
              />
            ) : null}
          </h3>
          <p className="mt-0.5 text-xs font-medium text-emerald-700 group-hover:underline dark:text-emerald-300">
            {visitLabel}
          </p>
        </div>
      </div>
    </Link>
  );
}
