import { withApi } from "@/lib/api/handler";
import { successResponse } from "@/lib/api/response";
import { requireApprovedVendorByUserId } from "@/lib/access/vendor-guard";
import { getStudioState } from "@/lib/live/live-service";

/** GET /api/vendor/live/:id/state?after=&v= — the studio's poll (also its check-in). */
export const GET = withApi<{ id: string }>({ auth: "user" }, async ({ request, params, session }) => {
  const vendor = await requireApprovedVendorByUserId(session.user.id);
  const { searchParams } = new URL(request.url);
  return successResponse(
    await getStudioState(
      params.id,
      { vendorId: String(vendor._id) },
      { after: searchParams.get("after"), version: searchParams.get("v") },
    ),
  );
});
