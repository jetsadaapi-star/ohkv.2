import { withApi } from "@/lib/api/handler";
import { successResponse } from "@/lib/api/response";
import { listPublicLives } from "@/lib/live/live-service";

/** GET /api/live — lives on air now and coming up. Public. */
export const GET = withApi(
  { rateLimit: { action: "storefront:live:list", preset: "browse" } },
  async () => successResponse(await listPublicLives()),
);
