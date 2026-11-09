import * as z from "zod";
import { successResponse } from "@/lib/api/response";
import { validateBody } from "@/lib/api/validate";
import { withApi } from "@/lib/api/handler";
import { getLoyaltyOverview, redeemLoyaltyPoints } from "@/lib/customers/loyalty-service";

const RedeemSchema = z.object({
  points: z.coerce.number().int().positive().max(100_000_000),
});

/** Turn points into store credit, spent at checkout. */
export const POST = withApi(
  { auth: "user", rateLimit: { action: "user:loyalty:redeem", preset: "moderate" } },
  async ({ request, session }) => {
    const body = await validateBody(request, RedeemSchema);
    const result = await redeemLoyaltyPoints({ userId: session.user.id, points: body.points });
    return successResponse({ ...result, overview: await getLoyaltyOverview(session.user.id) });
  },
);
