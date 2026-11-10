import { withApi } from "@/lib/api/handler";
import { successResponse } from "@/lib/api/response";
import { listPlatformTransfers } from "@/lib/payments/platform-transfers";

/** GET /api/admin/vendors/transfer-slips?filter=reviewing|all — vendors' PromptPay / bank-transfer payments. */
export const GET = withApi(
  { auth: "admin", rateLimit: { action: "admin:vendor-transfers:list", preset: "lenient" } },
  async ({ request }) => {
    const filter = new URL(request.url).searchParams.get("filter") === "all" ? "all" : "reviewing";
    return successResponse({ transfers: await listPlatformTransfers(filter) });
  },
);
