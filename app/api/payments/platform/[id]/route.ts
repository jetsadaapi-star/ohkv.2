import { withApi } from "@/lib/api/handler";
import { successResponse } from "@/lib/api/response";
import { getPlatformTransferPage } from "@/lib/payments/platform-transfers";
import { platformTransferViewer } from "@/lib/payments/platform-transfer-viewer";

/** GET /api/payments/platform/:id — a vendor's PromptPay / bank-transfer payment, as its page shows it. */
export const GET = withApi<{ id: string }>(
  { auth: "user", rateLimit: { action: "vendor:platform-transfer:read", preset: "browse" } },
  async ({ params, session }) => {
    const page = await getPlatformTransferPage(params.id, await platformTransferViewer(session.user.id));
    return successResponse(page.view);
  },
);
