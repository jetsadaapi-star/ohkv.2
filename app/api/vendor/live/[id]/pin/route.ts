import * as z from "zod";
import { Types } from "mongoose";
import { withApi } from "@/lib/api/handler";
import { successResponse } from "@/lib/api/response";
import { validateBody } from "@/lib/api/validate";
import { assertVendorPermission } from "@/lib/access/rbac";
import { requireApprovedVendorByUserId } from "@/lib/access/vendor-guard";
import { VENDOR_PERMISSIONS } from "@/config/permissions.config";
import { pinLiveProduct } from "@/lib/live/live-service";

const PinSchema = z.object({
  productId: z
    .string()
    .refine((v) => Types.ObjectId.isValid(v), { message: "Invalid product" })
    .nullable(),
});

/** POST /api/vendor/live/:id/pin — show one product over the stream (null unpins). */
export const POST = withApi<{ id: string }>(
  { auth: "user" },
  async ({ request, params, session }) => {
    await assertVendorPermission(
      session.user,
      VENDOR_PERMISSIONS.EDIT_PRODUCTS,
      "You do not have permission to run lives",
    );
    const vendor = await requireApprovedVendorByUserId(session.user.id);
    const { productId } = await validateBody(request, PinSchema);
    return successResponse(
      await pinLiveProduct(params.id, productId, { vendorId: String(vendor._id) }),
    );
  },
);
