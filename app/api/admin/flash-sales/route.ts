import { withApi } from "@/lib/api/handler";
import { successResponse } from "@/lib/api/response";
import { validateBody } from "@/lib/api/validate";
import { createFlashSale, listFlashSales } from "@/lib/catalog/flash-sales";
import { FlashSaleBodySchema } from "@/lib/catalog/flash-sale-schema";

/** GET /api/admin/flash-sales — every sale, newest first. */
export const GET = withApi(
  { auth: "admin", rateLimit: { action: "admin:flash-sales:list", preset: "lenient" } },
  async () => successResponse({ sales: await listFlashSales() }),
);

/** POST /api/admin/flash-sales — schedule a sale (starts at once if its window is now). */
export const POST = withApi(
  { auth: "admin", rateLimit: { action: "admin:flash-sales:create", preset: "moderate" } },
  async ({ request, session }) => {
    const body = await validateBody(request, FlashSaleBodySchema);
    return successResponse({ sale: await createFlashSale(body, session.user.id) }, "Created", 201);
  },
);
