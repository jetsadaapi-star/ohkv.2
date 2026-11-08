import "server-only";
import { unstable_cache } from "next/cache";
import { PRODUCT_STATUS, VENDOR_STATUS } from "@/config/app.config";
import { getStorefrontProductConstraint } from "@/lib/catalog/product-visibility";
import {
  isKalasinDistrictCode,
  KALASIN_DISTRICTS,
  type KalasinDistrictCode,
} from "@/config/kalasin-districts";
import { CACHE_TAGS } from "@/lib/cache-invalidation";
import { connectDB } from "@/lib/db";
import { withFallback } from "@/lib/storefront/cached-read";
import { Product, Vendor } from "@/models";

/**
 * What the storefront knows about its zones (Kalasin districts).
 *
 * Only stores a shopper can buy from count: approved and not deactivated —
 * the same rule the product grid applies to a vendor's listing. The marketplace's
 * own default store counts too when it has a district, since its products are
 * on sale like anyone's.
 *
 * Cached for five minutes under the products tag, which every vendor save
 * already expires (`revalidateProductContent`), so a store that picks its
 * district shows up under it on the next request.
 */

const LIVE_STORE_FILTER = {
  status: VENDOR_STATUS.APPROVED,
  storeActive: { $ne: false },
} as const;

export type DistrictStoreCounts = Partial<Record<KalasinDistrictCode, number>>;

export const getDistrictStoreCounts = withFallback(
  unstable_cache(
    async (): Promise<DistrictStoreCounts> => {
      await connectDB();
      const rows = await Vendor.aggregate<{ _id: string; count: number }>([
        {
          $match: {
            ...LIVE_STORE_FILTER,
            district: { $in: KALASIN_DISTRICTS.map((d) => d.code) },
          },
        },
        { $group: { _id: "$district", count: { $sum: 1 } } },
      ]);
      const counts: DistrictStoreCounts = {};
      for (const row of rows) {
        if (isKalasinDistrictCode(row._id)) counts[row._id] = row.count;
      }
      return counts;
    },
    ["zones:district-store-counts"],
    { revalidate: 300, tags: [CACHE_TAGS.products] },
  ),
  (): DistrictStoreCounts => ({}),
);

export interface ZoneStore {
  id: string;
  storeName: string;
  slug: string;
  logo?: string;
  banner?: string;
  description?: string;
  verified: boolean;
  isDefault: boolean;
}

export const getDistrictStores = withFallback(
  unstable_cache(
    async (district: string): Promise<ZoneStore[]> => {
      if (!isKalasinDistrictCode(district)) return [];
      await connectDB();
      const vendors = await Vendor.find({ ...LIVE_STORE_FILTER, district })
        .select("storeName slug logo banner description verified isDefault")
        .sort({ verified: -1, storeName: 1 })
        .limit(120)
        .lean<
          Array<{
            _id: unknown;
            storeName: string;
            slug: string;
            logo?: string;
            banner?: string;
            description?: string;
            verified?: boolean;
            isDefault?: boolean;
          }>
        >();
      return vendors.map((vendor) => ({
        id: String(vendor._id),
        storeName: vendor.storeName,
        slug: vendor.slug,
        logo: vendor.logo || undefined,
        banner: vendor.banner || undefined,
        description: vendor.description || undefined,
        verified: vendor.verified === true,
        isDefault: vendor.isDefault === true,
      }));
    },
    ["zones:district-stores"],
    { revalidate: 300, tags: [CACHE_TAGS.products] },
  ),
  (): ZoneStore[] => [],
);

export interface MarketplaceStats {
  stores: number;
  products: number;
  districts: number;
}

/** The hero's headline numbers: live stores, products on sale, districts with a store. */
export const getMarketplaceStats = withFallback(
  unstable_cache(
    async (): Promise<MarketplaceStats> => {
      await connectDB();
      const [counts, products] = await Promise.all([
        getDistrictStoreCounts(),
        Product.countDocuments({
          status: PRODUCT_STATUS.ACTIVE,
          ...(await getStorefrontProductConstraint()),
        }),
      ]);
      const stores = await Vendor.countDocuments(LIVE_STORE_FILTER);
      return {
        stores,
        products,
        districts: Object.values(counts).filter((n) => (n ?? 0) > 0).length,
      };
    },
    ["zones:marketplace-stats"],
    { revalidate: 300, tags: [CACHE_TAGS.products] },
  ),
  (): MarketplaceStats => ({ stores: 0, products: 0, districts: 0 }),
);
