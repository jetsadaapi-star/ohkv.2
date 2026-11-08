import { withApi } from "@/lib/api/handler";
import { successResponse } from "@/lib/api/response";
import { validateBody } from "@/lib/api/validate";
import { assertVendorPermission } from "@/lib/access/rbac";
import { requireApprovedVendorByUserId } from "@/lib/access/vendor-guard";
import { VENDOR_PERMISSIONS } from "@/config/permissions.config";
import {
  ClipInputSchema,
  deleteClip,
  getClip,
  updateClip,
} from "@/lib/clips/clips-service";

/** GET /api/vendor/clips/:id */
export const GET = withApi<{ id: string }>(
  { auth: "user" },
  async ({ params, session }) => {
    await assertVendorPermission(
      session.user,
      VENDOR_PERMISSIONS.VIEW_PRODUCTS,
      "You do not have permission to view clips",
    );
    const vendor = await requireApprovedVendorByUserId(session.user.id);
    return successResponse(await getClip(params.id, { vendorId: String(vendor._id) }));
  },
);

/** PUT /api/vendor/clips/:id */
export const PUT = withApi<{ id: string }>(
  { auth: "user", rateLimit: { action: "vendor:clips:update", preset: "moderate" } },
  async ({ request, params, session }) => {
    await assertVendorPermission(
      session.user,
      VENDOR_PERMISSIONS.EDIT_PRODUCTS,
      "You do not have permission to edit clips",
    );
    const vendor = await requireApprovedVendorByUserId(session.user.id);
    const body = await validateBody(request, ClipInputSchema);
    const clip = await updateClip(params.id, body, {
      id: session.user.id,
      isAdmin: false,
      vendorId: String(vendor._id),
    });
    return successResponse(clip);
  },
);

/** DELETE /api/vendor/clips/:id */
export const DELETE = withApi<{ id: string }>(
  { auth: "user", rateLimit: { action: "vendor:clips:delete", preset: "moderate" } },
  async ({ params, session }) => {
    await assertVendorPermission(
      session.user,
      VENDOR_PERMISSIONS.DELETE_PRODUCTS,
      "You do not have permission to delete clips",
    );
    const vendor = await requireApprovedVendorByUserId(session.user.id);
    await deleteClip(params.id, { vendorId: String(vendor._id) });
    return successResponse({ deleted: true });
  },
);
