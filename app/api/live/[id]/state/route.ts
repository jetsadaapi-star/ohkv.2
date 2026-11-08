import { withApi } from "@/lib/api/handler";
import { successResponse } from "@/lib/api/response";
import { getRoomState } from "@/lib/live/live-service";

/**
 * GET /api/live/:id/state?after=&v=&viewer= — a viewer's poll: status, viewer
 * and heart counts, the pinned product, new chat, and the products when they
 * changed. Public; polled every couple of seconds, so not rate limited by the
 * general presets (each call is a handful of indexed reads).
 */
export const GET = withApi<{ id: string }>({}, async ({ request, params }) => {
  const { searchParams } = new URL(request.url);
  return successResponse(
    await getRoomState(params.id, {
      after: searchParams.get("after"),
      version: searchParams.get("v"),
      viewerId: searchParams.get("viewer"),
    }),
  );
});
