import { withApi } from "@/lib/api/handler";
import { successResponse } from "@/lib/api/response";
import { recordClipView } from "@/lib/clips/clips-service";

/** POST /api/clips/:id/view — counted by the feed once a clip has played a moment. */
export const POST = withApi<{ id: string }>(
  { rateLimit: { action: "storefront:clips:view", preset: "lenient" } },
  async ({ params }) => {
    await recordClipView(params.id);
    return successResponse({ ok: true });
  },
);
