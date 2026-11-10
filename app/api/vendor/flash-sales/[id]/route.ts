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
import { vendorFlashSaleAccess } from "@/lib/catalog/flash-sale-vendor-access";

/** One of the store's own sales; another seller's or the marketplace's is not found. */
export const GET = withApi<{ id: string }>({ auth: "user" }, async ({ request, session, params }) => {
  const vendor = await vendorFlashSaleAccess(request, session.user, "view");
  return successResponse({ sale: await getFlashSale(params.id, { vendorId: vendor._id }) });
});

export const PUT = withApi<{ id: string }>({ auth: "user" }, async ({ request, session, params }) => {
  const vendor = await vendorFlashSaleAccess(request, session.user, "edit");
  const body = await validateBody(request, FlashSaleBodySchema);
  return successResponse({ sale: await updateFlashSale(params.id, body, { vendorId: vendor._id }) });
});

/** POST — end the sale now (or drop it before it starts); prices go back. */
export const POST = withApi<{ id: string }>({ auth: "user" }, async ({ request, session, params }) => {
  const vendor = await vendorFlashSaleAccess(request, session.user, "edit");
  return successResponse({ sale: await cancelFlashSale(params.id, { vendorId: vendor._id }) });
});

export const DELETE = withApi<{ id: string }>({ auth: "user" }, async ({ request, session, params }) => {
  const vendor = await vendorFlashSaleAccess(request, session.user, "delete");
  await deleteFlashSale(params.id, { vendorId: vendor._id });
  return successResponse({ deleted: true });
});
