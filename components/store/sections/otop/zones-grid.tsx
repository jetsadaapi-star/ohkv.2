import { MapPin, Store } from "lucide-react";
import Link from "@/components/language/link";
import { KALASIN_DISTRICTS } from "@/config/kalasin-districts";
import { ZONE_TONES } from "@/components/zones/zone-tones";
import { getDistrictStoreCounts } from "@/lib/zones/zone-data";
import { cn } from "@/lib/utils";
import { OtopSectionHeading } from "./otop-section-heading";

/** "Shop by district": the 18 Kalasin districts as tiles, each with its store count. */
export async function ZonesGrid({
  locale,
  title,
  subtitle,
  viewAllLabel,
  onlyWithStores,
  limit,
  labels,
}: {
  locale: string;
  title: string;
  subtitle: string;
  viewAllLabel: string;
  onlyWithStores: boolean;
  limit: number;
  labels: { stores: (count: number) => string; soon: string };
}) {
  const counts = await getDistrictStoreCounts();
  const th = locale === "th";
  const zones = KALASIN_DISTRICTS.map((zone, index) => ({
    ...zone,
    count: counts[zone.code] ?? 0,
    tone: ZONE_TONES[index % ZONE_TONES.length],
  }))
    .filter((zone) => !onlyWithStores || zone.count > 0)
    // Districts with stores first, in their own order otherwise.
    .sort((a, b) => Number(b.count > 0) - Number(a.count > 0))
    .slice(0, Math.max(1, limit));

  if (zones.length === 0) return null;

  return (
    <section className="container mx-auto px-4 py-8 sm:py-10">
      <OtopSectionHeading
        title={title}
        subtitle={subtitle}
        viewAllLabel={viewAllLabel}
        viewAllHref="/zones"
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {zones.map((zone) => (
          <Link
            key={zone.code}
            href={`/zones/${zone.code}`}
            className="group flex flex-col items-center gap-2 rounded-2xl border border-border/70 bg-white p-4 text-center shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md dark:bg-card"
          >
            <span
              className={cn(
                "flex size-12 items-center justify-center rounded-2xl text-white shadow-md transition-transform group-hover:scale-105",
                zone.tone.icon,
              )}
            >
              <MapPin className="size-6" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold text-foreground">
                {th ? zone.th : zone.en}
              </span>
              <span
                className={cn(
                  "mt-0.5 inline-flex items-center gap-1 text-xs font-medium",
                  zone.count > 0 ? zone.tone.text : "text-muted-foreground",
                )}
              >
                <Store className="size-3" />
                {zone.count > 0 ? labels.stores(zone.count) : labels.soon}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
