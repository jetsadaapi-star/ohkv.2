import type { Metadata } from "next";
import { Zap } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import Link from "@/components/language/link";
import type { Locale } from "@/config/i18n.config";
import { buildStorefrontAlternates } from "@/lib/storefront/storefront-metadata";
import { publicFlashSales } from "@/lib/catalog/flash-sales";
import { getStorefrontProductCards } from "@/lib/products/storefront-product-cards";
import { FlashCountdown } from "@/components/flash-sale/flash-sale-client";
import { FlashSaleGrid } from "@/components/flash-sale/flash-sale-grid";
import { KHIT_TILE, SILK_GRADIENT } from "@/components/auth/silk-pattern";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "flashSale" });
  return {
    title: t("pageTitle"),
    description: t("pageSubtitle"),
    alternates: await buildStorefrontAlternates({ locale, page: "/flash-sale" }),
  };
}

/** The sale running now, with its countdown, and what is coming next. */
export default async function FlashSalePage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "flashSale" });
  const sales = await publicFlashSales().catch(() => []);
  const withProducts = await Promise.all(
    sales.slice(0, 4).map(async (sale) => ({
      sale,
      products: sale.items.length
        ? await getStorefrontProductCards({ ids: sale.items.map((item) => item.productId), limit: 100 }).catch(() => [])
        : [],
    })),
  );
  const live = withProducts.filter((entry) => entry.sale.live);
  const upcoming = withProducts.filter((entry) => !entry.sale.live);

  return (
    <div className="container mx-auto space-y-10 px-4 py-6 lg:py-10">
      <section
        className="relative isolate overflow-hidden rounded-3xl px-6 py-10 text-white shadow-xl shadow-primary/20 sm:px-10"
        style={{ background: SILK_GRADIENT }}
      >
        <span aria-hidden className="absolute inset-0 -z-10 opacity-[0.12]" style={{ backgroundImage: KHIT_TILE }} />
        <span aria-hidden className="absolute -end-16 -top-16 -z-10 size-72 rounded-full bg-[var(--highlight)]/30 blur-3xl" />
        <p className="inline-flex items-center gap-1.5 rounded-full bg-[var(--highlight)] px-3 py-1 text-sm font-extrabold italic text-[#3b2410]">
          <Zap className="size-4 fill-current" />
          FLASH SALE
        </p>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
          {live[0]?.sale.name ?? t("pageTitle")}
        </h1>
        <p className="mt-2 max-w-2xl text-white/90">{t("pageSubtitle")}</p>
        {live[0] ? (
          <p className="mt-5 inline-flex flex-wrap items-center gap-2 text-sm font-semibold">
            {t("endsIn")}
            <FlashCountdown to={live[0].sale.endsAt} className="text-base" boxClassName="bg-white text-primary" />
          </p>
        ) : null}
      </section>

      {live.length === 0 && upcoming.length === 0 ? (
        <div className="rounded-3xl border border-dashed p-10 text-center">
          <Zap className="mx-auto size-10 text-[var(--highlight)]" />
          <p className="mt-3 text-lg font-bold">{t("none")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("noneHint")}</p>
          <Link href="/products" className="mt-5 inline-flex rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">
            {t("browse")}
          </Link>
        </div>
      ) : null}

      {live.map(({ sale, products }) => (
        <section key={sale.id} className="space-y-4">
          {live.length > 1 ? (
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-bold">{sale.name}</h2>
              <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                {t("endsIn")} <FlashCountdown to={sale.endsAt} />
              </span>
            </div>
          ) : null}
          <FlashSaleGrid products={products} items={sale.items} locale={locale as Locale} />
        </section>
      ))}

      {upcoming.map(({ sale, products }) => (
        <section key={sale.id} className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-bold">
              {t("upcoming")}: {sale.name}
            </h2>
            <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              {t("startsIn")} <FlashCountdown to={sale.startsAt} />
            </span>
          </div>
          <FlashSaleGrid products={products} items={sale.items} locale={locale as Locale} upcoming />
        </section>
      ))}
    </div>
  );
}
