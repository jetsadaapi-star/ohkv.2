import { withApi } from "@/lib/api/handler";
import { successResponse } from "@/lib/api/response";
import { recordClipShare } from "@/lib/clips/clips-service";

/** POST /api/clips/:id/share — counted when anyone shares or copies a clip's link. */
export const POST = withApi<{ id: string }>(
  { rateLimit: { action: "storefront:clips:share", preset: "lenient" } },
  async ({ params }) => successResponse(await recordClipShare(params.id)),
);
