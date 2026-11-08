import { withApi } from "@/lib/api/handler";
import { successResponse } from "@/lib/api/response";
import { Vendor } from "@/models";

/**
 * GET /api/admin/clips/stores?search= — the stores a clip can belong to, for
 * the admin's editor. Unlike the vendor list this includes the marketplace's
 * own store, which posts clips like anyone else.
 */
export const GET = withApi(
  { auth: "admin", rateLimit: { action: "admin:clips:stores", preset: "lenient" } },
  async ({ request }) => {
    const search = (new URL(request.url).searchParams.get("search") ?? "").trim();
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").slice(0, 100);
    const vendors = await Vendor.find(
      escaped ? { storeName: { $regex: escaped, $options: "i" } } : {},
    )
      .select("storeName district isDefault status")
      .sort({ isDefault: -1, storeName: 1 })
      .limit(30)
      .lean<
        Array<{
          _id: unknown;
          storeName: string;
          district?: string;
          isDefault?: boolean;
          status?: string;
        }>
      >();
    return successResponse(
      vendors.map((vendor) => ({
        id: String(vendor._id),
        storeName: vendor.storeName,
        district: vendor.district ?? "",
        isDefault: vendor.isDefault === true,
        status: vendor.status ?? "",
      })),
    );
  },
);
