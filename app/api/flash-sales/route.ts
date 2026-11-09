import { NextResponse } from "next/server";
import { publicFlashSales } from "@/lib/catalog/flash-sales";

export const dynamic = "force-dynamic";

/**
 * GET /api/flash-sales — sales on now and those starting within a week, for
 * the storefront's countdowns and badges. Nothing private: product ids,
 * discounts, units sold and the window.
 */
export async function GET() {
  try {
    const sales = await publicFlashSales();
    return NextResponse.json(
      { success: true, data: { sales, now: new Date().toISOString() } },
      { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=60" } },
    );
  } catch (error) {
    console.error("Failed to read flash sales:", error);
    return NextResponse.json({ success: false, message: "Unavailable" }, { status: 500 });
  }
}
