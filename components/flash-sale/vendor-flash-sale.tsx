import { publicFlashSales, type PublicFlashSale } from "@/lib/catalog/flash-sales";
import { getStorefrontProductCards } from "@/lib/products/storefront-product-cards";
import { FlashShowcase } from "@/components/flash-sale/flash-sale-client";

/**
 * A store's page: its deals in the Flash Sale on now — the store's own sale
 * or the marketplace's with the store's products in it — else the next one.
 * Nothing when the store has no deal running or coming this week.
 */
export async function VendorFlashSale({
  vendorId,
  vendorSlug,
  title,
}: {
  vendorId: string;
  vendorSlug: string;
  title: string;
}) {
  const sales = await publicFlashSales({ limit: 30 }).catch(() => [] as PublicFlashSale[]);
  if (sales.length === 0) return null;

  // One read of the store's products across every round, then pick the round.
  const ids = [...new Set(sales.flatMap((sale) => sale.items.map((item) => item.productId)))];
  const cards = await getStorefrontProductCards({ ids, vendorId, limit: 120 }).catch(() => []);
  if (cards.length === 0) return null;
  const mine = new Set(cards.map((card) => String(card._id)));

  const rank = (sale: PublicFlashSale) => sale.items.filter((item) => mine.has(item.productId) && !item.soldOut).length;
  const sale =
    sales.filter((entry) => entry.live && rank(entry) > 0).sort((a, b) => rank(b) - rank(a))[0] ??
    sales.find((entry) => !entry.live && rank(entry) > 0);
  if (!sale) return null;

  const products = cards.filter((card) => sale.items.some((item) => item.productId === String(card._id)));
  return (
    <FlashShowcase
      sale={sale}
      products={products}
      href={`/flash-sale?sale=${sale.id}&vendor=${encodeURIComponent(vendorSlug)}`}
      title={sale.vendor ? sale.name : title}
      className="mt-6 sm:mt-8"
    />
  );
}
