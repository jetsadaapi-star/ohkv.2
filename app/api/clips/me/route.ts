import { withApi } from "@/lib/api/handler";
import { successResponse } from "@/lib/api/response";
import { getClipViewerStates, getFollowedStores, listSavedClips } from "@/lib/clips/clips-service";

/**
 * GET /api/clips/me?ids=a,b — which of these clips the shopper hearted or
 * saved (and, with `stores=`, which of those stores they follow).
 * GET /api/clips/me?saved=1 — the shopper's saved clips.
 */
export const GET = withApi({ auth: "user" }, async ({ request, session }) => {
  const params = new URL(request.url).searchParams;
  if (params.get("saved")) {
    return successResponse({ items: await listSavedClips(session.user.id) });
  }
  const ids = (params.get("ids") ?? "").split(",").filter(Boolean);
  const stores = (params.get("stores") ?? "").split(",").filter(Boolean);
  const [states, following] = await Promise.all([
    getClipViewerStates(session.user.id, ids),
    getFollowedStores(session.user.id, stores),
  ]);
  return successResponse({ states, following });
});
