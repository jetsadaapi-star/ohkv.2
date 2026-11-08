import { ArrowRight, BadgeCheck, MapPin, Package, Radio, Search, Store, Truck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "@/components/language/link";
import { AppImage } from "@/components/ui/app-image";
import { PRODUCT_STATUS } from "@/config/app.config";
import { getStorefrontProductConstraint } from "@/lib/catalog/product-visibility";
import { connectDB } from "@/lib/db";
import { listPublicLives } from "@/lib/live/live-service";
import { getMarketplaceStats } from "@/lib/zones/zone-data";
import { Product } from "@/models";

/**
 * A woven diamond (ลายขิด) motif, tiled behind the hero — a nod to Kalasin's
 * Praewa silk. Inline SVG so it costs no request.
 */
const KHIT_PATTERN = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='56' height='56' viewBox='0 0 56 56'><g fill='none' stroke='#fff' stroke-width='1.2'><path d='M28 4 52 28 28 52 4 28Z'/><path d='M28 14 42 28 28 42 14 28Z'/><path d='M28 23 33 28 28 33 23 28Z' fill='#fff'/></g><g fill='#fff'><circle cx='0' cy='0' r='2'/><circle cx='56' cy='0' r='2'/><circle cx='0' cy='56' r='2'/><circle cx='56' cy='56' r='2'/></g></svg>`,
)}")`;

/** A few of the catalogue's featured products, for the photo mosaic. */
async function heroProducts(): Promise<Array<{ id: string; slug: string; name: string; image: string }>> {
  try {
    await connectDB();
    const rows = await Product.find({
      status: PRODUCT_STATUS.ACTIVE,
      "images.0": { $exists: true },
      ...(await getStorefrontProductConstraint()),
    })
      .sort({ featured: -1, price: -1 })
      .select("name slug images vendorId")
      .limit(24)
      .lean<Array<{ _id: unknown; name: string; slug: string; images?: string[]; vendorId?: unknown }>>();
    // One per store, so the mosaic shows the marketplace's range.
    const seen = new Set<string>();
    const picked: Array<{ id: string; slug: string; name: string; image: string }> = [];
    for (const row of rows) {
      const vendor = String(row.vendorId ?? "");
      const image = row.images?.[0];
      if (!image || seen.has(vendor)) continue;
      seen.add(vendor);
      picked.push({ id: String(row._id), slug: row.slug, name: row.name, image });
      if (picked.length === 4) break;
    }
    return picked;
  } catch {
    return [];
  }
}

/**
 * The OTOP theme's opening: who the marketplace is, a search box, two ways in,
 * the numbers that make a local marketplace credible, and its products in
 * pictures. When a store is live it says so right here.
 */
export async function OtopHero({
  locale,
  eyebrow,
  title,
  subtitle,
  primaryLabel,
  primaryHref,
  secondaryLabel,
  secondaryHref,
  image,
  showStats,
  labels,
}: {
  locale: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel: string;
  secondaryHref: string;
  image?: string;
  showStats: boolean;
  labels: { stores: string; products: string; districts: string };
}) {
  const t = await getTranslations({ locale });
  const [stats, products, lives] = await Promise.all([
    showStats ? getMarketplaceStats() : Promise.resolve(null),
    image ? Promise.resolve([]) : heroProducts(),
    listPublicLives({ limit: 1 }).catch(() => ({ live: [], upcoming: [] })),
  ]);
  const onAir = lives.live[0];

  return (
    <section className="container mx-auto px-4 pt-4 sm:pt-6">
      <div className="relative isolate overflow-hidden rounded-[32px] bg-linear-to-br from-store-secondary via-primary to-primary text-white shadow-2xl shadow-store-secondary/30">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-[0.07]"
          style={{ backgroundImage: KHIT_PATTERN }}
        />
        <span aria-hidden className="pointer-events-none absolute -right-32 -top-40 -z-10 size-[28rem] rounded-full bg-highlight/12 blur-3xl" />
        <span aria-hidden className="pointer-events-none absolute -bottom-40 left-1/4 -z-10 size-[26rem] rounded-full bg-highlight/10 blur-3xl" />
        {/* A gold woven border along the bottom edge. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-2 bg-[repeating-linear-gradient(90deg,var(--highlight)_0_14px,color-mix(in_oklab,var(--highlight)_55%,white)_14px_20px,var(--store-secondary)_20px_26px)] opacity-90"
        />

        <div className="grid items-center gap-10 px-6 py-10 sm:px-10 sm:py-14 lg:grid-cols-[1.1fr_1fr] lg:gap-14 lg:px-14 lg:py-16">
          <div>
            {eyebrow ? (
              <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-highlight ring-1 ring-inset ring-white/20 sm:text-sm">
                <BadgeCheck className="size-4" />
                {eyebrow}
              </p>
            ) : null}
            <h1 className="mt-5 text-[2rem] font-bold leading-[1.25] tracking-tight sm:text-5xl sm:leading-[1.2]">
              {title}
            </h1>
            <span aria-hidden className="mt-4 block h-1.5 w-24 rounded-full bg-linear-to-r from-highlight/60 to-highlight" />
            {subtitle ? (
              <p className="mt-5 max-w-xl text-base leading-relaxed text-white/85 sm:text-lg">{subtitle}</p>
            ) : null}

            <form action={`/${locale}/products`} method="get" className="mt-7 flex max-w-xl items-center gap-2 rounded-2xl bg-white p-1.5 shadow-xl shadow-black/30">
              <Search className="ms-3 size-5 shrink-0 text-primary" />
              <input
                name="search"
                type="search"
                placeholder={t("common.searchForProducts")}
                className="h-11 min-w-0 flex-1 bg-transparent text-base text-slate-900 placeholder:text-slate-400 focus:outline-none"
              />
              <button
                type="submit"
                className="h-11 shrink-0 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-store-secondary"
              >
                {t("common.search")}
              </button>
            </form>

            <div className="mt-5 flex flex-wrap gap-3">
              {primaryLabel ? (
                <Link
                  href={primaryHref || "/products"}
                  className="group inline-flex h-12 items-center gap-2 rounded-full bg-highlight px-6 text-sm font-bold text-highlight-foreground shadow-lg shadow-black/25 transition-transform hover:-translate-y-0.5 sm:text-base"
                >
                  {primaryLabel}
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100" />
                </Link>
              ) : null}
              {secondaryLabel ? (
                <Link
                  href={secondaryHref || "/zones"}
                  className="inline-flex h-12 items-center gap-2 rounded-full bg-white/10 px-6 text-sm font-semibold ring-1 ring-inset ring-white/30 backdrop-blur transition-colors hover:bg-white/20 sm:text-base"
                >
                  <MapPin className="size-4" />
                  {secondaryLabel}
                </Link>
              ) : null}
            </div>

            {stats ? (
              <dl className="mt-8 flex flex-wrap gap-x-8 gap-y-4 border-t border-white/15 pt-6">
                {[
                  { icon: Store, label: labels.stores, value: stats.stores },
                  { icon: Package, label: labels.products, value: stats.products },
                  { icon: MapPin, label: labels.districts, value: 18 },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-center gap-3">
                    <span className="flex size-11 items-center justify-center rounded-2xl bg-white/10 text-highlight ring-1 ring-inset ring-white/15">
                      <Icon className="size-5" />
                    </span>
                    <div>
                      <dd className="text-2xl font-bold leading-none">{value.toLocaleString(locale)}</dd>
                      <dt className="mt-1 text-xs text-white/75">{label}</dt>
                    </div>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>

          {/* Right: the merchant's own picture, or the products themselves. */}
          <div className="relative">
            {image ? (
              <div className="relative aspect-4/3 overflow-hidden rounded-3xl ring-4 ring-white/15">
                <AppImage src={image} alt="" fill sizes="(min-width:1024px) 40vw, 90vw" className="object-cover" priority />
              </div>
            ) : products.length >= 3 ? (
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                {products.map((product, index) => (
                  <Link
                    key={product.id}
                    href={`/products/${product.slug}`}
                    className={`group relative overflow-hidden rounded-3xl bg-white shadow-2xl ring-4 ring-white/15 ${
                      index % 2 === 1 ? "translate-y-6 sm:translate-y-10" : ""
                    } ${index > 1 ? "hidden sm:block" : ""}`}
                  >
                    <span className="relative block aspect-square">
                      <AppImage
                        src={product.image}
                        alt={product.name}
                        fill
                        sizes="(min-width:1024px) 20vw, 45vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                        priority={index < 2}
                      />
                    </span>
                    <span className="absolute inset-x-2 bottom-2 line-clamp-1 rounded-xl bg-white/90 px-2.5 py-1 text-xs font-semibold text-slate-800 backdrop-blur">
                      {product.name}
                    </span>
                  </Link>
                ))}
              </div>
            ) : null}

            {/* Floating promises */}
            <div className="pointer-events-none absolute -left-3 top-6 hidden items-center gap-2 rounded-2xl bg-white px-3.5 py-2.5 text-slate-800 shadow-xl lg:flex">
              <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Truck className="size-5" />
              </span>
              <span className="text-sm font-semibold leading-tight">{t("otopTheme.heroDirect")}</span>
            </div>
            {onAir ? (
              <Link
                href={`/live/${onAir.id}`}
                className="absolute -top-4 right-2 z-10 flex max-w-[260px] items-center gap-2.5 rounded-2xl bg-white p-2 pe-4 text-slate-800 shadow-2xl ring-2 ring-red-500 sm:-top-5"
              >
                <span className="relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-red-600 text-white">
                  {onAir.coverUrl || onAir.productImages[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={onAir.coverUrl || onAir.productImages[0]} alt="" className="size-full object-cover" />
                  ) : (
                    <Radio className="size-5" />
                  )}
                  <span className="absolute inset-x-0 bottom-0 bg-red-600 text-center text-[9px] font-bold text-white">
                    {t("live.badgeLive")}
                  </span>
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1 text-[11px] font-bold text-red-600">
                    <span className="size-1.5 animate-pulse rounded-full bg-red-600" />
                    {t("otopTheme.heroLiveNow")}
                  </span>
                  <span className="block truncate text-sm font-semibold">{onAir.store.name}</span>
                </span>
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
