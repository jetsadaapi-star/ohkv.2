import { withApi } from "@/lib/api/handler";
import { successResponse } from "@/lib/api/response";
import { validateBody } from "@/lib/api/validate";
import {
  AdminClipInputSchema,
  deleteClip,
  getClip,
  updateClip,
} from "@/lib/clips/clips-service";

/** GET /api/admin/clips/:id */
export const GET = withApi<{ id: string }>({ auth: "admin" }, async ({ params }) =>
  successResponse(await getClip(params.id)),
);

/** PUT /api/admin/clips/:id — edit, move to another store, or take down. */
export const PUT = withApi<{ id: string }>(
  { auth: "admin", rateLimit: { action: "admin:clips:update", preset: "moderate" } },
  async ({ request, params, session }) => {
    const body = await validateBody(request, AdminClipInputSchema);
    const clip = await updateClip(params.id, body, { id: session.user.id, isAdmin: true });
    return successResponse(clip);
  },
);

/** DELETE /api/admin/clips/:id */
export const DELETE = withApi<{ id: string }>(
  { auth: "admin", rateLimit: { action: "admin:clips:delete", preset: "moderate" } },
  async ({ params }) => {
    await deleteClip(params.id);
    return successResponse({ deleted: true });
  },
);
