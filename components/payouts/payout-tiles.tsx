import mongoose from "mongoose";
import { Banknote, CircleX, Clock3, HandCoins } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Payout } from "@/models";
import { connectDB } from "@/lib/db";
import { formatCurrency } from "@/lib/intl/money";
import { getSettings } from "@/models/settings.model";
import { AdminStatsStrip } from "@/components/admin/admin-stats-strip";

/**
 * The payouts at a glance, over every payout (not the page of the list) — one
 * vendor's when `vendorId` is given, the whole marketplace's otherwise: what
 * has been paid, what is on its way, what failed. Money is read in the
 * currency most of the payouts are in.
 */
export async function PayoutTiles({ vendorId, locale }: { vendorId?: string; locale: string }) {
  await connectDB();
  const [groups, settings, t] = await Promise.all([
    Payout.aggregate<{ _id: { status: string; currency: string }; count: number; amount: number }>([
      { $match: vendorId ? { vendorId: new mongoose.Types.ObjectId(vendorId) } : {} },
      {
        $group: {
          _id: { status: "$status", currency: { $ifNull: ["$currency", ""] } },
          count: { $sum: 1 },
          amount: { $sum: { $ifNull: ["$netAmount", 0] } },
        },
      },
    ]),
    getSettings(),
    // The vendor reads them as money received, the admin as money paid out.
    getTranslations(vendorId ? "admin.hc.vendorPayouts" : "admin.hc.adminPayoutTiles"),
  ]);
  const byCurrency = new Map<string, number>();
  for (const group of groups) byCurrency.set(group._id.currency, (byCurrency.get(group._id.currency) ?? 0) + group.count);
  const currency =
    [...byCurrency.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ||
    settings.general?.defaultCurrency ||
    "USD";
  const sum = (statuses: string[], field: "count" | "amount") =>
    groups
      .filter((group) => statuses.includes(group._id.status) && (field === "count" || group._id.currency === currency || !group._id.currency))
      .reduce((total, group) => total + group[field], 0);

  return (
    <AdminStatsStrip
      variant="tiles"
      items={[
        {
          title: t("paid"),
          value: formatCurrency(sum(["paid"], "amount"), currency, locale),
          description: t("paidDesc", { count: sum(["paid"], "count") }),
          icon: <HandCoins className="h-5 w-5" />,
          iconClassName: "text-green-700 bg-green-100",
        },
        {
          title: t("onTheWay"),
          value: formatCurrency(sum(["pending", "processing"], "amount"), currency, locale),
          description: t("onTheWayDesc", { count: sum(["pending", "processing"], "count") }),
          icon: <Clock3 className="h-5 w-5" />,
          iconClassName: "text-amber-700 bg-amber-100",
        },
        {
          title: t("count"),
          value: sum(["pending", "processing", "paid", "failed", "cancelled"], "count").toLocaleString(),
          description: t("countDesc"),
          icon: <Banknote className="h-5 w-5" />,
          iconClassName: "text-violet-700 bg-violet-100",
        },
        {
          title: t("failed"),
          value: sum(["failed"], "count").toLocaleString(),
          description: t("failedDesc"),
          icon: <CircleX className="h-5 w-5" />,
          iconClassName: "text-rose-700 bg-rose-100",
        },
      ]}
    />
  );
}

