import mongoose from "mongoose";
import { Product } from "@/models";
import { connectDB } from "@/lib/db";
import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { VENDOR_PERMISSIONS } from "@/config/permissions.config";
import { requireVendorAreaAccess } from "@/lib/access/vendor-area-guard";
import { PRODUCT_STATUS } from "@/config/app.config";
import {
  VendorProductsBoard,
  VendorProductsBoardSkeleton,
} from "@/components/vendor/products/vendor-products-board";
import {
  VendorProductsStats,
  VendorProductsStatsSkeleton,
  type VendorProductsStats as VendorProductsStatsData,
} from "@/components/vendor/products/vendor-products-stats";
import { LOW_STOCK_THRESHOLD } from "@/lib/inventory/low-stock";
import { getSettingsLean } from "@/models/settings.model";
import { taxClassOptions, vendorTaxLock } from "@/lib/tax/tax-settings";
import { parsePageQuery } from "@/lib/api/validate";
import { serializeRows } from "@/lib/api/list-query";
import { AdminListQuerySchema } from "@/lib/validations/list-query";
import * as z from "zod";
import { fetchVendorProductList } from "@/lib/vendors/vendor-product-list";

const PRODUCTS_PAGE_SIZE = 24;

/** The page's query: the shared list params plus the stock filter chips. */
const VendorProductListQuerySchema = AdminListQuerySchema.extend({
  stock: z.enum(["all", "low", "out"]).optional(),
});

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}


export default async function VendorProductsPage({
  params,
  searchParams,
}: PageProps) {
  const { locale } = await params;
  const search = await searchParams;
  setRequestLocale(locale);
  const access = await requireVendorAreaAccess({
    locale,
    required: [VENDOR_PERMISSIONS.VIEW_PRODUCTS],
  });
  const vendor = access.vendor;
  const canCreateProduct =
    access.vendorPermissions.includes(VENDOR_PERMISSIONS.MANAGE_PRODUCTS) ||
    access.vendorPermissions.includes(VENDOR_PERMISSIONS.CREATE_PRODUCTS);
  const canEditProduct =
    access.vendorPermissions.includes(VENDOR_PERMISSIONS.MANAGE_PRODUCTS) ||
    access.vendorPermissions.includes(VENDOR_PERMISSIONS.EDIT_PRODUCTS);
  const canDeleteProduct =
    access.vendorPermissions.includes(VENDOR_PERMISSIONS.MANAGE_PRODUCTS) ||
    access.vendorPermissions.includes(VENDOR_PERMISSIONS.DELETE_PRODUCTS);
  // Buying a boost is gated the same way the /vendor/boosts pages and the
  // checkout API are; without this the row action walks a staff member through
  // the whole purchase dialog only to 403 at the pay button.
  const canBoostProduct = access.vendorPermissions.includes(
    VENDOR_PERMISSIONS.MANAGE_BOOSTS,
  );

  const vendorId = String(vendor._id);
  // Started once, here: the stats tiles and the grid's tab counts share this
  // one aggregation, and it runs alongside the product query.
  const statsPromise = getVendorProductStats(vendorId);

  return (
    <div className="space-y-5">
      <Suspense fallback={<VendorProductsStatsSkeleton />}>
        <VendorProductsStatsSection statsPromise={statsPromise} />
      </Suspense>
      <Suspense fallback={<VendorProductsBoardSkeleton />}>
        <VendorProductsTableSection
          locale={locale}
          searchParams={search}
          vendorId={vendorId}
          statsPromise={statsPromise}
          canCreateProduct={canCreateProduct}
          canEditProduct={canEditProduct}
          canDeleteProduct={canDeleteProduct}
          canBoostProduct={canBoostProduct}
        />
      </Suspense>
    </div>
  );
}

async function VendorProductsStatsSection({
  statsPromise,
}: {
  statsPromise: Promise<VendorProductsStatsData>;
}) {
  return <VendorProductsStats stats={await statsPromise} />;
}

async function getVendorProductStats(vendorId: string): Promise<VendorProductsStatsData> {
  await connectDB();
  const vendorObjectId = new mongoose.Types.ObjectId(vendorId);

  const [result] = await Product.aggregate([
    { $match: { vendorId: vendorObjectId } },
    {
      $project: {
        status: 1,
        stock: 1,
        variants: 1,
        inventoryCount: {
          $cond: [
            { $gt: [{ $size: { $ifNull: ["$variants", []] } }, 0] },
            {
              $sum: {
                $map: {
                  input: { $ifNull: ["$variants", []] },
                  as: "variant",
                  in: { $ifNull: ["$$variant.stock", 0] },
                },
              },
            },
            { $ifNull: ["$stock", 0] },
          ],
        },
      },
    },
    {
      $facet: {
        totalProducts: [{ $count: "count" }],
        activeProducts: [
          { $match: { status: PRODUCT_STATUS.ACTIVE } },
          { $count: "count" },
        ],
        draftProducts: [
          { $match: { status: PRODUCT_STATUS.DRAFT } },
          { $count: "count" },
        ],
        unlistedProducts: [
          { $match: { status: PRODUCT_STATUS.UNLISTED } },
          { $count: "count" },
        ],
        lowStockProducts: [
          { $match: { inventoryCount: { $gt: 0, $lte: LOW_STOCK_THRESHOLD } } },
          { $count: "count" },
        ],
        outOfStockProducts: [
          { $match: { inventoryCount: { $lte: 0 } } },
          { $count: "count" },
        ],
        totalInventoryUnits: [
          { $group: { _id: null, total: { $sum: "$inventoryCount" } } },
        ],
      },
    },
  ]);

  return {
    totalProducts: result?.totalProducts?.[0]?.count ?? 0,
    activeProducts: result?.activeProducts?.[0]?.count ?? 0,
    draftProducts: result?.draftProducts?.[0]?.count ?? 0,
    unlistedProducts: result?.unlistedProducts?.[0]?.count ?? 0,
    lowStockProducts: result?.lowStockProducts?.[0]?.count ?? 0,
    outOfStockProducts: result?.outOfStockProducts?.[0]?.count ?? 0,
    totalInventoryUnits: result?.totalInventoryUnits?.[0]?.total ?? 0,
  };
}

async function VendorProductsTableSection({
  locale,
  searchParams,
  vendorId,
  statsPromise,
  canCreateProduct,
  canEditProduct,
  canDeleteProduct,
  canBoostProduct,
}: {
  locale: string;
  searchParams: { [key: string]: string | string[] | undefined };
  vendorId: string;
  statsPromise: Promise<VendorProductsStatsData>;
  canCreateProduct: boolean;
  canEditProduct: boolean;
  canBoostProduct: boolean;
  canDeleteProduct: boolean;
}) {
  // Parsed with the schema the API route uses, so the page and the endpoint
  // can never read one query string two different ways.
  // A grid fills a row of 4–6 cards, so it pages by 24 unless the URL says.
  const query = parsePageQuery(
    { limit: String(PRODUCTS_PAGE_SIZE), ...searchParams },
    VendorProductListQuerySchema,
  );
  const [list, settings, stats] = await Promise.all([
    fetchVendorProductList(
      {
        ...query,
        lowStock: query.stock === "low",
        outOfStock: query.stock === "out",
        projection: "card",
      },
      vendorId,
    ),
    getSettingsLean(),
    statsPromise,
  ]);
  // Under "with approval" the vendor asks for a tax change for several
  // products at once from here (Settings → Tax Settings → Vendors).
  const canRequestTax = canEditProduct && vendorTaxLock(settings.tax) === "approval";

  return (
    <VendorProductsBoard
      locale={locale}
      counts={{
        all: stats.totalProducts,
        active: stats.activeProducts,
        draft: stats.draftProducts,
        unlisted: stats.unlistedProducts,
        low: stats.lowStockProducts,
        out: stats.outOfStockProducts,
      }}
      pageSize={PRODUCTS_PAGE_SIZE}
      canCreateProduct={canCreateProduct}
      canEditProduct={canEditProduct}
      canDeleteProduct={canDeleteProduct}
      canBoostProduct={canBoostProduct}
      taxClasses={canRequestTax ? taxClassOptions(settings.tax) : undefined}
      data={serializeRows(list.items)}
      pagination={{
        page: list.page,
        limit: list.limit,
        total: list.total,
        totalPages: list.totalPages,
      }}
    />
  );
}
