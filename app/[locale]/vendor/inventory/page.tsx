import { Suspense } from "react";
import mongoose from "mongoose";
import { setRequestLocale } from "next-intl/server";
import { connectDB } from "@/lib/db";
import { Product } from "@/models";
import { InventoryLocation } from "@/models/inventory-location.model";
import { offShelfStockTotals } from "@/lib/inventory/stock-breakdown";
import {
  locationOwnerFilter,
  vendorLocationScope,
} from "@/lib/inventory/inventory-location-scope";
import { LOW_STOCK_THRESHOLD } from "@/lib/inventory/low-stock";
import { VENDOR_PERMISSIONS } from "@/config/permissions.config";
import { requireVendorAreaAccess } from "@/lib/access/vendor-area-guard";
import { serializeRows } from "@/lib/api/list-query";
import { INVENTORY_DEFAULT_PAGE_SIZE } from "@/lib/inventory/inventory-list";
import { fetchVendorInventoryList } from "@/lib/vendors/vendor-inventory-list";
import {
  VendorInventoryStats,
  VendorInventoryStatsSkeleton,
  type VendorInventoryStatsData,
} from "@/components/vendor/inventory/vendor-inventory-stats";
import {
  VendorInventoryBoard,
  VendorInventoryBoardSkeleton,
} from "@/components/vendor/inventory/vendor-inventory-board";

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function VendorInventoryPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const search = await searchParams;
  setRequestLocale(locale);

  const access = await requireVendorAreaAccess({
    locale,
    required: [VENDOR_PERMISSIONS.VIEW_PRODUCTS],
  });
  const vendorId = String(access.vendor._id);
  const canEditInventory =
    access.vendorPermissions.includes(VENDOR_PERMISSIONS.MANAGE_PRODUCTS) ||
    access.vendorPermissions.includes(VENDOR_PERMISSIONS.EDIT_PRODUCTS);

  // Started once and shared: the stat tiles and the board's tab counts read
  // the same figures, and they run alongside the stock list.
  const statsPromise = getVendorInventoryStats(vendorId);

  return (
    <div className="space-y-5">
      <Suspense fallback={<VendorInventoryStatsSkeleton />}>
        <StatsSection statsPromise={statsPromise} />
      </Suspense>
      <Suspense fallback={<VendorInventoryBoardSkeleton />}>
        <BoardSection
          locale={locale}
          searchParams={search}
          vendorId={vendorId}
          statsPromise={statsPromise}
          readOnly={!canEditInventory}
        />
      </Suspense>
    </div>
  );
}

async function StatsSection({ statsPromise }: { statsPromise: Promise<VendorInventoryStatsData> }) {
  return <VendorInventoryStats stats={await statsPromise} />;
}

async function BoardSection({
  locale,
  searchParams,
  vendorId,
  statsPromise,
  readOnly,
}: {
  locale: string;
  searchParams: { [key: string]: string | string[] | undefined };
  vendorId: string;
  statsPromise: Promise<VendorInventoryStatsData>;
  readOnly: boolean;
}) {
  // Read through the same parser the API route uses.
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string") params.set(key, value);
  }
  if (!params.get("limit")) params.set("limit", String(INVENTORY_DEFAULT_PAGE_SIZE));

  const [list, stats] = await Promise.all([fetchVendorInventoryList(params, vendorId), statsPromise]);

  return (
    <VendorInventoryBoard
      locale={locale}
      readOnly={readOnly}
      data={serializeRows(list.items)}
      pagination={{ page: list.page, limit: list.limit, total: list.total, totalPages: list.totalPages }}
      locations={list.locations}
      counts={{
        all: stats.totalSkus,
        in: stats.totalSkus - stats.outOfStockSkus,
        low: stats.lowStockSkus,
        out: stats.outOfStockSkus,
      }}
    />
  );
}

/**
 * Counted in the database: one row per sellable unit (each variant, or the
 * product itself when it has none). It used to read every product and its
 * variants into the server just to count them.
 */
async function getVendorInventoryStats(vendorId: string): Promise<VendorInventoryStatsData> {
  await connectDB();
  const vendorObjectId = new mongoose.Types.ObjectId(vendorId);

  const [[counts], activeLocations, offShelf] = await Promise.all([
    Product.aggregate<{ total: number; out: number; low: number; units: number }>([
      { $match: { vendorId: vendorObjectId } },
      {
        $project: {
          qty: {
            $cond: [
              { $gt: [{ $size: { $ifNull: ["$variants", []] } }, 0] },
              { $map: { input: "$variants", as: "v", in: { $ifNull: ["$$v.stock", 0] } } },
              [{ $ifNull: ["$stock", 0] }],
            ],
          },
        },
      },
      { $unwind: "$qty" },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          out: { $sum: { $cond: [{ $lte: ["$qty", 0] }, 1, 0] } },
          low: {
            $sum: {
              $cond: [{ $and: [{ $gt: ["$qty", 0] }, { $lte: ["$qty", LOW_STOCK_THRESHOLD] }] }, 1, 0],
            },
          },
          units: { $sum: "$qty" },
        },
      },
    ]),
    // This vendor's own locations only.
    InventoryLocation.countDocuments(
      locationOwnerFilter(vendorLocationScope(vendorId), { isActive: true }),
    ),
    offShelfStockTotals({ vendorId }),
  ]);

  return {
    totalSkus: counts?.total ?? 0,
    lowStockSkus: counts?.low ?? 0,
    outOfStockSkus: counts?.out ?? 0,
    // Physical units, as a shelf count finds them.
    onHandUnits: (counts?.units ?? 0) + offShelf.committed + offShelf.unavailable,
    activeLocations,
  };
}
