import { locale as rootLocale } from "next/root-params";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/config/i18n.config";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductSkeleton } from "@/components/products/product-grid";

// Route-level fallback shown instantly on navigation while the server resolves
// the collection + product query. Mirrors the page layout (breadcrumb,
// collection header, sort toolbar, product grid) so content swaps in with
// minimal layout shift.
export default async function CollectionDetailLoading() {
  // Locale from the root param, not the request: see (home)/loading.tsx.
  const t = await getTranslations({
    locale: (await rootLocale()) as Locale,
    namespace: "storeText.collectionDetailLoading",
  });

  return (
    <div className="container mx-auto px-4 py-8" aria-busy="true">
      <p className="sr-only" aria-live="polite">
        {t("loading")}
      </p>

      <Skeleton className="mb-6 h-5 w-64 max-w-full" />

      <div className="mb-8 space-y-4">
        <Skeleton className="h-9 w-72 max-w-full" />
        <Skeleton className="h-5 w-full max-w-2xl" />
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-10 w-[180px]" />
        </div>
      </div>

      <ProductSkeleton count={12} />
    </div>
  );
}
