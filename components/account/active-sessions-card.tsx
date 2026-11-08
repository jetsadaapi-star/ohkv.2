"use client";

import { useCallback, useEffect, useState } from "react";
import { useFormatter, useNow, useTranslations } from "next-intl";
import { Laptop, Loader2, LogOut, MonitorSmartphone, Smartphone, Tablet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast-notification";
import { SectionTitle } from "@/components/admin/form-sections";
import { cn } from "@/lib/utils";

type SessionRow = {
  _id: string;
  createdAt: string;
  expiresAt?: string;
  userAgent?: string | null;
  ipAddress?: string | null;
  isCurrent: boolean;
};

/** Browser, system and device kind from a user agent — enough to recognise a device. */
function describeAgent(ua: string | null | undefined) {
  const agent = ua || "";
  const browser = /Edg\//.test(agent)
    ? "Edge"
    : /OPR\/|Opera/.test(agent)
      ? "Opera"
      : /Firefox\//.test(agent)
        ? "Firefox"
        : /Chrome\//.test(agent)
          ? "Chrome"
          : /Safari\//.test(agent)
            ? "Safari"
            : /okhttp|Dart|Expo|CFNetwork/i.test(agent)
              ? "App"
              : null;
  const os = /iPhone|iPad|iOS/.test(agent)
    ? "iOS"
    : /Android/.test(agent)
      ? "Android"
      : /Windows/.test(agent)
        ? "Windows"
        : /Mac OS X|Macintosh/.test(agent)
          ? "macOS"
          : /Linux/.test(agent)
            ? "Linux"
            : null;
  const kind = /iPad|Tablet/.test(agent)
    ? "tablet"
    : /Mobile|iPhone|Android/.test(agent)
      ? "phone"
      : agent
        ? "computer"
        : "unknown";
  return { browser, os, kind } as const;
}

/**
 * The places this account is signed in, from Better Auth's sessions
 * (/api/auth/revoke-sessions): sign one out, or every one but this.
 */
export function ActiveSessionsCard({ disabled }: { disabled?: boolean }) {
  const t = useTranslations("adminProfile.sessions");
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmOthers, setConfirmOthers] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/revoke-sessions", { cache: "no-store" });
      const body = (await response.json()) as { success?: boolean; sessions?: SessionRow[] };
      if (!response.ok || !body.success) throw new Error();
      const list = body.sessions ?? [];
      list.sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent) || +new Date(b.createdAt) - +new Date(a.createdAt));
      setSessions(list);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const revoke = async (body: Record<string, unknown>, key: string) => {
    setBusy(key);
    try {
      const response = await fetch("/api/auth/revoke-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error();
      toast.success(key === "others" ? t("othersSignedOut") : t("signedOut"));
      setConfirmOthers(false);
      await load();
    } catch {
      toast.error(t("failed"));
    } finally {
      setBusy(null);
    }
  };

  const others = sessions?.filter((session) => !session.isCurrent).length ?? 0;

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1.5">
            <SectionTitle icon={<MonitorSmartphone />} tone="indigo">
              {t("title")}
            </SectionTitle>
            <CardDescription>{t("description")}</CardDescription>
          </div>
          {others > 0 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 rounded-full text-rose-600 hover:text-rose-700"
              disabled={disabled || busy !== null}
              onClick={() => setConfirmOthers(true)}
            >
              <LogOut className="size-4" />
              {t("signOutOthers")}
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        {sessions === null ? (
          failed ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed px-3 py-2.5 text-sm text-muted-foreground">
              {t("loadFailed")}
              <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => void load()}>
                {t("retry")}
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
            </div>
          )
        ) : (
          <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {sessions.map((session) => {
              const agent = describeAgent(session.userAgent);
              const Icon = agent.kind === "phone" ? Smartphone : agent.kind === "tablet" ? Tablet : Laptop;
              const name = [agent.browser, agent.os].filter(Boolean).join(" · ") || t("unknownDevice");
              return (
                <li
                  key={session._id}
                  className={cn(
                    "flex min-w-0 items-center gap-3 rounded-xl border p-3",
                    session.isCurrent && "border-emerald-500/30 bg-emerald-500/[0.04]",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-xl",
                      session.isCurrent
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    <Icon className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-semibold">
                      <span className="truncate">{name}</span>
                      {session.isCurrent ? (
                        <span className="shrink-0 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                          {t("thisDevice")}
                        </span>
                      ) : null}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[
                        session.ipAddress,
                        t("signedIn", { when: format.relativeTime(new Date(session.createdAt), now) }),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  {!session.isCurrent ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="shrink-0 rounded-full text-muted-foreground hover:text-rose-600"
                      disabled={disabled || busy !== null}
                      aria-label={t("signOut")}
                      onClick={() => void revoke({ revokeAll: false, sessionId: session._id }, session._id)}
                    >
                      {busy === session._id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <>
                          <LogOut className="size-4 sm:hidden" />
                          <span className="hidden sm:inline">{t("signOut")}</span>
                        </>
                      )}
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>

      <ConfirmDialog
        open={confirmOthers}
        onOpenChange={setConfirmOthers}
        type="warning"
        loading={busy === "others"}
        title={t("confirmTitle")}
        description={t("confirmDescription", { count: others })}
        confirmText={t("signOutOthers")}
        cancelText={t("cancel")}
        onConfirm={() => void revoke({ revokeAll: true, excludeCurrent: true }, "others")}
      />
    </Card>
  );
}
