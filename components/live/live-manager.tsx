"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  CalendarClock,
  ExternalLink,
  Heart,
  Loader2,
  Package,
  Pencil,
  Plus,
  Radio,
  Square,
  Store,
  Trash2,
  Users,
} from "lucide-react";
import Link from "@/components/language/link";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast-notification";
import { useConfirmation } from "@/components/ui/confirmation-dialog";
import { LiveEditorDialog } from "@/components/live/live-editor-dialog";
import { kalasinDistrictLabel } from "@/config/kalasin-districts";
import type { LiveDashboardItem, LiveStatus } from "@/lib/live/live-types";
import { cn } from "@/lib/utils";

type Mode = "vendor" | "admin";
type Filter = "all" | LiveStatus;

const STATUS_STYLES: Record<LiveStatus, string> = {
  live: "bg-red-600 text-white",
  scheduled: "bg-amber-400 text-slate-900",
  ended: "bg-slate-700/80 text-white",
};

/** The dashboards' list of lives — a store's own, or every store's for the admin. */
export function LiveManager({ mode }: { mode: Mode }) {
  const t = useTranslations("live");
  const locale = useLocale();
  const { confirm } = useConfirmation();
  const [lives, setLives] = useState<LiveDashboardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<LiveDashboardItem | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const base = mode === "admin" ? "/api/admin/live" : "/api/vendor/live";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "60" });
      if (filter !== "all") params.set("status", filter);
      const res = await fetch(`${base}?${params.toString()}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.message || t("loadFailed"));
      setLives((json.data?.data ?? []) as LiveDashboardItem[]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [base, filter, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const remove = async (live: LiveDashboardItem) => {
    const ok = await confirm({
      title: t("deleteTitle"),
      description: t("deleteDescription"),
      confirmText: t("delete"),
      variant: "destructive",
    });
    if (!ok) return;
    try {
      const res = await fetch(`${base}/${live.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.message || t("actionFailed"));
      setLives((current) => current.filter((l) => l.id !== live.id));
      toast.success(t("deleted"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("actionFailed"));
    }
  };

  const end = async (live: LiveDashboardItem) => {
    const ok = await confirm({
      title: t("endTitle"),
      description: t("endDescription"),
      confirmText: t("endLive"),
      variant: "destructive",
    });
    if (!ok) return;
    try {
      const res = await fetch(`${base}/${live.id}/end`, { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.message || t("actionFailed"));
      toast.success(t("ended"));
      void load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("actionFailed"));
    }
  };

  const statusLabel = (status: LiveStatus) =>
    status === "live" ? t("statusLive") : status === "scheduled" ? t("statusScheduled") : t("statusEnded");
  const reasonLabel = (reason: string) =>
    reason === "admin" ? t("reasonAdmin") : reason === "timeout" ? t("reasonTimeout") : t("reasonStore");
  const onAir = lives.filter((l) => l.status === "live").length;
  const formatDate = (value: string | null) =>
    value
      ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
      : "";

  const filters: Array<{ id: Filter; label: string }> = [
    { id: "all", label: t("filterAll") },
    { id: "live", label: t("statusLive") },
    { id: "scheduled", label: t("statusScheduled") },
    { id: "ended", label: t("statusEnded") },
  ];

  return (
    <div className="space-y-5 pb-8">
      <section className="relative isolate overflow-hidden rounded-3xl bg-linear-to-br from-red-500 via-rose-600 to-pink-600 p-5 text-white shadow-lg shadow-rose-500/20 sm:p-7">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-20 -z-10 size-72 rounded-full bg-white/15 blur-3xl"
        />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold ring-1 ring-inset ring-white/25">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-white opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-white" />
              </span>
              {t("navLabel")}
              {onAir > 0 ? ` · ${t("statusLive")} ${onAir}` : ""}
            </p>
            <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">{t("pageTitle")}</h1>
            <p className="mt-1 max-w-xl text-sm text-white/85">
              {mode === "admin" ? t("pageSubtitleAdmin") : t("pageSubtitle")}
            </p>
          </div>
          {mode === "vendor" ? (
            <Button
              onClick={() => {
                setEditing(null);
                setEditorOpen(true);
              }}
              className="h-11 rounded-xl bg-white px-5 font-semibold text-rose-600 shadow-md hover:bg-white/90"
            >
              <Plus className="size-4" />
              {t("newLive")}
            </Button>
          ) : null}
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
              filter === f.id ? "border-rose-600 bg-rose-600 text-white" : "bg-card hover:bg-muted",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : lives.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed bg-card px-6 py-16 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-linear-to-br from-red-500 to-pink-600 text-white shadow-lg">
            <Radio className="size-7" />
          </span>
          <p className="text-base font-semibold">{t("emptyTitle")}</p>
          <p className="max-w-md text-sm text-muted-foreground">{t("emptyDescription")}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {lives.map((live) => (
            <article key={live.id} className="flex flex-col overflow-hidden rounded-2xl border bg-card shadow-sm">
              <div className="relative aspect-video bg-linear-to-br from-slate-800 to-slate-950">
                {live.coverUrl || live.products[0]?.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={live.coverUrl || live.products[0]?.image}
                    alt=""
                    className="size-full object-cover opacity-80"
                  />
                ) : null}
                <span
                  className={cn(
                    "absolute start-3 top-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold shadow",
                    STATUS_STYLES[live.status],
                  )}
                >
                  {live.status === "live" ? <span className="size-1.5 animate-pulse rounded-full bg-white" /> : null}
                  {statusLabel(live.status)}
                </span>
                <div className="absolute inset-x-3 bottom-3 flex flex-wrap gap-1.5 text-[11px] font-semibold text-white">
                  <span className="inline-flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 backdrop-blur">
                    <Package className="size-3" />
                    {t("productsCount", { count: live.products.length })}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 backdrop-blur">
                    <Heart className="size-3" />
                    {t("likesCount", { count: live.likeCount })}
                  </span>
                  {live.peakViewers > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 backdrop-blur">
                      <Users className="size-3" />
                      {t("peakViewers", { count: live.peakViewers })}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-2 p-4">
                <h3 className="line-clamp-2 font-semibold leading-snug">{live.title}</h3>
                {mode === "admin" ? (
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Store className="size-3.5" />
                    {live.vendorName}
                    {live.vendorDistrict ? ` · ${kalasinDistrictLabel(live.vendorDistrict, locale)}` : ""}
                  </p>
                ) : null}
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <CalendarClock className="size-3.5" />
                  {formatDate(live.status === "ended" ? live.endedAt : live.startedAt ?? live.scheduledAt) || "—"}
                </p>
                {live.status === "ended" && live.endedReason ? (
                  <p className="text-xs text-muted-foreground">
                    {t("endedBy", { reason: reasonLabel(live.endedReason) })}
                  </p>
                ) : null}
                <div className="mt-auto flex flex-wrap gap-2 pt-2">
                  {mode === "vendor" && live.status !== "ended" ? (
                    <Button asChild size="sm" className="bg-red-600 hover:bg-red-700">
                      <Link href={`/vendor/live/${live.id}`}>
                        <Radio className="size-4" />
                        {t("openStudio")}
                      </Link>
                    </Button>
                  ) : null}
                  {live.status === "live" ? (
                    <>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/live/${live.id}`} target="_blank">
                          <ExternalLink className="size-4" />
                          {t("watchPage")}
                        </Link>
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void end(live)}>
                        <Square className="size-4" />
                        {t("endLive")}
                      </Button>
                    </>
                  ) : null}
                  {mode === "vendor" && live.status === "scheduled" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditing(live);
                        setEditorOpen(true);
                      }}
                    >
                      <Pencil className="size-4" />
                      {t("edit")}
                    </Button>
                  ) : null}
                  {mode === "vendor" && live.status !== "live" ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => void remove(live)}
                    >
                      <Trash2 className="size-4" />
                      {t("delete")}
                    </Button>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {mode === "vendor" ? (
        <LiveEditorDialog
          open={editorOpen}
          onOpenChange={setEditorOpen}
          live={editing}
          onSaved={() => void load()}
        />
      ) : null}
    </div>
  );
}
