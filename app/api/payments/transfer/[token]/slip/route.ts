import { withApi } from "@/lib/api/handler";
import { ValidationError } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/response";
import { attachTransferSlip } from "@/lib/payments/transfer-orders";

/** POST /api/payments/transfer/:token/slip (multipart "file") — attach the transfer slip. */
export const POST = withApi<{ token: string }>(
  { auth: "optional", rateLimit: { action: "storefront:transfer:slip", preset: "moderate" } },
  async ({ request, params }) => {
    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) throw new ValidationError("กรุณาเลือกรูปสลิป");
    return successResponse(await attachTransferSlip(params.token, file));
  },
);
