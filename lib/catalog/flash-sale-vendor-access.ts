import "server-only";

import type { NextRequest } from "next/server";
import { VENDOR_PERMISSIONS, type VendorPermission } from "@/config/permissions.config";
import { NotFoundError } from "@/lib/api/errors";
import { rateLimitByUser } from "@/lib/api/rate-limit-middleware";
import { assertVendorPermission, type MinimalUser } from "@/lib/access/rbac";
import { requireApprovedVendorByUserId } from "@/lib/access/vendor-guard";
import { connectDB } from "@/lib/db";
import { getSettingsLean } from "@/models/settings.model";

type Verb = "view" | "create" | "edit" | "delete";

const PERMISSION: Record<Verb, VendorPermission> = {
  view: VENDOR_PERMISSIONS.VIEW_DISCOUNTS,
  create: VENDOR_PERMISSIONS.CREATE_DISCOUNTS,
  edit: VENDOR_PERMISSIONS.EDIT_DISCOUNTS,
  delete: VENDOR_PERMISSIONS.DELETE_DISCOUNTS,
};

/**
 * Vendor → Flash Sale rides on the Discounts permission: a seat that may make
 * coupons may run a Flash Sale of the store's products. Returns the store.
 */
export async function vendorFlashSaleAccess(
  request: NextRequest,
  user: MinimalUser & { id: string; role?: string | null },
  verb: Verb,
) {
  await assertVendorPermission(
    user,
    PERMISSION[verb],
    "You do not have permission to manage Flash Sales",
  );
  await rateLimitByUser(
    request,
    user.id,
    `vendor:flash-sales:${verb}`,
    verb === "view" ? "lenient" : "moderate",
    user.role,
  );
  await connectDB();
  const settings = await getSettingsLean();
  if (!settings.multiVendorMode?.enabled) throw new NotFoundError("Vendor");
  return requireApprovedVendorByUserId(user.id);
}
