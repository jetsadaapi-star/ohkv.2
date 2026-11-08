import mongoose from "mongoose";
import { Activity, CalendarDays, LogIn, TriangleAlert } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { AuditLog } from "@/models/audit-log.model";
import { connectDB } from "@/lib/db";
import { AdminStatsStrip } from "@/components/admin/admin-stats-strip";

/**
 * The activity log at a glance: today, the week, sign-ins and what failed.
 * A vendor's own log when `vendorScope` is given (the owner's entries alone
 * unless they may see their staff's), the whole store's otherwise.
 */
export async function ActivityTiles({
  locale,
  vendorScope,
  canViewStaff = true,
}: {
  locale: string;
  vendorScope?: { vendorId: string; ownerUserId: string };
  canViewStaff?: boolean;
}) {
  await connectDB();
  const scope: Record<string, unknown> = vendorScope
    ? {
        actorVendorId: new mongoose.Types.ObjectId(vendorScope.vendorId),
        // An aggregate does not cast: the id goes in as the ObjectId it is stored as.
        ...(canViewStaff ? {} : { userId: new mongoose.Types.ObjectId(vendorScope.ownerUserId) }),
      }
    : {};
  const startOfToday = new Date();
  // The UTC day, as the dashboard's "Today" reads it.
  startOfToday.setUTCHours(0, 0, 0, 0);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [[facet], t] = await Promise.all([
    AuditLog.aggregate<Record<string, Array<{ n: number }>>>([
      { $match: { ...scope, createdAt: { $gte: weekAgo } } },
      {
        $facet: {
          today: [{ $match: { createdAt: { $gte: startOfToday } } }, { $count: "n" }],
          week: [{ $count: "n" }],
          logins: [{ $match: { action: "LOGIN" } }, { $count: "n" }],
          failed: [{ $match: { $or: [{ success: false }, { action: "LOGIN_FAILED" }] } }, { $count: "n" }],
        },
      },
    ]),
    getTranslations({ locale, namespace: "admin.hc.vendorActivity.stats" }),
  ]);
  const n = (key: string) => (facet?.[key]?.[0]?.n ?? 0).toLocaleString(locale);

  return (
    <AdminStatsStrip
      variant="tiles"
      items={[
        { title: t("today"), value: n("today"), description: t("todayDesc"), icon: <Activity className="h-5 w-5" />, iconClassName: "text-blue-700 bg-blue-100" },
        { title: t("week"), value: n("week"), description: t("weekDesc"), icon: <CalendarDays className="h-5 w-5" />, iconClassName: "text-violet-700 bg-violet-100" },
        { title: t("logins"), value: n("logins"), description: t("loginsDesc"), icon: <LogIn className="h-5 w-5" />, iconClassName: "text-green-700 bg-green-100" },
        { title: t("failed"), value: n("failed"), description: t("failedDesc"), icon: <TriangleAlert className="h-5 w-5" />, iconClassName: "text-amber-700 bg-amber-100" },
      ]}
    />
  );
}
