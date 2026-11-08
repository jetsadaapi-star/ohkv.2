import { withApi } from "@/lib/api/handler";
import { successResponse } from "@/lib/api/response";
import { assertVendorPermission } from "@/lib/access/rbac";
import { requireApprovedVendorByUserId } from "@/lib/access/vendor-guard";
import { VENDOR_PERMISSIONS } from "@/config/permissions.config";
import { endLive } from "@/lib/live/live-service";

/** POST /api/vendor/live/:id/end */
export const POST = withApi<{ id: string }>(
  { auth: "user", rateLimit: { action: "vendor:live:end", preset: "lenient" } },
  async ({ params, session }) => {
    await assertVendorPermission(
      session.user,
      VENDOR_PERMISSIONS.EDIT_PRODUCTS,
      "You do not have permission to run lives",
    );
    const vendor = await requireApprovedVendorByUserId(session.user.id);
    return successResponse(await endLive(params.id, "store", { vendorId: String(vendor._id) }));
  },
);
