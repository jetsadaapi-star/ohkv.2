import * as z from "zod";
import { withApi } from "@/lib/api/handler";
import { successResponse } from "@/lib/api/response";
import { validateBody } from "@/lib/api/validate";
import { setClipReaction } from "@/lib/clips/clips-service";

const BodySchema = z.object({ on: z.boolean() });

/** POST /api/clips/:id/like {on} — a signed-in shopper likes a clip, or takes it back. */
export const POST = withApi<{ id: string }>(
  { auth: "user", rateLimit: { action: "storefront:clips:like", preset: "browse" } },
  async ({ request, params, session }) => {
    const { on } = await validateBody(request, BodySchema);
    return successResponse(await setClipReaction(params.id, session.user.id, "like", on));
  },
);
