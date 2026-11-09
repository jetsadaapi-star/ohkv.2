import { successResponse } from "@/lib/api/response";
import { withApi } from "@/lib/api/handler";
import { getLoyaltyOverview } from "@/lib/customers/loyalty-service";

/**
 * The shopper's own loyalty points: balance, tier and the way to the next,
 * what the points are worth as store credit, and how they got them.
 */
export const GET = withApi(
  { auth: "user", rateLimit: { action: "user:loyalty", preset: "lenient" } },
  async ({ session }) => successResponse(await getLoyaltyOverview(session.user.id)),
);
