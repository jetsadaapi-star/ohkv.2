/**
 * GET /api/admin/deploy/[uuid]
 * One deployment's status and the tail of its build log (Settings → Deploy).
 */
import { NextResponse } from "next/server";
import { withApi } from "@/lib/api/handler";
import { DeployConfigError, DeployUpstreamError, getDeployment, isDeploymentUuid } from "@/lib/deploy/coolify";

type RouteParams = { uuid: string };

export const GET = withApi<RouteParams>(
  { auth: "admin", rateLimit: { action: "admin:deploy:read", preset: "lenient" } },
  async ({ params }) => {
    if (!isDeploymentUuid(params.uuid)) {
      return NextResponse.json({ success: false, message: "Not a deployment id" }, { status: 400 });
    }
    try {
      return NextResponse.json({ success: true, data: await getDeployment(params.uuid) });
    } catch (error) {
      if (error instanceof DeployConfigError) {
        return NextResponse.json({ success: false, code: "NOT_CONFIGURED", message: error.message }, { status: 503 });
      }
      if (error instanceof DeployUpstreamError) {
        return NextResponse.json(
          { success: false, code: "UPSTREAM", message: error.message },
          { status: error.status === 404 ? 404 : 502 },
        );
      }
      throw error;
    }
  },
);
