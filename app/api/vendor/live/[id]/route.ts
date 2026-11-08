import { withApi } from "@/lib/api/handler";
import { successResponse } from "@/lib/api/response";
import { validateBody } from "@/lib/api/validate";
import { assertVendorPermission } from "@/lib/access/rbac";
import { requireApprovedVendorByUserId } from "@/lib/access/vendor-guard";
import { VENDOR_PERMISSIONS } from "@/config/permissions.config";
import {
  LiveInputSchema,
  deleteLive,
  getLive,
  getStudioCredentials,
  updateLive,
} from "@/lib/live/live-service";

/** GET /api/vendor/live/:id — the live, with the studio's stream credentials. */
export const GET = withApi<{ id: string }>({ auth: "user" }, async ({ params, session }) => {
  await assertVendorPermission(
    session.user,
    VENDOR_PERMISSIONS.EDIT_PRODUCTS,
    "You do not have permission to run lives",
  );
  const vendor = await requireApprovedVendorByUserId(session.user.id);
  const scope = { vendorId: String(vendor._id) };
  const [live, credentials] = await Promise.all([
    getLive(params.id, scope),
    getStudioCredentials(params.id, scope),
  ]);
  return successResponse({ ...live, credentials });
});

/** PUT /api/vendor/live/:id — title, products and live discounts. */
export const PUT = withApi<{ id: string }>(
  { auth: "user", rateLimit: { action: "vendor:live:update", preset: "lenient" } },
  async ({ request, params, session }) => {
    await assertVendorPermission(
      session.user,
      VENDOR_PERMISSIONS.EDIT_PRODUCTS,
      "You do not have permission to edit lives",
    );
    const vendor = await requireApprovedVendorByUserId(session.user.id);
    const body = await validateBody(request, LiveInputSchema);
    return successResponse(await updateLive(params.id, body, { vendorId: String(vendor._id) }));
  },
);

/** DELETE /api/vendor/live/:id */
export const DELETE = withApi<{ id: string }>(
  { auth: "user", rateLimit: { action: "vendor:live:delete", preset: "moderate" } },
  async ({ params, session }) => {
    await assertVendorPermission(
      session.user,
      VENDOR_PERMISSIONS.EDIT_PRODUCTS,
      "You do not have permission to delete lives",
    );
    const vendor = await requireApprovedVendorByUserId(session.user.id);
    await deleteLive(params.id, { vendorId: String(vendor._id) });
    return successResponse({ deleted: true });
  },
);
