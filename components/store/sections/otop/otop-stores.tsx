import { BadgeCheck, MapPin, Package } from "lucide-react";
import Link from "@/components/language/link";
import { AppImage } from "@/components/ui/app-image";
import { PRODUCT_STATUS, VENDOR_STATUS } from "@/config/app.config";
import { kalasinDistrictLabel } from "@/config/kalasin-districts";
import { getStorefrontProductConstraint } from "@/lib/catalog/product-visibility";
import { connectDB } from "@/lib/db";
import { Product, Vendor } from "@/models";
import { OtopSectionHeading } from "./otop-section-heading";

type StoreRow = {
  _id: unknown;
  storeName: string;
  slug: string;
  logo?: string;
  district?: string;
  verified?: boolean;
  description?: string;
};

/**
 * Maker stores as cards that show what they make: three of the store's
 * product photos as the banner (stores rarely have a banner of their own),
 * the logo or initial, district and product count.
 */
export async function OtopStores({
  locale,
  title,
  subtitle,
  viewAllLabel,
  limit,
  productsLabel,
}: {
  locale: string;
  title: string;
  subtitle: string;
  viewAllLabel: string;
  limit: number;
  productsLabel: (count: number) => string;
}) {
  let stores: Array<StoreRow & { images: string[]; count: number }> = [];
  try {
    await connectDB();
    const constraint = await getStorefrontProductConstraint();
    const counts = await Product.aggregate<{ _id: unknown; count: number; images: string[][] }>([
      { $match: { status: PRODUCT_STATUS.ACTIVE, "images.0": { $exists: true }, ...constraint } },
      { $sort: { featured: -1, createdAt: -1 } },
      { $group: { _id: "$vendorId", count: { $sum: 1 }, images: { $push: { $slice: ["$images", 1] } } } },
      { $sort: { count: -1 } },
      { $limit: limit * 2 },
    ]);
    const vendors = await Vendor.find({
      _id: { $in: counts.map((c) => c._id) },
      status: VENDOR_STATUS.APPROVED,
      storeActive: { $ne: false },
      isDefault: { $ne: true },
    })
      .select("storeName slug logo district verified description")
      .lean<StoreRow[]>();
    const byId = new Map(vendors.map((v) => [String(v._id), v]));
    stores = counts
      .map((c) => {
        const vendor = byId.get(String(c._id));
        return vendor ? { ...vendor, count: c.count, images: c.images.flat().slice(0, 3) } : null;
      })
      .filter((s): s is StoreRow & { images: string[]; count: number } => Boolean(s))
      .slice(0, limit);
  } catch {
    return null;
  }
  if (stores.length === 0) return null;

  return (
    <section className="container mx-auto px-4 py-8 sm:py-10">
      <OtopSectionHeading title={title} subtitle={subtitle} viewAllLabel={viewAllLabel} viewAllHref="/vendors" />
      <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-3 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4 [&::-webkit-scrollbar]:hidden">
        {stores.map((store) => (
          <Link
            key={String(store._id)}
            href={`/vendors/${store.slug}`}
            className="group w-72 shrink-0 snap-start overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-xl sm:w-auto"
          >
            <span className="grid h-32 grid-cols-3 gap-0.5 bg-slate-100">
              {[0, 1, 2].map((i) => (
                <span key={i} className="relative block overflow-hidden bg-primary/5">
                  {store.images[i] ? (
                    <AppImage
                      src={store.images[i]}
                      alt=""
                      fill
                      sizes="120px"
                      className="object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                  ) : null}
                </span>
              ))}
            </span>
            <span className="relative block px-4 pb-4">
              <span className="-mt-7 flex size-14 items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-linear-to-br from-primary to-store-secondary text-lg font-bold text-white shadow-md">
                {store.logo ? (
                  <AppImage src={store.logo} alt="" width={56} height={56} className="size-full bg-white object-cover" />
                ) : (
                  store.storeName.trim().charAt(0)
                )}
              </span>
              <span className="mt-2 flex items-center gap-1 text-base font-bold text-slate-800">
                <span className="truncate">{store.storeName.trim()}</span>
                {store.verified ? <BadgeCheck className="size-4 shrink-0 text-sky-500" /> : null}
              </span>
              <span className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                {store.district ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
                    <MapPin className="size-3" />
                    {kalasinDistrictLabel(store.district, locale)}
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
                  <Package className="size-3" />
                  {productsLabel(store.count)}
                </span>
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
