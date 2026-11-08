import * as z from "zod";
import { withApi } from "@/lib/api/handler";
import { createdResponse, successResponse } from "@/lib/api/response";
import { validateBody } from "@/lib/api/validate";
import { SHORT_CLIP_LIMITS } from "@/lib/clips/clip-types";
import { addClipComment, listClipComments } from "@/lib/clips/clips-service";

const CommentSchema = z.object({ text: z.string().trim().min(1).max(SHORT_CLIP_LIMITS.comment) });

/** GET /api/clips/:id/comments?cursor= — newest first. Public. */
export const GET = withApi<{ id: string }>(
  { auth: "optional", rateLimit: { action: "storefront:clips:comments", preset: "browse" } },
  async ({ request, params, session }) => {
    const cursor = new URL(request.url).searchParams.get("cursor");
    return successResponse(
      await listClipComments(params.id, { cursor, viewerId: session?.user?.id ?? null }),
    );
  },
);

/** POST /api/clips/:id/comments — a signed-in shopper (or the store) comments. */
export const POST = withApi<{ id: string }>(
  { auth: "user", rateLimit: { action: "storefront:clips:comment", preset: "lenient" } },
  async ({ request, params, session }) => {
    const { text } = await validateBody(request, CommentSchema);
    return createdResponse(
      await addClipComment(params.id, { id: session.user.id, name: session.user.name }, text),
    );
  },
);
