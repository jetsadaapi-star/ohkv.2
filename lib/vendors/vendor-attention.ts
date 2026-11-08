import "server-only";
import { Types } from "mongoose";
import { Product } from "@/models";
import { connectDB } from "@/lib/db";
import { LOW_STOCK_THRESHOLD, lowStockProductMatch } from "@/lib/inventory/low-stock";
import { fetchReturnStats } from "@/lib/returns/return-stats";
import { fetchVendorQuoteStats } from "@/lib/quotes/quotes";
import { fetchVendorOrderList } from "@/lib/vendors/vendor-order-list";
import type { VendorAttention } from "@/lib/vendors/vendor-dashboard-types";

/**
 * What is waiting on the vendor right now, for the dashboard's "Needs
 * attention" panel. Each figure is read by the same reader as the page it
 * links to, so the panel and that page never disagree. Not period-driven:
 * work waiting is waiting whatever span the charts show.
 */
export async function getVendorAttention(
  vendorId: Types.ObjectId | string,
): Promise<VendorAttention> {
  await connectDB();
  const id = String(vendorId);
  const settle = <T>(promise: Promise<T>, fallback: T) => promise.catch(() => fallback);
  const [toFulfill, returns, quotes, lowStock, outOfStock] = await Promise.all([
    settle(
      fetchVendorOrderList({ page: 1, limit: 1, view: "unfulfilled" }, id).then((list) => list.total),
      0,
    ),
    settle(fetchReturnStats({ vendorId: id }).then((stats) => stats.needsReview), 0),
    settle(fetchVendorQuoteStats(id).then((stats) => stats.needsReply), 0),
    Product.countDocuments({
      vendorId: new Types.ObjectId(id),
      ...lowStockProductMatch(),
      stock: { $gt: 0, $lte: LOW_STOCK_THRESHOLD },
    }),
    Product.countDocuments({
      vendorId: new Types.ObjectId(id),
      ...lowStockProductMatch(),
      stock: { $lte: 0 },
    }),
  ]);
  return { toFulfill, returnsToReview: returns, quotesToReply: quotes, lowStock, outOfStock };
}
