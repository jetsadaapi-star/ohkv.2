import { withApi } from "@/lib/api/handler";
import { ValidationError } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/response";
import { attachPlatformTransferSlip } from "@/lib/payments/platform-transfers";
import { platformTransferViewer } from "@/lib/payments/platform-transfer-viewer";

/** POST /api/payments/platform/:id/slip (multipart "file") — the vendor's transfer slip. */
export const POST = withApi<{ id: string }>(
  { auth: "user", rateLimit: { action: "vendor:platform-transfer:slip", preset: "moderate" } },
  async ({ request, params, session }) => {
    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) throw new ValidationError("กรุณาเลือกรูปสลิป");
    return successResponse(
      await attachPlatformTransferSlip(params.id, await platformTransferViewer(session.user.id), file),
    );
  },
);
