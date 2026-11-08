import * as z from "zod";
import { withApi } from "@/lib/api/handler";
import { successResponse } from "@/lib/api/response";
import { validateBody } from "@/lib/api/validate";
import { setClipReaction } from "@/lib/clips/clips-service";

const BodySchema = z.object({ on: z.boolean() });

/** POST /api/clips/:id/save {on} — a signed-in shopper saves a clip, or takes it back. */
export const POST = withApi<{ id: string }>(
  { auth: "user", rateLimit: { action: "storefront:clips:save", preset: "browse" } },
  async ({ request, params, session }) => {
    const { on } = await validateBody(request, BodySchema);
    return successResponse(await setClipReaction(params.id, session.user.id, "save", on));
  },
);
