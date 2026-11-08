import * as z from "zod";
import { withApi } from "@/lib/api/handler";
import { createdResponse } from "@/lib/api/response";
import { validateBody } from "@/lib/api/validate";
import { LIVE_LIMITS } from "@/lib/live/live-types";
import { postLiveChat } from "@/lib/live/live-service";

const ChatSchema = z.object({ text: z.string().trim().min(1).max(LIVE_LIMITS.chatText) });

/** POST /api/live/:id/chat — a signed-in shopper (or the store) says something. */
export const POST = withApi<{ id: string }>(
  { auth: "user", rateLimit: { action: "storefront:live:chat", preset: "lenient" } },
  async ({ request, params, session }) => {
    const { text } = await validateBody(request, ChatSchema);
    return createdResponse(
      await postLiveChat(params.id, { id: session.user.id, name: session.user.name }, text),
    );
  },
);
