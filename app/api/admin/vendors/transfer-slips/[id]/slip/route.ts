import { NextResponse } from "next/server";
import { withApi } from "@/lib/api/handler";
import { notFoundResponse } from "@/lib/api/response";
import { getStorageService } from "@/lib/storage";
import { getPlatformTransferSlipKey } from "@/lib/payments/platform-transfers";
import { isSlipKey } from "@/lib/payments/transfer-payment";

const TYPES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" };

/** GET /api/admin/vendors/transfer-slips/:id/slip — the slip image, from private storage. */
export const GET = withApi<{ id: string }>(
  { auth: "admin", rateLimit: { action: "admin:vendor-transfers:slip", preset: "browse" } },
  async ({ params }) => {
    const key = await getPlatformTransferSlipKey(params.id);
    if (!key || !isSlipKey(key)) return notFoundResponse("Slip");
    const storage = await getStorageService();
    const filename = key.split("/").pop() || "slip";
    let download;
    try {
      download = await storage.getPrivateDownload(key, { expiresInSeconds: 300, filename, disposition: "inline" });
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === "ENOENT") return notFoundResponse("Slip");
      throw error;
    }
    if (download.kind === "redirect") return NextResponse.redirect(download.url, 302);
    const ext = filename.split(".").pop()?.toLowerCase() ?? "";
    const headers = new Headers({
      "Content-Type": TYPES[ext] ?? "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    });
    if (download.size) headers.set("Content-Length", String(download.size));
    return new Response(download.body, { headers });
  },
);
