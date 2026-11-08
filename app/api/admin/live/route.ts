import * as z from "zod";
import { Types } from "mongoose";
import { withApi } from "@/lib/api/handler";
import { paginatedResponse } from "@/lib/api/response";
import { validateQuery } from "@/lib/api/validate";
import { LIVE_STATUSES } from "@/lib/live/live-types";
import { listLives } from "@/lib/live/live-service";

const ListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(60).optional(),
  status: z.enum(LIVE_STATUSES).optional(),
  vendorId: z
    .string()
    .refine((value) => Types.ObjectId.isValid(value), { message: "Invalid store" })
    .optional(),
});

/** GET /api/admin/live — every store's lives. */
export const GET = withApi(
  { auth: "admin", rateLimit: { action: "admin:live:list", preset: "lenient" } },
  async ({ request }) => {
    const query = validateQuery(request, ListQuerySchema);
    const list = await listLives(query);
    return paginatedResponse(list.items, list.page, list.limit, list.total);
  },
);
