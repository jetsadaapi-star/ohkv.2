import { Suspense } from "react";
import mongoose from "mongoose";
import { BadgeCheck, Boxes, Store, Star, Tag } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { connectDB } from "@/lib/db";
import { Brand, Product } from "@/models";
import { VENDOR_PERMISSIONS } from "@/config/permissions.config";
import { requireVendorAreaAccess } from "@/lib/access/vendor-area-guard";
import { APPROVED_BRAND_CONDITION, BRAND_APPROVAL_STATUS } from "@/lib/catalog/brands";
import { serializeRows } from "@/lib/api/list-query";
import { fetchVendorBrandList } from "@/lib/vendors/vendor-brand-list";
import { Skeleton } from "@/components/ui/skeleton";
import { VendorBrandsBoard, VendorBrandsBoardSkeleton } from "@/components/vendor/brands/vendor-brands-board";
import { cn } from "@/lib/utils";

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

interface BrandStats {
  all: number;
  active: number;
  inactive: number;
  featured: number;
  pending: number;
  own: number;
  brandedProducts: number;
}

const BRAND_PAGE_SIZE = 24;

export default async function VendorBrandsPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const search = await searchParams;
  setRequestLocale(locale);

  const access = await requireVendorAreaAccess({ locale, required: [VENDOR_PERMISSIONS.VIEW_BRANDS] });
  const vendorId = String(access.vendor._id);
  const granted = new Set(access.vendorPermissions);

  // Shared by the tiles and the board's tab counts, run beside the list.
  const statsPromise = getVendorBrandStats(vendorId);

  return (
    <div className="space-y-5">
      <Suspense fallback={<BrandStatsSkeleton />}>
        <BrandStatsSection statsPromise={statsPromise} />
      </Suspense>
      <Suspense fallback={<VendorBrandsBoardSkeleton />}>
        <BrandsSection
          searchParams={search}
          vendorId={vendorId}
          statsPromise={statsPromise}
          canCreate={granted.has(VENDOR_PERMISSIONS.CREATE_BRANDS)}
          canEdit={granted.has(VENDOR_PERMISSIONS.EDIT_BRANDS)}
        />
      </Suspense>
    </div>
  );
}

/**
 * Counted over exactly what the list shows a vendor: the approved shared
 * catalogue plus every brand the vendor owns, deleted ones never. The old
 * tiles counted the whole platform's catalogue, so they disagreed with the
 * list beneath them.
 */
async function getVendorBrandStats(vendorId: string): Promise<BrandStats> {
  await connectDB();
  const vendorObjectId = new mongoose.Types.ObjectId(vendorId);
  const [[facet], brandedProducts] = await Promise.all([
    Brand.aggregate([
      {
        $match: {
          deletedAt: null,
          $or: [{ approvalStatus: APPROVED_BRAND_CONDITION }, { ownerVendorId: vendorObjectId }],
        },
      },
      {
        $facet: {
          all: [{ $count: "n" }],
          active: [{ $match: { isActive: true } }, { $count: "n" }],
          inactive: [{ $match: { isActive: false } }, { $count: "n" }],
          featured: [{ $match: { featured: true } }, { $count: "n" }],
          pending: [{ $match: { approvalStatus: BRAND_APPROVAL_STATUS.PENDING } }, { $count: "n" }],
          own: [{ $match: { ownerVendorId: vendorObjectId } }, { $count: "n" }],
        },
      },
    ]),
    Product.countDocuments({ vendorId: vendorObjectId, brand: { $ne: null } }),
  ]);
  const n = (key: string) => (facet?.[key]?.[0]?.n as number | undefined) ?? 0;
  return {
    all: n("all"),
    active: n("active"),
    inactive: n("inactive"),
    featured: n("featured"),
    pending: n("pending"),
    own: n("own"),
    brandedProducts,
  };
}

async function BrandStatsSection({ statsPromise }: { statsPromise: Promise<BrandStats> }) {
  const stats = await statsPromise;
  const t = await getTranslations("admin.hc.vendorBrands");
  const tiles = [
    { key: "all", value: stats.all, icon: Tag, tone: "from-slate-50 ring-slate-200 text-slate-700 dark:from-slate-500/10", iconTone: "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900" },
    { key: "active", value: stats.active, icon: BadgeCheck, tone: "from-emerald-50 ring-emerald-200 text-emerald-700 dark:from-emerald-500/10", iconTone: "bg-emerald-500 text-white" },
    { key: "featured", value: stats.featured, icon: Star, tone: "from-amber-50 ring-amber-200 text-amber-700 dark:from-amber-500/10", iconTone: "bg-amber-500 text-white" },
    { key: "own", value: stats.own, icon: Store, tone: "from-sky-50 ring-sky-200 text-sky-700 dark:from-sky-500/10", iconTone: "bg-sky-500 text-white" },
    { key: "brandedProducts", value: stats.brandedProducts, icon: Boxes, tone: "from-violet-50 ring-violet-200 text-violet-700 dark:from-violet-500/10", iconTone: "bg-violet-500 text-white" },
  ] as const;
  return (
    <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 sm:pb-0 xl:grid-cols-5 [&::-webkit-scrollbar]:hidden">
      {tiles.map(({ key, value, icon: Icon, tone, iconTone }) => (
        <div key={key} className={cn("flex min-w-[9.5rem] shrink-0 snap-start items-center gap-3 rounded-2xl bg-linear-to-br to-white p-3 ring-1 ring-inset sm:min-w-0 sm:p-4 dark:to-card", tone)}>
          <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl shadow-sm sm:size-10", iconTone)}>
            <Icon className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium opacity-80">{t(`stat.${key}`)}</p>
            <p className="text-xl font-extrabold tracking-tight text-foreground tabular-nums sm:text-2xl">{value.toLocaleString("th-TH")}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function BrandStatsSkeleton() {
  return (
    <div className="flex gap-3 overflow-hidden sm:grid sm:grid-cols-3 xl:grid-cols-5">
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} className="h-[64px] min-w-[9.5rem] rounded-2xl sm:h-[72px]" />
      ))}
    </div>
  );
}

/** Read through the same parser `/api/vendor/brands` uses. */
async function BrandsSection({
  searchParams,
  vendorId,
  statsPromise,
  canCreate,
  canEdit,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
  vendorId: string;
  statsPromise: Promise<BrandStats>;
  canCreate: boolean;
  canEdit: boolean;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string") params.set(key, value);
  }
  if (!params.get("limit")) params.set("limit", String(BRAND_PAGE_SIZE));
  if (!params.get("sortOrder")) params.set("sortOrder", "asc");

  const [list, stats] = await Promise.all([fetchVendorBrandList(params, vendorId), statsPromise]);

  return (
    <VendorBrandsBoard
      canCreate={canCreate}
      canEdit={canEdit}
      data={serializeRows(list.items)}
      pagination={{ page: list.page, limit: list.limit, total: list.total, totalPages: list.totalPages }}
      counts={{ all: stats.all, active: stats.active, featured: stats.featured, inactive: stats.inactive, pending: stats.pending }}
    />
  );
}
