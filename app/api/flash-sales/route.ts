import { NextResponse, type NextRequest } from "next/server";
import { publicFlashSales } from "@/lib/catalog/flash-sales";
import { getStorefrontProductCards } from "@/lib/products/storefront-product-cards";

export const dynamic = "force-dynamic";

/**
 * GET /api/flash-sales — sales on now and those starting within a week, for
 * the storefront's countdowns and badges. Nothing private: product ids,
 * discounts, units sold, the window and the store running it.
 *
 * `?product=<id>` answers only the sales holding that product (the product
 * page's banner). `?rail=1` answers the sale the home page features — the one
 * on now ending soonest, else the next to start — with its product cards.
 */
export async function GET(request: NextRequest) {
  try {
    const product = request.nextUrl.searchParams.get("product") ?? undefined;
    const rail = request.nextUrl.searchParams.get("rail") === "1";
    const sales = await publicFlashSales({ productId: product, limit: product ? 5 : 30 });
    const headers = { "Cache-Control": "public, max-age=30, stale-while-revalidate=60" };
    const now = new Date().toISOString();

    if (rail) {
      const sale = sales.find((entry) => entry.live && entry.items.some((item) => !item.soldOut)) ?? sales.find((entry) => !entry.live);
      const products = sale
        ? await getStorefrontProductCards({ ids: sale.items.map((item) => item.productId), limit: 100 }).catch(() => [])
        : [];
      return NextResponse.json(
        {
          success: true,
          data: { sale: sale ?? null, products: products.slice(0, 16), saleCount: sales.length, now },
        },
        { headers },
      );
    }

    return NextResponse.json({ success: true, data: { sales, now } }, { headers });
  } catch (error) {
    console.error("Failed to read flash sales:", error);
    return NextResponse.json({ success: false, message: "Unavailable" }, { status: 500 });
  }
}
