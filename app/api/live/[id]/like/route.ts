import * as z from "zod";
import { withApi } from "@/lib/api/handler";
import { successResponse } from "@/lib/api/response";
import { validateBody } from "@/lib/api/validate";
import { LIVE_LIMITS } from "@/lib/live/live-types";
import { addLiveLikes } from "@/lib/live/live-service";

const LikeSchema = z.object({ count: z.number().int().min(1).max(LIVE_LIMITS.likeBatch) });

/** POST /api/live/:id/like — hearts, batched by the player. Anyone may send them. */
export const POST = withApi<{ id: string }>(
  { rateLimit: { action: "storefront:live:like", preset: "browse" } },
  async ({ request, params }) => {
    const { count } = await validateBody(request, LikeSchema);
    return successResponse(await addLiveLikes(params.id, count));
  },
);
