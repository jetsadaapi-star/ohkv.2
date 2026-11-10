import * as z from "zod";
import { withApi } from "@/lib/api/handler";
import { successResponse } from "@/lib/api/response";
import { validateBody } from "@/lib/api/validate";
import { revalidateSettingsContent } from "@/lib/cache-invalidation";
import { connectDB } from "@/lib/db";
import { flashSaleRulesOf, getFlashSaleVendorRules } from "@/lib/catalog/flash-sales";
import { Settings } from "@/models/settings.model";

const RulesSchema = z.object({
  vendorsEnabled: z.boolean(),
  maxDiscount: z.coerce.number().int().min(1).max(90),
  maxProducts: z.coerce.number().int().min(1).max(100),
});

/** GET /api/admin/flash-sales/settings — what stores may do with Flash Sales. */
export const GET = withApi(
  { auth: "admin", rateLimit: { action: "admin:flash-sales:settings:read", preset: "lenient" } },
  async () => successResponse({ rules: await getFlashSaleVendorRules() }),
);

/** PUT — switch store Flash Sales on or off and set their limits. */
export const PUT = withApi(
  { auth: "admin", rateLimit: { action: "admin:flash-sales:settings:update", preset: "moderate" } },
  async ({ request }) => {
    const body = await validateBody(request, RulesSchema);
    await connectDB();
    await Settings.updateOne(
      {},
      {
        $set: {
          "flashSales.vendorsEnabled": body.vendorsEnabled,
          "flashSales.vendorMaxDiscount": body.maxDiscount,
          "flashSales.vendorMaxProducts": body.maxProducts,
        },
      },
    );
    revalidateSettingsContent();
    return successResponse({
      rules: flashSaleRulesOf({
        flashSales: {
          vendorsEnabled: body.vendorsEnabled,
          vendorMaxDiscount: body.maxDiscount,
          vendorMaxProducts: body.maxProducts,
        },
      }),
    });
  },
);
