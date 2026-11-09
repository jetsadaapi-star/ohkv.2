import { NextResponse } from "next/server";
import { withCronRun } from "@/lib/cron/health";
import { runFlashSales } from "@/lib/catalog/flash-sales";

/**
 * Flash Sales, every minute: start what is due, end what is over, and end a
 * product early once its unit cap is reached. Guarded by CRON_SECRET, like
 * every other cron here.
 */
export const GET = withCronRun("flash-sales", async (request) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ success: true, data: await runFlashSales() });
});
