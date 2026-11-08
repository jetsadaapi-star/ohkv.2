import * as z from "zod";
import { withApi } from "@/lib/api/handler";
import { createdResponse, paginatedResponse } from "@/lib/api/response";
import { validateBody, validateQuery } from "@/lib/api/validate";
import { assertVendorPermission } from "@/lib/access/rbac";
import { requireApprovedVendorByUserId } from "@/lib/access/vendor-guard";
import { VENDOR_PERMISSIONS } from "@/config/permissions.config";
import { SHORT_CLIP_STATUSES } from "@/lib/clips/clip-types";
import { ClipInputSchema, createClip, listClips } from "@/lib/clips/clips-service";

const ListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(60).optional(),
  search: z.string().max(200).optional(),
  status: z.enum(SHORT_CLIP_STATUSES).optional(),
});

/** GET /api/vendor/clips — the store's own clips. */
export const GET = withApi(
  { auth: "user", rateLimit: { action: "vendor:clips:list", preset: "lenient" } },
  async ({ request, session }) => {
    await assertVendorPermission(
      session.user,
      VENDOR_PERMISSIONS.VIEW_PRODUCTS,
      "You do not have permission to view clips",
    );
    const vendor = await requireApprovedVendorByUserId(session.user.id);
    const query = validateQuery(request, ListQuerySchema);
    const list = await listClips({ ...query, vendorId: String(vendor._id) });
    return paginatedResponse(list.items, list.page, list.limit, list.total);
  },
);

/** POST /api/vendor/clips — a new clip, pinning the store's own products. */
export const POST = withApi(
  { auth: "user", rateLimit: { action: "vendor:clips:create", preset: "moderate" } },
  async ({ request, session }) => {
    await assertVendorPermission(
      session.user,
      VENDOR_PERMISSIONS.EDIT_PRODUCTS,
      "You do not have permission to create clips",
    );
    const vendor = await requireApprovedVendorByUserId(session.user.id);
    const body = await validateBody(request, ClipInputSchema);
    const clip = await createClip(
      { ...body, vendorId: String(vendor._id) },
      session.user.id,
    );
    return createdResponse(clip);
  },
);
