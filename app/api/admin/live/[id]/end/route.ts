import { withApi } from "@/lib/api/handler";
import { successResponse } from "@/lib/api/response";
import { endLive } from "@/lib/live/live-service";

/** POST /api/admin/live/:id/end — the marketplace takes a live off air. */
export const POST = withApi<{ id: string }>(
  { auth: "admin", rateLimit: { action: "admin:live:end", preset: "moderate" } },
  async ({ params }) => successResponse(await endLive(params.id, "admin")),
);
