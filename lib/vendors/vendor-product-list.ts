import type { Types } from "mongoose";
import { Product } from "@/models";
import { connectDB } from "@/lib/db";
import { lowStockProductMatch } from "@/lib/inventory/low-stock";
import {
  countForQuery,
  listResult,
  resolveListSort,
  type ListResult,
} from "@/lib/api/list-query";

/**
 * Vendor product list query.
 *
 * Shared by `GET /api/vendor/products` and the vendor products page's server
 * component so the endpoint and the rendered page always agree on what a
 * given query string means.
 *
 * Separate from `lib/product-list.ts`: the admin list spans every vendor,
 * carries the vendor/source filters and builds the vendor filter options,
 * none of which apply to a seller looking at its own catalogue.
 */

const SORT_FIELDS = [
  "createdAt",
  "updatedAt",
  "name",
  "price",
  "stock",
  "status",
];

/**
 * List views render neither long-form copy nor SEO metadata, and products
 * carry a lot of both.
 *
 * NOTE: this narrows what `GET /api/vendor/products` returns — the admin
 * equivalent has always excluded these, the vendor one did not. The endpoint's
 * only caller is the vendor products table, which reads none of them, but any
 * new client (a mobile app) should fetch a single product for the full record.
 */
const LIST_EXCLUDE = "-description -shortDescription -seo -attributes";

/**
 * Exactly what a product card draws — the vendor products page asks for this
 * instead of the whole document: one image, no variant detail beyond stock
 * and price, no long text. A product with many photos and variants was
 * otherwise sent whole for every row on the page.
 */
const CARD_PROJECTION: Record<string, number | { $slice: number }> = {
  name: 1,
  title: 1,
  slug: 1,
  sku: 1,
  price: 1,
  comparePrice: 1,
  stock: 1,
  status: 1,
  featured: 1,
  category: 1,
  publishing: 1,
  createdAt: 1,
  updatedAt: 1,
  "variants.stock": 1,
  "variants.price": 1,
  "inventory.tracked": 1,
  "shipping.isPhysicalProduct": 1,
  images: { $slice: 1 },
};

interface VendorProductListParams {
  page: number;
  limit: number;
  search?: string;
  status?: string;
  /** Only products low on stock (lib/inventory/low-stock.ts): the business app's list. */
  lowStock?: boolean;
  /** Further conditions every product must meet: the business app's category, brand and collection filters. */
  narrowing?: Record<string, unknown>[];
  /** Only products with nothing left to sell. */
  outOfStock?: boolean;
  /** "card": only the fields the vendor products grid draws. */
  projection?: "card";
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export async function fetchVendorProductList(
  params: VendorProductListParams,
  vendorId: Types.ObjectId | string,
): Promise<ListResult<unknown>> {
  await connectDB();

  const { page, limit, search, status, lowStock, outOfStock, narrowing, projection, sortBy, sortOrder } = params;
  const query: Record<string, unknown> = { vendorId };

  // `search` arrives regex-escaped from SafeSearchSchema.
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { sku: { $regex: search, $options: "i" } },
    ];
  }
  if (status && status !== "all") query.status = status;
  const and = [
    ...(lowStock ? [lowStockProductMatch()] : []),
    ...(outOfStock ? [{ stock: { $lte: 0 } }] : []),
    ...(narrowing ?? []),
  ];
  if (and.length) query.$and = and;

  const sort = resolveListSort({
    sortBy,
    sortOrder,
    allowed: SORT_FIELDS,
    // Price, stock, status and name all repeat across a catalogue, so they
    // need the `_id` tiebreaker to page deterministically.
    unique: ["createdAt", "updatedAt"],
  });

  const [products, total] = await Promise.all([
    Product.find(query)
      .select(projection === "card" ? CARD_PROJECTION : LIST_EXCLUDE)
      .populate("category", "name slug")
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    countForQuery(Product, query),
  ]);

  return listResult(products as unknown[], page, limit, total);
}
