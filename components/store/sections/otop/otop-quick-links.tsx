import { BadgePercent, Clapperboard, Crown, MapPin, Radio, Store } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "@/components/language/link";
import { listPublicLives } from "@/lib/live/live-service";
import { cn } from "@/lib/utils";

/**
 * Six big doors under the hero — the ways this marketplace is different (live
 * selling, review clips, districts) next to the usual ones (deals, premium,
 * stores). The live tile pulses when a store is on air.
 */
export async function OtopQuickLinks({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "otopTheme.quick" });
  const { live } = await listPublicLives({ limit: 24 }).catch(() => ({ live: [], upcoming: [] }));
  const items = [
    { href: "/live", icon: Radio, label: t("live"), hint: live.length ? t("liveNow", { count: live.length }) : t("liveHint"), tone: "from-red-500 to-rose-600", pulse: live.length > 0 },
    { href: "/clips", icon: Clapperboard, label: t("clips"), hint: t("clipsHint"), tone: "from-pink-500 to-fuchsia-600" },
    { href: "/zones", icon: MapPin, label: t("zones"), hint: t("zonesHint"), tone: "from-primary to-store-secondary" },
    { href: "/products?onSale=true", icon: BadgePercent, label: t("deals"), hint: t("dealsHint"), tone: "from-amber-400 to-orange-500" },
    { href: "/products?category=otop-premium", icon: Crown, label: t("premium"), hint: t("premiumHint"), tone: "from-violet-500 to-purple-600" },
    { href: "/vendors", icon: Store, label: t("stores"), hint: t("storesHint"), tone: "from-sky-500 to-blue-600" },
  ];
  return (
    <section className="container mx-auto px-4 pt-8 sm:pt-10">
      <div className="grid grid-cols-3 gap-2.5 sm:gap-4 lg:grid-cols-6">
        {items.map(({ href, icon: Icon, label, hint, tone, pulse }) => (
          <Link
            key={href}
            href={href}
            className="group flex flex-col items-center gap-2 rounded-3xl border border-slate-100 bg-white p-3 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-200 hover:shadow-lg sm:flex-row sm:p-3.5 sm:text-start"
          >
            <span className={cn("relative flex size-12 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br text-white shadow-md sm:size-13", tone)}>
              <Icon className="size-6" />
              {pulse ? (
                <span className="absolute -end-1 -top-1 flex size-3.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex size-3.5 rounded-full border-2 border-white bg-red-500" />
                </span>
              ) : null}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold text-slate-800 sm:text-[15px] sm:whitespace-nowrap">{label}</span>
              <span className={cn("hidden truncate text-xs sm:block", pulse ? "font-semibold text-red-600" : "text-slate-500")}>{hint}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
