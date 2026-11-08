/**
 * GET /api/admin/settings/my-ip
 * The address the maintenance allow-list will see for this admin — the one
 * proxy.ts resolves (lib/api/client-ip.ts) — so Settings →
 * Maintenance can offer "add my IP" and the admin can keep browsing the store
 * while it is closed to everyone else.
 */

import { NextResponse } from "next/server";
import { withApi } from "@/lib/api/handler";
import { CLIENT_IP_HEADER, resolveClientIp } from "@/lib/api/client-ip";

export const GET = withApi({ auth: "admin" }, async ({ request }) => {
  // The address proxy.ts stamped (overwriting anything the client sent) is
  // exactly the one its maintenance check compares against the allow-list.
  const ip = request.headers.get(CLIENT_IP_HEADER) || resolveClientIp(request.headers);
  return NextResponse.json({ success: true, data: { ip } });
});
