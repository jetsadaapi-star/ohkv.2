import { ArrowUpRight, Shapes } from "lucide-react";
import Link from "@/components/language/link";
import { AppImage } from "@/components/ui/app-image";
import { connectDB } from "@/lib/db";
import { Category } from "@/models";
import { OtopSectionHeading } from "./otop-section-heading";

const TONES = [
  "from-primary/5 to-primary/15 text-store-secondary",
  "from-amber-50 to-amber-100/70 text-amber-900",
  "from-rose-50 to-rose-100/70 text-rose-900",
  "from-sky-50 to-sky-100/70 text-sky-900",
  "from-violet-50 to-violet-100/70 text-violet-900",
  "from-lime-50 to-lime-100/70 text-lime-900",
  "from-orange-50 to-orange-100/70 text-orange-900",
  "from-teal-50 to-teal-100/70 text-teal-900",
];

/**
 * The top-level categories as soft coloured tiles with their photo and how
 * many products each holds — those with products and a picture first.
 */
export async function OtopCategories({
  title,
  subtitle,
  viewAllLabel,
  limit,
  productsLabel,
}: {
  title: string;
  subtitle: string;
  viewAllLabel: string;
  limit: number;
  productsLabel: (count: number) => string;
}) {
  let categories: Array<{ _id: unknown; name: string; slug: string; image?: string; productCount?: number }> = [];
  try {
    await connectDB();
    categories = await Category.find({ isActive: { $ne: false }, parentId: null })
      .select("name slug image productCount order")
      .sort({ order: 1, name: 1 })
      .lean<typeof categories>();
  } catch {
    return null;
  }
  categories = categories
    .sort((a, b) => Number(Boolean(b.image)) - Number(Boolean(a.image)) || (b.productCount ?? 0) - (a.productCount ?? 0))
    .slice(0, limit);
  if (categories.length === 0) return null;

  return (
    <section className="container mx-auto px-4 py-8 sm:py-10">
      <OtopSectionHeading title={title} subtitle={subtitle} viewAllLabel={viewAllLabel} viewAllHref="/categories" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-6">
        {categories.map((category, index) => (
          <Link
            key={String(category._id)}
            href={`/products?category=${category.slug}`}
            className={`group relative flex aspect-[4/5] flex-col overflow-hidden rounded-3xl bg-linear-to-br p-4 transition-all hover:-translate-y-0.5 hover:shadow-lg ${TONES[index % TONES.length]}`}
          >
            <span className="relative z-10">
              <span className="line-clamp-2 text-sm font-bold leading-snug sm:text-base">{category.name.replace(/\s+/g, " ")}</span>
              {category.productCount ? (
                <span className="mt-0.5 block text-xs opacity-70">{productsLabel(category.productCount)}</span>
              ) : null}
            </span>
            <span className="relative mt-auto block h-3/5">
              {category.image ? (
                <AppImage
                  src={category.image}
                  alt=""
                  fill
                  sizes="(min-width:1280px) 14vw, (min-width:640px) 30vw, 45vw"
                  className="object-contain drop-shadow-xl transition-transform duration-500 group-hover:scale-110"
                />
              ) : (
                <span className="flex size-full items-center justify-center">
                  <Shapes className="size-14 opacity-30" />
                </span>
              )}
            </span>
            <span className="absolute end-3 top-3 flex size-7 items-center justify-center rounded-full bg-white/70 opacity-0 transition-opacity group-hover:opacity-100">
              <ArrowUpRight className="size-4" />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
