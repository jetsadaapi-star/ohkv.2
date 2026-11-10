import { withApi } from "@/lib/api/handler";
import { successResponse } from "@/lib/api/response";
import { validateBody } from "@/lib/api/validate";
import { createFlashSale, getFlashSaleVendorRules, listFlashSales } from "@/lib/catalog/flash-sales";
import { FlashSaleBodySchema } from "@/lib/catalog/flash-sale-schema";
import { vendorFlashSaleAccess } from "@/lib/catalog/flash-sale-vendor-access";

/** GET /api/vendor/flash-sales — the store's own sales and the rules it sells within. */
export const GET = withApi({ auth: "user" }, async ({ request, session }) => {
  const vendor = await vendorFlashSaleAccess(request, session.user, "view");
  const [sales, rules] = await Promise.all([
    listFlashSales({ vendorId: vendor._id }),
    getFlashSaleVendorRules(),
  ]);
  return successResponse({ sales, rules });
});

/** POST /api/vendor/flash-sales — schedule a sale of the store's products. */
export const POST = withApi({ auth: "user" }, async ({ request, session }) => {
  const vendor = await vendorFlashSaleAccess(request, session.user, "create");
  const body = await validateBody(request, FlashSaleBodySchema);
  const sale = await createFlashSale(body, session.user.id, { vendorId: vendor._id });
  return successResponse({ sale }, "Created", 201);
});
