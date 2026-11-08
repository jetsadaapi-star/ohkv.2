import { locale as rootLocale } from "next/root-params";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/config/i18n.config";
import { Skeleton } from "@/components/ui/skeleton";

// Route-level fallback shown instantly on navigation to an order, so the user
// sees the page frame + skeleton immediately instead of a frozen previous page
// while the segment loads. Mirrors order/[id]/page.tsx (back link + details).
export default async function OrderDetailLoading() {
  // Locale from the root param, not the request: see (home)/loading.tsx.
  const t = await getTranslations({
    locale: (await rootLocale()) as Locale,
    namespace: "storeText.accountOrderDetailLoading",
  });

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl" aria-busy="true">
      <p className="sr-only" aria-live="polite">
        {t("loading")}
      </p>

      <div className="mb-6">
        <Skeleton className="h-9 w-32" />
      </div>

      <div className="space-y-6">
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-6 w-24" />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-4">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-24 w-full" />
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <Skeleton className="h-6 w-24" />
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
