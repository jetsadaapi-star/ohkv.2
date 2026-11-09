"use client";

import { ModernProductCard } from "@/components/products/modern-product-card";
import { CARD_GRID_GAP } from "@/components/store/product-grid-columns";
import type { ModernProduct } from "@/lib/products/modern-product";
import type { Locale } from "@/config/i18n.config";
import { FlashSoldBar, type PublicFlashSaleItem } from "./flash-sale-client";

/** A sale's products as storefront cards, each with its units-sold bar. */
export function FlashSaleGrid({
  products,
  items,
  locale,
  upcoming,
}: {
  products: ModernProduct[];
  items: PublicFlashSaleItem[];
  locale: Locale;
  upcoming?: boolean;
}) {
  const byId = new Map(items.map((item) => [item.productId, item]));
  return (
    <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 ${CARD_GRID_GAP}`}>
      {products.map((product) => {
        const item = byId.get(String(product._id));
        return (
          <div key={String(product._id)} className="relative space-y-2">
            {item ? (
              <span className="absolute start-2 top-2 z-10 rounded-full bg-[var(--primary)] px-2 py-0.5 text-xs font-extrabold text-white shadow">
                -{item.discountPercent}%
              </span>
            ) : null}
            <ModernProductCard product={product} locale={locale} showQuickView />
            {item && !upcoming ? <FlashSoldBar item={item} /> : null}
          </div>
        );
      })}
    </div>
  );
}
