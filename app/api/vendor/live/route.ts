import * as z from "zod";
import { withApi } from "@/lib/api/handler";
import { createdResponse, paginatedResponse } from "@/lib/api/response";
import { validateBody, validateQuery } from "@/lib/api/validate";
import { assertVendorPermission } from "@/lib/access/rbac";
import { requireApprovedVendorByUserId } from "@/lib/access/vendor-guard";
import { VENDOR_PERMISSIONS } from "@/config/permissions.config";
import { LIVE_STATUSES } from "@/lib/live/live-types";
import { LiveInputSchema, createLive, listLives } from "@/lib/live/live-service";

const ListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(60).optional(),
  status: z.enum(LIVE_STATUSES).optional(),
});

/** GET /api/vendor/live — the store's own lives. */
export const GET = withApi(
  { auth: "user", rateLimit: { action: "vendor:live:list", preset: "lenient" } },
  async ({ request, session }) => {
    await assertVendorPermission(
      session.user,
      VENDOR_PERMISSIONS.VIEW_PRODUCTS,
      "You do not have permission to view lives",
    );
    const vendor = await requireApprovedVendorByUserId(session.user.id);
    const query = validateQuery(request, ListQuerySchema);
    const list = await listLives({ ...query, vendorId: String(vendor._id) });
    return paginatedResponse(list.items, list.page, list.limit, list.total);
  },
);

/** POST /api/vendor/live — a new live, selling the store's own products. */
export const POST = withApi(
  { auth: "user", rateLimit: { action: "vendor:live:create", preset: "moderate" } },
  async ({ request, session }) => {
    await assertVendorPermission(
      session.user,
      VENDOR_PERMISSIONS.EDIT_PRODUCTS,
      "You do not have permission to create lives",
    );
    const vendor = await requireApprovedVendorByUserId(session.user.id);
    const body = await validateBody(request, LiveInputSchema);
    return createdResponse(await createLive(body, String(vendor._id), session.user.id));
  },
);
