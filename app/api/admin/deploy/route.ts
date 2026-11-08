/**
 * GET  /api/admin/deploy  what is live, what is on GitHub, recent deployments
 * POST /api/admin/deploy  redeploy the branch's latest commit through Coolify
 *
 * Settings → Deploy. Sensitive-settings only (lib/access/team-route-permissions.ts):
 * a deploy rebuilds and restarts the store.
 */
import { NextResponse } from "next/server";
import * as z from "zod";
import { withApi } from "@/lib/api/handler";
import { audit, createAuditContext } from "@/lib/audit";
import {
  DeployConfigError,
  DeployUpstreamError,
  deployConfig,
  latestCommit,
  listDeployments,
  triggerDeploy,
} from "@/lib/deploy/coolify";

function upstreamFailure(error: unknown) {
  if (error instanceof DeployConfigError) {
    return NextResponse.json({ success: false, code: "NOT_CONFIGURED", message: error.message }, { status: 503 });
  }
  if (error instanceof DeployUpstreamError) {
    return NextResponse.json(
      { success: false, code: "UPSTREAM", message: error.message },
      { status: error.status === 0 ? 502 : error.status >= 500 ? 502 : error.status },
    );
  }
  throw error;
}

export const GET = withApi(
  { auth: "admin", rateLimit: { action: "admin:deploy:read", preset: "lenient" } },
  async () => {
    const config = deployConfig();
    if (!config.configured) {
      return NextResponse.json({
        success: true,
        data: { configured: false, missing: config.missing, repo: config.repo || null, branch: config.branch },
      });
    }
    try {
      const [deployments, latest] = await Promise.all([listDeployments(12), latestCommit()]);
      const live = deployments.find((item) => item.status === "finished") ?? null;
      const active = deployments.find((item) => item.status === "queued" || item.status === "in_progress") ?? null;
      return NextResponse.json({
        success: true,
        data: {
          configured: true,
          repo: config.repo || null,
          branch: config.branch,
          live,
          active,
          latest,
          upToDate: Boolean(live?.commit && latest?.sha && live.commit === latest.sha),
          deployments,
        },
      });
    } catch (error) {
      return upstreamFailure(error);
    }
  },
);

const DeploySchema = z.object({ force: z.boolean().optional() });

export const POST = withApi(
  {
    auth: "admin",
    demo: "block-mutations",
    rateLimit: { action: "admin:deploy:trigger", preset: "strict" },
  },
  async ({ request, session }) => {
    let force = false;
    try {
      force = DeploySchema.parse(await request.json()).force === true;
    } catch {
      // An empty body is an ordinary deploy.
    }
    try {
      // One at a time: a second deploy queued behind the first only rebuilds
      // the same commit again and restarts the store twice.
      const recent = await listDeployments(5);
      const active = recent.find((item) => item.status === "queued" || item.status === "in_progress");
      if (active) {
        return NextResponse.json(
          { success: false, code: "IN_PROGRESS", message: "A deployment is already running", data: { uuid: active.uuid } },
          { status: 409 },
        );
      }
      const [uuid, latest] = await Promise.all([triggerDeploy(force), latestCommit()]);
      await audit(createAuditContext(request, session), {
        action: "SETTINGS_CHANGE",
        resource: "settings",
        resourceId: "deploy",
        resourceName: "Deploy",
        changes: {
          summary: `${session.user.email ?? "An administrator"} redeployed the store${
            latest ? ` (${latest.sha.slice(0, 7)} ${latest.message})` : ""
          }${force ? " without the build cache" : ""}.`,
        },
        metadata: { deploymentUuid: uuid, commit: latest?.sha ?? null, force },
      });
      return NextResponse.json({ success: true, data: { uuid } });
    } catch (error) {
      return upstreamFailure(error);
    }
  },
);
