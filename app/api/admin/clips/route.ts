import * as z from "zod";
import { Types } from "mongoose";
import { withApi } from "@/lib/api/handler";
import { createdResponse, paginatedResponse } from "@/lib/api/response";
import { validateBody, validateQuery } from "@/lib/api/validate";
import { SHORT_CLIP_STATUSES } from "@/lib/clips/clip-types";
import { AdminClipInputSchema, createClip, listClips } from "@/lib/clips/clips-service";

const ListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(60).optional(),
  search: z.string().max(200).optional(),
  status: z.enum(SHORT_CLIP_STATUSES).optional(),
  vendorId: z
    .string()
    .refine((value) => Types.ObjectId.isValid(value), { message: "Invalid store" })
    .optional(),
});

/** GET /api/admin/clips — every store's clips. */
export const GET = withApi(
  { auth: "admin", rateLimit: { action: "admin:clips:list", preset: "lenient" } },
  async ({ request }) => {
    const query = validateQuery(request, ListQuerySchema);
    const list = await listClips(query);
    return paginatedResponse(list.items, list.page, list.limit, list.total);
  },
);

/** POST /api/admin/clips — a clip for any store. */
export const POST = withApi(
  { auth: "admin", rateLimit: { action: "admin:clips:create", preset: "moderate" } },
  async ({ request, session }) => {
    const body = await validateBody(request, AdminClipInputSchema);
    return createdResponse(await createClip(body, session.user.id));
  },
);
