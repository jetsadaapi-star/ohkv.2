"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFormatter, useNow, useTranslations } from "next-intl";
import {
  CheckCircle2,
  CircleAlert,
  CircleDashed,
  CloudUpload,
  ExternalLink,
  GitBranch,
  GitCommitHorizontal,
  History,
  Loader2,
  RefreshCw,
  Rocket,
  ScrollText,
  Server,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast-notification";
import { SectionTitle } from "@/components/admin/form-sections";
import { SettingsTabHeader } from "@/components/admin/settings/sections/settings-tab-header";
import { cn } from "@/lib/utils";

type DeployStatus = "queued" | "in_progress" | "finished" | "failed" | "cancelled" | "unknown";

interface Deployment {
  uuid: string;
  status: DeployStatus;
  commit: string | null;
  commitMessage: string | null;
  forceRebuild: boolean;
  createdAt: string | null;
  finishedAt: string | null;
}

interface Overview {
  configured: boolean;
  missing?: string[];
  repo: string | null;
  branch: string;
  live?: Deployment | null;
  active?: Deployment | null;
  latest?: { sha: string; message: string; author: string | null; date: string | null; url: string | null } | null;
  upToDate?: boolean;
  deployments?: Deployment[];
}

interface Detail extends Deployment {
  logs: Array<{ line: string; error: boolean }>;
}

const STATUS_STYLE: Record<DeployStatus, { pill: string; icon: typeof CheckCircle2 }> = {
  finished: { pill: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-emerald-500/25", icon: CheckCircle2 },
  failed: { pill: "bg-rose-500/10 text-rose-700 dark:text-rose-400 ring-rose-500/25", icon: XCircle },
  in_progress: { pill: "bg-sky-500/10 text-sky-700 dark:text-sky-400 ring-sky-500/25", icon: Loader2 },
  queued: { pill: "bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-amber-500/25", icon: CircleDashed },
  cancelled: { pill: "bg-muted text-muted-foreground ring-border", icon: CircleAlert },
  unknown: { pill: "bg-muted text-muted-foreground ring-border", icon: CircleAlert },
};

/** The build's stage, read off its log. */
const STAGES = [
  { key: "fetch", match: /Importing .* to \/artifacts/i },
  { key: "build", match: /Pulling & building|building required images|Building/i },
  { key: "start", match: /Starting new application|Container .* Started/i },
  { key: "done", match: /New container started/i },
] as const;

function short(sha: string | null | undefined) {
  return sha ? sha.slice(0, 7) : "—";
}

function StatusPill({ status }: { status: DeployStatus }) {
  const t = useTranslations("admin.deployPage.status");
  const style = STATUS_STYLE[status];
  const Icon = style.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset", style.pill)}>
      <Icon className={cn("size-3.5", status === "in_progress" && "animate-spin")} />
      {t(status)}
    </span>
  );
}

export function DeployPanel() {
  const t = useTranslations("admin.deployPage");
  const format = useFormatter();
  const now = useNow({ updateInterval: 1000 });
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [watching, setWatching] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [unreachable, setUnreachable] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [force, setForce] = useState(false);
  const [starting, setStarting] = useState(false);
  const [justFinished, setJustFinished] = useState<DeployStatus | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const loadOverview = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/deploy", { cache: "no-store" });
      const body = (await response.json()) as { success?: boolean; data?: Overview; message?: string };
      if (!response.ok || !body.success || !body.data) throw new Error(body.message || t("loadFailed"));
      setOverview(body.data);
      setLoadError(null);
      if (body.data.active) setWatching((current) => current ?? body.data!.active!.uuid);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : t("loadFailed"));
    }
  }, [t]);

  useEffect(() => {
    const first = window.setTimeout(() => void loadOverview(), 0);
    const timer = window.setInterval(() => void loadOverview(), watching ? 10_000 : 30_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [loadOverview, watching]);

  // Follow one deployment's log. While the new version swaps in, this very
  // app restarts: a failed poll then means "switching over", not an error.
  useEffect(() => {
    if (!watching) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const response = await fetch(`/api/admin/deploy/${watching}`, { cache: "no-store" });
        const body = (await response.json()) as { success?: boolean; data?: Detail };
        if (!response.ok || !body.data) throw new Error();
        if (cancelled) return;
        setUnreachable(false);
        setDetail(body.data);
        if (body.data.status !== "queued" && body.data.status !== "in_progress") {
          setWatching(null);
          setJustFinished(body.data.status);
          void loadOverview();
          if (body.data.status === "finished") toast.success(t("toast.finished"));
          else if (body.data.status === "failed") toast.error(t("toast.failed"));
        }
      } catch {
        if (!cancelled) setUnreachable(true);
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 3000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [watching, loadOverview, t]);

  useEffect(() => {
    const box = logRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [detail?.logs.length]);

  const startDeploy = async () => {
    setStarting(true);
    try {
      const response = await fetch("/api/admin/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      const body = (await response.json()) as { success?: boolean; data?: { uuid?: string }; message?: string; code?: string };
      if (response.status === 409 && body.data?.uuid) {
        setWatching(body.data.uuid);
        toast.info(t("toast.alreadyRunning"));
      } else if (!response.ok || !body.data?.uuid) {
        throw new Error(body.message || t("toast.startFailed"));
      } else {
        setDetail(null);
        setJustFinished(null);
        setWatching(body.data.uuid);
        toast.success(t("toast.started"));
      }
      setConfirmOpen(false);
      void loadOverview();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("toast.startFailed"));
    } finally {
      setStarting(false);
    }
  };

  const openLog = async (uuid: string) => {
    try {
      const response = await fetch(`/api/admin/deploy/${uuid}`, { cache: "no-store" });
      const body = (await response.json()) as { data?: Detail };
      if (body.data) {
        setDetail(body.data);
        setJustFinished(null);
      }
    } catch {
      toast.error(t("loadFailed"));
    }
  };

  const stageIndex = useMemo(() => {
    if (!detail) return -1;
    let reached = -1;
    STAGES.forEach((stage, index) => {
      if (detail.logs.some((entry) => stage.match.test(entry.line))) reached = index;
    });
    return reached;
  }, [detail]);

  const when = (iso: string | null | undefined) =>
    iso ? format.relativeTime(new Date(iso), now) : "—";
  const duration = (item: Deployment) => {
    if (!item.createdAt) return "—";
    const end = item.finishedAt ? new Date(item.finishedAt).getTime() : now.getTime();
    const seconds = Math.max(0, Math.round((end - new Date(item.createdAt).getTime()) / 1000));
    return t("duration", { minutes: Math.floor(seconds / 60), seconds: seconds % 60 });
  };

  const running = Boolean(watching) || Boolean(overview?.active);
  const headerBadge = !overview ? null : !overview.configured ? (
    <span className="inline-flex items-center gap-1.5 rounded-full border bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
      <CircleAlert className="h-3.5 w-3.5" />
      {t("badge.notConfigured")}
    </span>
  ) : running ? (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-xs font-medium text-sky-700 dark:text-sky-400">
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
      {t("badge.deploying")}
    </span>
  ) : overview.upToDate ? (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
      <CheckCircle2 className="h-3.5 w-3.5" />
      {t("badge.upToDate")}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-400">
      <CloudUpload className="h-3.5 w-3.5" />
      {t("badge.newCode")}
    </span>
  );

  return (
    <div className="space-y-4">
      <SettingsTabHeader
        icon={<CloudUpload />}
        tone="indigo"
        title={t("title")}
        description={t("description")}
        meta={headerBadge}
      />

      {!overview ? (
        loadError ? (
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">{loadError}</span>
              <Button variant="outline" size="sm" className="rounded-full" onClick={() => void loadOverview()}>
                {t("retry")}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-36 rounded-2xl" />
            <Skeleton className="h-36 rounded-2xl" />
          </div>
        )
      ) : !overview.configured ? (
        <Card className="border-dashed">
          <CardHeader>
            <SectionTitle icon={<Server />} tone="amber">
              {t("setup.title")}
            </SectionTitle>
            <CardDescription>{t("setup.hint")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5 font-mono text-xs">
              {(overview.missing ?? []).map((name) => (
                <li key={name} className="rounded-lg bg-muted px-3 py-2">
                  {name}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Live vs GitHub */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-emerald-500/25">
              <CardHeader>
                <SectionTitle icon={<Server />} tone="emerald">
                  {t("live.title")}
                </SectionTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {overview.live ? (
                  <>
                    <p className="flex items-center gap-2 font-mono text-lg font-bold">
                      <GitCommitHorizontal className="size-4 text-muted-foreground" />
                      {short(overview.live.commit)}
                    </p>
                    <p className="line-clamp-2 text-sm">{overview.live.commitMessage || "—"}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("live.deployed", { when: when(overview.live.finishedAt) })}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">{t("live.none")}</p>
                )}
              </CardContent>
            </Card>

            <Card className={cn(overview.upToDate ? "" : "border-amber-500/40 bg-amber-500/[0.03]")}>
              <CardHeader>
                <SectionTitle icon={<GitBranch />} tone="indigo">
                  {t("latest.title", { branch: overview.branch })}
                </SectionTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {overview.latest ? (
                  <>
                    <p className="flex items-center gap-2 font-mono text-lg font-bold">
                      <GitCommitHorizontal className="size-4 text-muted-foreground" />
                      {short(overview.latest.sha)}
                      {overview.latest.url ? (
                        <a
                          href={overview.latest.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={t("latest.open")}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <ExternalLink className="size-3.5" />
                        </a>
                      ) : null}
                    </p>
                    <p className="line-clamp-2 text-sm">{overview.latest.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("latest.by", {
                        author: overview.latest.author ?? "—",
                        when: when(overview.latest.date),
                      })}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">{t("latest.unknown")}</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* The button */}
          <Card className="overflow-hidden">
            <CardContent className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1.5">
                <p className="text-base font-bold">
                  {overview.upToDate && !running ? t("action.upToDateTitle") : t("action.title")}
                </p>
                <p className="max-w-xl text-sm text-muted-foreground">{t("action.hint")}</p>
                <div className="flex items-center gap-2 pt-1">
                  <Switch id="deploy-force" checked={force} onCheckedChange={setForce} disabled={running} />
                  <Label htmlFor="deploy-force" className="text-xs font-medium text-muted-foreground">
                    {t("action.force")}
                  </Label>
                </div>
              </div>
              <Button
                size="lg"
                disabled={running || starting}
                onClick={() => setConfirmOpen(true)}
                className="h-12 shrink-0 gap-2 rounded-full bg-emerald-600 px-7 text-base font-bold text-white shadow-md shadow-emerald-600/25 hover:bg-emerald-700"
              >
                {running ? <Loader2 className="size-5 animate-spin" /> : <Rocket className="size-5" />}
                {running ? t("action.running") : t("action.button")}
              </Button>
            </CardContent>
          </Card>

          {/* Progress / log */}
          {detail ? (
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <SectionTitle icon={<ScrollText />} tone="sky">
                    {t("progress.title", { commit: short(detail.commit) })}
                  </SectionTitle>
                  <div className="flex items-center gap-2">
                    <StatusPill status={detail.status} />
                    <span className="text-xs tabular-nums text-muted-foreground">{duration(detail)}</span>
                  </div>
                </div>
                {detail.commitMessage ? <CardDescription>{detail.commitMessage}</CardDescription> : null}
              </CardHeader>
              <CardContent className="space-y-4">
                <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {STAGES.map((stage, index) => {
                    const done = index < stageIndex || (index === stageIndex && detail.status === "finished");
                    const current = index === stageIndex && detail.status === "in_progress";
                    const failed = detail.status === "failed" && index === Math.max(stageIndex, 0);
                    return (
                      <li
                        key={stage.key}
                        className={cn(
                          "flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold",
                          done && "border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-700 dark:text-emerald-400",
                          current && "border-sky-500/40 bg-sky-500/[0.06] text-sky-700 dark:text-sky-400",
                          failed && "border-rose-500/40 bg-rose-500/[0.06] text-rose-700 dark:text-rose-400",
                          !done && !current && !failed && "text-muted-foreground",
                        )}
                      >
                        {done ? (
                          <CheckCircle2 className="size-4" />
                        ) : current ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : failed ? (
                          <XCircle className="size-4" />
                        ) : (
                          <CircleDashed className="size-4" />
                        )}
                        {t(`progress.stages.${stage.key}`)}
                      </li>
                    );
                  })}
                </ol>

                {unreachable && watching ? (
                  <p className="flex items-center gap-2 rounded-xl border border-sky-500/30 bg-sky-500/[0.06] px-3 py-2 text-xs text-sky-800 dark:text-sky-300">
                    <RefreshCw className="size-3.5 animate-spin" />
                    {t("progress.switching")}
                  </p>
                ) : null}

                <div
                  ref={logRef}
                  className="max-h-80 overflow-auto rounded-xl bg-zinc-950 p-3 font-mono text-[11px] leading-relaxed text-zinc-200"
                >
                  {detail.logs.length === 0 ? (
                    <p className="text-zinc-500">{t("progress.waiting")}</p>
                  ) : (
                    detail.logs.map((entry, index) => (
                      <p key={index} className={cn("whitespace-pre-wrap break-all", entry.error && "text-rose-300")}>
                        {entry.line}
                      </p>
                    ))
                  )}
                </div>

                {justFinished === "finished" ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] px-4 py-3">
                    <p className="flex items-center gap-2 text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                      <CheckCircle2 className="size-4" />
                      {t("progress.finished")}
                    </p>
                    <Button size="sm" variant="outline" className="rounded-full" onClick={() => window.location.reload()}>
                      {t("progress.reload")}
                    </Button>
                  </div>
                ) : justFinished === "failed" ? (
                  <p className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/[0.06] px-4 py-3 text-sm font-semibold text-rose-800 dark:text-rose-300">
                    <XCircle className="size-4" />
                    {t("progress.failed")}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {/* History */}
          <Card>
            <CardHeader>
              <SectionTitle icon={<History />} tone="violet">
                {t("history.title")}
              </SectionTitle>
            </CardHeader>
            <CardContent>
              {(overview.deployments ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("history.empty")}</p>
              ) : (
                <ul className="divide-y rounded-xl border">
                  {(overview.deployments ?? []).map((item) => (
                    <li key={item.uuid} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-3 py-2.5">
                      <StatusPill status={item.status} />
                      <span className="font-mono text-xs font-bold">{short(item.commit)}</span>
                      <span className="min-w-0 flex-1 truncate text-sm">{item.commitMessage || "—"}</span>
                      {item.forceRebuild ? (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                          {t("history.noCache")}
                        </span>
                      ) : null}
                      <span className="text-xs text-muted-foreground">{when(item.createdAt)}</span>
                      <span className="w-20 text-right text-xs tabular-nums text-muted-foreground">{duration(item)}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 rounded-full px-2.5 text-xs"
                        onClick={() => void openLog(item.uuid)}
                      >
                        {t("history.log")}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={() => void startDeploy()}
        loading={starting}
        type="warning"
        title={t("confirm.title")}
        description={t("confirm.description", {
          commit: short(overview?.latest?.sha),
          message: overview?.latest?.message ?? "",
        })}
        confirmText={t("confirm.confirm")}
        cancelText={t("confirm.cancel")}
      />
    </div>
  );
}
