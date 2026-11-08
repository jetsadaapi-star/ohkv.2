import { withApi } from "@/lib/api/handler";
import { successResponse } from "@/lib/api/response";
import { listClipFeed } from "@/lib/clips/clips-service";

/**
 * GET /api/clips?cursor=&start= — the storefront's clip feed, a page at a time.
 * Public: what it returns is already on the storefront.
 */
export const GET = withApi(
  { rateLimit: { action: "storefront:clips:feed", preset: "lenient" } },
  async ({ request }) => {
    const { searchParams } = new URL(request.url);
    const feed = await listClipFeed({
      cursor: searchParams.get("cursor"),
      startId: searchParams.get("start"),
    });
    return successResponse(feed);
  },
);
