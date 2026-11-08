import { Layers, Settings2 } from "lucide-react";
import Link from "@/components/language/link";
import { Button } from "@/components/ui/button";
import { VendorPageHeader } from "@/components/vendor/vendor-page-header";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { connectDB } from "@/lib/db";
import { Vendor, VendorPlan, VendorSubscription } from "@/models";
import { getSettings } from "@/models/settings.model";
import { Card, CardContent } from "@/components/ui/card";
import { VendorPlansContent } from "@/components/admin/vendor-plans/vendor-plans-content";
import type { AdminVendorPlan } from "@/components/admin/vendor-plans/types";
import { requireAdminPageAccess } from "@/lib/access/admin-page-guard";
import { ACTIVE_SUBSCRIPTION_STATUSES } from "@/config/app.config";
import {
  packsFromPlanCapabilities,
  type VendorPlanCapabilityInput,
} from "@/config/permissions.config";
import { getExternalVendorFilter } from "@/lib/vendors/multi-vendor";
import { DEFAULT_VENDOR_COMMISSION_RATE } from "@/lib/orders/order-settings";

interface PageProps {
  params: Promise<{ locale: string }>;
}

type CountRow = { _id: unknown; count: number };

function countsById(rows: CountRow[]): Map<string, number> {
  return new Map(rows.map((row) => [String(row._id), row.count]));
}

export default async function AdminVendorPlansPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  await requireAdminPageAccess(locale);

  await connectDB();
  const settings = await getSettings();
  const plansEnabled = Boolean(
    settings.multiVendorMode?.enabled && settings.vendorConfig?.plansEnabled,
  );

  if (!plansEnabled) {
    const [t, tc] = await Promise.all([
      getTranslations("admin.hc.vendorPlansPage"),
      getTranslations("admin.hc.vendorPlansContent"),
    ]);
    return (
      <div className="space-y-5">
        <VendorPageHeader icon={<Layers />} tone="violet" title={tc("title")} description={tc("subtitle")} />
        <Card className="rounded-2xl border-dashed shadow-sm">
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300">
              <Layers className="size-6" />
            </span>
            <h2 className="text-lg font-bold">{t("plansOffTitle")}</h2>
            <p className="max-w-md text-sm text-muted-foreground">
              {t("plansOffDescription")}
            </p>
            <Button asChild className="mt-1 rounded-full bg-emerald-600 text-white hover:bg-emerald-700">
              <Link href="/admin/vendors/configuration">
                <Settings2 className="size-4" />
                {t("openConfiguration")}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const raw = await VendorPlan.find()
    .sort({ sortOrder: 1, createdAt: -1 })
    .lean();
  const planIds = raw.map((p) => p._id);

  // Who is on each plan: the same two things the plan DELETE refuses on, so
  // the menu can say why before the admin clicks. The house store is no one's
  // customer and sells commission-free, so it is not a commission-only vendor.
  const [vendorRows, subscriptionRows, commissionOnlyVendors] = await Promise.all([
    Vendor.aggregate<CountRow>([
      { $match: { planId: { $in: planIds } } },
      { $group: { _id: "$planId", count: { $sum: 1 } } },
    ]),
    VendorSubscription.aggregate<CountRow>([
      {
        $match: {
          planId: { $in: planIds },
          status: { $in: ACTIVE_SUBSCRIPTION_STATUSES },
        },
      },
      { $group: { _id: "$planId", count: { $sum: 1 } } },
    ]),
    Vendor.countDocuments({ ...getExternalVendorFilter(), planId: null }),
  ]);
  const vendorCounts = countsById(vendorRows);
  const subscriptionCounts = countsById(subscriptionRows);

  const storeCurrency = settings.general?.defaultCurrency || "USD";
  const configuredDefaultId = settings.vendorConfig?.defaultPlanId || null;

  const plans: AdminVendorPlan[] = raw.map((p) => {
    const id = String(p._id);
    const price = p.price ?? 0;
    const paid = p.billingInterval !== "none" && price > 0;
    return {
      id,
      name: p.name,
      description: p.description || undefined,
      price,
      currency: String(p.stripePriceCurrency || storeCurrency).toUpperCase(),
      billingInterval: p.billingInterval,
      commissionRate: p.commissionRate ?? 0,
      trialDays: p.trialDays ?? 0,
      features: Array.isArray(p.features) ? p.features : [],
      limits: {
        products: p.limits?.products ?? null,
        staff: p.limits?.staff ?? null,
      },
      packs: packsFromPlanCapabilities(
        p.capabilities as VendorPlanCapabilityInput | null | undefined,
      ),
      isDefault: Boolean(p.isDefault),
      status: p.status,
      stripeMissing:
        paid &&
        p.status === "active" &&
        !(p.stripePriceId && p.stripePriceActive),
      vendorCount: vendorCounts.get(id) ?? 0,
      activeSubscriptionCount: subscriptionCounts.get(id) ?? 0,
      configuredDefault: configuredDefaultId === id,
    };
  });

  return (
    <VendorPlansContent
      locale={locale}
      plans={plans}
      commissionOnly={{
        vendorCount: commissionOnlyVendors,
        rate:
          settings.orders?.commission?.vendorRate ??
          DEFAULT_VENDOR_COMMISSION_RATE,
      }}
    />
  );
}
