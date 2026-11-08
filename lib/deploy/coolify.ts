import "server-only";

/**
 * Settings → Deploy: redeploy the store from the admin, through the Coolify
 * instance that hosts it, and say what is live against what is on GitHub.
 *
 * Configured by environment only — the token can rebuild and restart the
 * store, so it never lives in the database or reaches the browser:
 *   COOLIFY_API_URL    e.g. http://<server-ip>:8000 (no /api/v1)
 *   COOLIFY_API_TOKEN  a Coolify API token with the "deploy" ability
 *   COOLIFY_APP_UUID   the application's uuid in Coolify
 *   DEPLOY_GIT_REPO    owner/name on GitHub, for "latest commit"
 *   DEPLOY_GIT_BRANCH  defaults to main
 *   GITHUB_TOKEN       only for a private repository
 */

const TIMEOUT_MS = 15_000;
const UUID_RE = /^[a-z0-9]{10,40}$/;

export type DeployStatus =
  | "queued"
  | "in_progress"
  | "finished"
  | "failed"
  | "cancelled"
  | "unknown";

export interface DeploymentSummary {
  uuid: string;
  status: DeployStatus;
  commit: string | null;
  commitMessage: string | null;
  forceRebuild: boolean;
  createdAt: string | null;
  finishedAt: string | null;
}

export interface DeploymentDetail extends DeploymentSummary {
  logs: Array<{ line: string; error: boolean }>;
}

export interface GitCommit {
  sha: string;
  message: string;
  author: string | null;
  date: string | null;
  url: string | null;
}

export class DeployConfigError extends Error {}
export class DeployUpstreamError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function env(name: string) {
  return process.env[name]?.trim() || "";
}

export function deployConfig() {
  const config = {
    apiUrl: env("COOLIFY_API_URL").replace(/\/+$/, "").replace(/\/api\/v1$/, ""),
    token: env("COOLIFY_API_TOKEN"),
    appUuid: env("COOLIFY_APP_UUID"),
    repo: env("DEPLOY_GIT_REPO"),
    branch: env("DEPLOY_GIT_BRANCH") || "main",
  };
  const missing = [
    !config.apiUrl && "COOLIFY_API_URL",
    !config.token && "COOLIFY_API_TOKEN",
    !config.appUuid && "COOLIFY_APP_UUID",
  ].filter(Boolean) as string[];
  return { ...config, configured: missing.length === 0, missing };
}

export function isDeploymentUuid(value: string) {
  return UUID_RE.test(value);
}

async function coolify<T>(path: string, init: RequestInit = {}): Promise<T> {
  const config = deployConfig();
  if (!config.configured) {
    throw new DeployConfigError(`Missing ${config.missing.join(", ")}`);
  }
  let response: Response;
  try {
    response = await fetch(`${config.apiUrl}/api/v1${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${config.token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new DeployUpstreamError("Could not reach Coolify", 0);
  }
  const body = (await response.json().catch(() => null)) as T | { message?: string } | null;
  if (!response.ok) {
    const message =
      body && typeof body === "object" && "message" in body && typeof body.message === "string"
        ? body.message
        : `Coolify answered ${response.status}`;
    throw new DeployUpstreamError(message, response.status);
  }
  return body as T;
}

type RawDeployment = {
  deployment_uuid?: string;
  status?: string;
  commit?: string | null;
  commit_message?: string | null;
  force_rebuild?: boolean | number | string;
  created_at?: string | null;
  finished_at?: string | null;
  logs?: string | null;
};

function normalizeStatus(value: unknown): DeployStatus {
  const status = typeof value === "string" ? value : "";
  if (status === "queued" || status === "in_progress" || status === "finished" || status === "failed") {
    return status;
  }
  if (status.startsWith("cancelled")) return "cancelled";
  return "unknown";
}

function summarize(raw: RawDeployment): DeploymentSummary {
  const commit = typeof raw.commit === "string" && /^[0-9a-f]{7,40}$/i.test(raw.commit) ? raw.commit : null;
  return {
    uuid: raw.deployment_uuid ?? "",
    status: normalizeStatus(raw.status),
    commit,
    commitMessage: raw.commit_message?.split("\n")[0]?.slice(0, 200) || null,
    forceRebuild: raw.force_rebuild === true || raw.force_rebuild === 1 || raw.force_rebuild === "1",
    createdAt: raw.created_at ?? null,
    finishedAt: raw.finished_at ?? null,
  };
}

/** Most recent first. */
export async function listDeployments(take = 10): Promise<DeploymentSummary[]> {
  const { appUuid } = deployConfig();
  const data = await coolify<{ deployments?: RawDeployment[] } | RawDeployment[]>(
    `/deployments/applications/${appUuid}?skip=0&take=${take}`,
  );
  const items = Array.isArray(data) ? data : (data.deployments ?? []);
  return items.map(summarize).filter((item) => item.uuid);
}

// ANSI colour codes from the build output.
// eslint-disable-next-line no-control-regex
const ANSI = /\u001b\[[0-9;]*m/g;

/**
 * One deployment with its build log: only the lines Coolify marks visible —
 * the hidden ones are its own shell commands, which can carry the
 * environment — and only the tail.
 */
export async function getDeployment(uuid: string, tail = 160): Promise<DeploymentDetail> {
  if (!isDeploymentUuid(uuid)) throw new DeployUpstreamError("Not a deployment id", 400);
  const raw = await coolify<RawDeployment>(`/deployments/${uuid}`);
  let entries: Array<{ output?: string; hidden?: boolean; type?: string }> = [];
  try {
    entries = JSON.parse(raw.logs || "[]");
  } catch {
    entries = [];
  }
  const logs = entries
    .filter((entry) => !entry.hidden && typeof entry.output === "string")
    .flatMap((entry) =>
      (entry.output as string)
        .replace(ANSI, "")
        .split(/\r?\n/)
        .filter((line) => line.trim())
        .map((line) => ({ line: line.slice(0, 500), error: entry.type === "stderr" })),
    )
    .slice(-tail);
  return { ...summarize(raw), logs };
}

/** Queue a deployment of the branch's latest commit. */
export async function triggerDeploy(force: boolean): Promise<string> {
  const { appUuid } = deployConfig();
  const data = await coolify<{ deployments?: Array<{ deployment_uuid?: string }> }>("/deploy", {
    method: "POST",
    body: JSON.stringify({ uuid: appUuid, force }),
  });
  const uuid = data.deployments?.[0]?.deployment_uuid;
  if (!uuid) throw new DeployUpstreamError("Coolify did not queue a deployment", 502);
  return uuid;
}

/** The newest commit on the deploy branch, or null when GitHub can't say. */
export async function latestCommit(): Promise<GitCommit | null> {
  const { repo, branch } = deployConfig();
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) return null;
  const token = env("GITHUB_TOKEN");
  try {
    const response = await fetch(
      `https://api.github.com/repos/${repo}/commits/${encodeURIComponent(branch)}`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "storify-deploy-page",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    );
    if (!response.ok) return null;
    const data = (await response.json()) as {
      sha?: string;
      html_url?: string;
      commit?: { message?: string; author?: { name?: string; date?: string } };
    };
    if (!data.sha) return null;
    return {
      sha: data.sha,
      message: data.commit?.message?.split("\n")[0]?.slice(0, 200) ?? "",
      author: data.commit?.author?.name ?? null,
      date: data.commit?.author?.date ?? null,
      url: data.html_url ?? null,
    };
  } catch {
    return null;
  }
}
