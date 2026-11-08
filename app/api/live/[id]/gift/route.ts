import * as z from "zod";
import { withApi } from "@/lib/api/handler";
import { createdResponse } from "@/lib/api/response";
import { validateBody } from "@/lib/api/validate";
import { LIVE_GIFT_IDS, LIVE_GIFT_LIMITS } from "@/lib/live/live-gifts";
import { sendLiveGift } from "@/lib/live/live-service";

const GiftSchema = z.object({
  giftId: z.enum(LIVE_GIFT_IDS as [string, ...string[]]),
  count: z.number().int().min(1).max(LIVE_GIFT_LIMITS.batch).default(1),
});

/** POST /api/live/:id/gift — a signed-in viewer sends the store a gift. */
export const POST = withApi<{ id: string }>(
  { auth: "user", rateLimit: { action: "storefront:live:gift", preset: "lenient" } },
  async ({ request, params, session }) => {
    const { giftId, count } = await validateBody(request, GiftSchema);
    return createdResponse(
      await sendLiveGift(params.id, { id: session.user.id, name: session.user.name }, giftId, count),
    );
  },
);
