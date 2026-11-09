import { withApi } from "@/lib/api/handler";
import { successResponse } from "@/lib/api/response";
import { validateBody } from "@/lib/api/validate";
import {
  cancelFlashSale,
  deleteFlashSale,
  getFlashSale,
  updateFlashSale,
} from "@/lib/catalog/flash-sales";
import { FlashSaleBodySchema } from "@/lib/catalog/flash-sale-schema";

export const GET = withApi<{ id: string }>(
  { auth: "admin", rateLimit: { action: "admin:flash-sales:read", preset: "lenient" } },
  async ({ params }) => successResponse({ sale: await getFlashSale(params.id) }),
);

export const PUT = withApi<{ id: string }>(
  { auth: "admin", rateLimit: { action: "admin:flash-sales:update", preset: "moderate" } },
  async ({ request, params }) => {
    const body = await validateBody(request, FlashSaleBodySchema);
    return successResponse({ sale: await updateFlashSale(params.id, body) });
  },
);

/** POST — end a running (or drop a scheduled) sale now; prices go back. */
export const POST = withApi<{ id: string }>(
  { auth: "admin", rateLimit: { action: "admin:flash-sales:cancel", preset: "moderate" } },
  async ({ params }) => successResponse({ sale: await cancelFlashSale(params.id) }),
);

export const DELETE = withApi<{ id: string }>(
  { auth: "admin", rateLimit: { action: "admin:flash-sales:delete", preset: "moderate" } },
  async ({ params }) => {
    await deleteFlashSale(params.id);
    return successResponse({ deleted: true });
  },
);
