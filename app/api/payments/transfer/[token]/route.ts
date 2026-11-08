import { withApi } from "@/lib/api/handler";
import { notFoundResponse, successResponse } from "@/lib/api/response";
import { getTransferPaymentView, sweepTransferExpiry } from "@/lib/payments/transfer-orders";

/**
 * GET /api/payments/transfer/:token — the payment page's state, polled while
 * the shopper pays. The token is the capability: it names one order and shows
 * only the amount, where to pay and the review status.
 */
export const GET = withApi<{ token: string }>(
  { auth: "optional", rateLimit: { action: "storefront:transfer:view", preset: "browse" } },
  async ({ params }) => {
    sweepTransferExpiry();
    const view = await getTransferPaymentView(params.token);
    if (!view) return notFoundResponse("Payment");
    return successResponse(view);
  },
);
