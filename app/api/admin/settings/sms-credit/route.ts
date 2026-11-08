import { NextResponse } from "next/server";
import { getSettings } from "@/models";
import { withApi } from "@/lib/api/handler";
import { getThaiBulkSmsCredit, ThaiBulkSmsApiError } from "@/lib/sms/thaibulksms";

/**
 * GET /api/admin/settings/sms-credit
 *
 * The credit left on the saved ThaiBulkSMS account (Settings → SMS). Reads the
 * stored key and secret, so it answers for what is saved, not what is typed;
 * nothing is sent and nothing is billed.
 */
export const GET = withApi(
  {
    auth: "admin",
    rateLimit: { action: "admin:settings:sms-credit", preset: "strict" },
  },
  async () => {
    const settings = await getSettings();
    const tbs = settings.sms?.thaibulksms;
    const apiKey = tbs?.apiKey?.trim() || process.env.THAIBULKSMS_API_KEY?.trim();
    const apiSecret = tbs?.apiSecret?.trim() || process.env.THAIBULKSMS_API_SECRET?.trim();
    if (!apiKey || !apiSecret) {
      return NextResponse.json(
        { success: false, message: "Save the ThaiBulkSMS API Key and API Secret first." },
        { status: 400 },
      );
    }
    try {
      const credit = await getThaiBulkSmsCredit({ apiKey, apiSecret });
      return NextResponse.json({ success: true, data: { credit } });
    } catch (error) {
      const message =
        error instanceof ThaiBulkSmsApiError ? error.message : "Could not read the ThaiBulkSMS credit.";
      return NextResponse.json({ success: false, message }, { status: 502 });
    }
  },
);
