import * as z from "zod";
import { isValidObjectId } from "mongoose";
import { NextRequest } from "next/server";
import { withApi } from "@/lib/api/handler";
import { ValidationError } from "@/lib/api/errors";
import { notFoundResponse, successResponse } from "@/lib/api/response";
import { validateBody } from "@/lib/api/validate";
import { STAFF_PERMISSIONS } from "@/config/permissions.config";
import {
  getTransferAdminState,
  recordTransferReview,
  revertTransferApproval,
} from "@/lib/payments/transfer-orders";
import { PUT as updateOrder } from "@/app/api/admin/orders/[id]/route";

/** GET /api/admin/orders/:id/transfer — the PromptPay / bank-transfer state and slip. */
export const GET = withApi<{ id: string }>(
  {
    auth: "admin-or-staff",
    staffPermissions: [STAFF_PERMISSIONS.VIEW_ORDERS],
    rateLimit: { action: "admin:orders:transfer:view", preset: "browse" },
  },
  async ({ params }) => {
    if (!isValidObjectId(params.id)) return notFoundResponse("Order");
    const state = await getTransferAdminState(params.id);
    if (!state) return notFoundResponse("Transfer payment");
    return successResponse(state);
  },
);

const DecisionSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  reason: z.string().trim().max(300).optional(),
});

/**
 * POST /api/admin/orders/:id/transfer {decision, reason}
 *
 * Approve: the slip is recorded as checked and the order is marked paid
 * through PUT /api/admin/orders/:id — the same path, checks and bookkeeping
 * as marking any order paid by hand. Reject: the shopper is asked for
 * another slip.
 */
export const POST = withApi<{ id: string }>(
  {
    auth: "admin-or-staff",
    staffPermissions: [STAFF_PERMISSIONS.EDIT_ORDERS, STAFF_PERMISSIONS.MANAGE_ORDERS],
    rateLimit: { action: "admin:orders:transfer:review", preset: "moderate" },
  },
  async ({ request, params, session }) => {
    if (!isValidObjectId(params.id)) return notFoundResponse("Order");
    const { decision, reason } = await validateBody(request, DecisionSchema);
    const reviewer = session.user.email || session.user.id;

    if (decision === "rejected") {
      await recordTransferReview({ orderId: params.id, decision, reason, reviewer });
      return successResponse(await getTransferAdminState(params.id));
    }

    await recordTransferReview({ orderId: params.id, decision, reviewer });
    const forwarded = new Headers(request.headers);
    forwarded.delete("content-length");
    forwarded.set("content-type", "application/json");
    const res = await updateOrder(
      new NextRequest(new URL(`/api/admin/orders/${params.id}`, request.url), {
        method: "PUT",
        headers: forwarded,
        body: JSON.stringify({ paymentStatus: "paid" }),
      }),
      { params: Promise.resolve({ id: params.id }) },
    );
    if (!res.ok) {
      await revertTransferApproval(params.id);
      const json = await res.json().catch(() => null);
      throw new ValidationError(json?.message || json?.error || "ยืนยันการชำระเงินไม่สำเร็จ");
    }
    return successResponse(await getTransferAdminState(params.id));
  },
);
