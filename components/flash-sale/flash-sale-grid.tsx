"use client";

import type { ModernProduct } from "@/lib/products/modern-product";
import type { Locale } from "@/config/i18n.config";
import { FlashDealGrid, type PublicFlashSaleItem } from "./flash-sale-client";

/** A sale's products as deal cards, each with its units-sold bar. */
export function FlashSaleGrid({
  products,
  items,
  upcoming,
  startsAt,
}: {
  products: ModernProduct[];
  items: PublicFlashSaleItem[];
  locale?: Locale;
  upcoming?: boolean;
  startsAt?: string;
}) {
  return <FlashDealGrid products={products} items={items} upcoming={upcoming} startsAt={startsAt} />;
}
