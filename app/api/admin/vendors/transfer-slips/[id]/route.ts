import * as z from "zod";
import { withApi } from "@/lib/api/handler";
import { successResponse } from "@/lib/api/response";
import { validateBody } from "@/lib/api/validate";
import { createAuditContext } from "@/lib/audit";
import { reviewPlatformTransfer } from "@/lib/payments/platform-transfers";

const ReviewSchema = z.object({
  action: z.enum(["approve", "reject"]),
  reason: z.string().trim().max(300).optional(),
});

/** POST /api/admin/vendors/transfer-slips/:id — approve the slip (the payment is finalized) or reject it. */
export const POST = withApi<{ id: string }>(
  { auth: "admin", rateLimit: { action: "admin:vendor-transfers:review", preset: "moderate" } },
  async ({ request, params, session }) => {
    const body = await validateBody(request, ReviewSchema);
    const result = await reviewPlatformTransfer({
      paymentId: params.id,
      action: body.action,
      reason: body.reason,
      reviewerId: session.user.id,
      auditContext: createAuditContext(request, session),
    });
    return successResponse(result);
  },
);
