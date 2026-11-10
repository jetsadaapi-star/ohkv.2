import "server-only";

import { requireApprovedVendorByUserId } from "@/lib/access/vendor-guard";

/**
 * Who is asking for a vendor's transfer page: the user, and the store they
 * act for when they are on one's team. An applicant paying for a plan has no
 * approved store yet and is matched by the user who started the payment.
 */
export async function platformTransferViewer(userId: string) {
  const vendor = await requireApprovedVendorByUserId(userId).catch(() => null);
  return { userId, vendorId: vendor?._id ? String(vendor._id) : null };
}
