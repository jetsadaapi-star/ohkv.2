"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Clapperboard,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  Pencil,
  Play,
  Plus,
  Search,
  ShoppingBag,
  Store,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast-notification";
import { useConfirmation } from "@/components/ui/confirmation-dialog";
import { ClipEditorDialog } from "@/components/clips/clip-editor-dialog";
import { kalasinDistrictLabel } from "@/config/kalasin-districts";
import type { ClipDashboardItem, ShortClipStatus } from "@/lib/clips/clip-types";
import { cn } from "@/lib/utils";

type Mode = "vendor" | "admin";
type Filter = "all" | ShortClipStatus;

const STATUS_STYLES: Record<ShortClipStatus, string> = {
  published: "bg-emerald-500 text-white",
  draft: "bg-slate-700/80 text-white",
  hidden: "bg-red-600 text-white",
};

/**
 * The dashboards' clip list — a store's own clips, or every store's for the
 * admin. One component so both read and behave the same.
 */
export function ClipsManager({ mode }: { mode: Mode }) {
  const t = useTranslations("clips");
  const locale = useLocale();
  const { confirm } = useConfirmation();
  const [clips, setClips] = useState<ClipDashboardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<ClipDashboardItem | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const base = mode === "admin" ? "/api/admin/clips" : "/api/vendor/clips";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "60" });
      if (filter !== "all") params.set("status", filter);
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(`${base}?${params.toString()}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.message || t("loadFailed"));
      setClips((json.data?.data ?? []) as ClipDashboardItem[]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [base, filter, search, t]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  const openNew = () => {
    setEditing(null);
    setEditorOpen(true);
  };
  const openEdit = (clip: ClipDashboardItem) => {
    setEditing(clip);
    setEditorOpen(true);
  };

  const handleDelete = async (clip: ClipDashboardItem) => {
    const ok = await confirm({
      title: t("deleteTitle"),
      description: t("deleteDescription"),
      confirmText: t("delete"),
      variant: "destructive",
    });
    if (!ok) return;
    try {
      const res = await fetch(`${base}/${clip.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.message || t("deleteFailed"));
      setClips((current) => current.filter((c) => c.id !== clip.id));
      toast.success(t("deleted"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("deleteFailed"));
    }
  };

  const filters: Array<{ id: Filter; label: string }> = [
    { id: "all", label: t("filterAll") },
    { id: "published", label: t("statusPublished") },
    { id: "draft", label: t("statusDraft") },
    { id: "hidden", label: t("statusHidden") },
  ];

  const totalViews = clips.reduce((sum, c) => sum + c.viewCount, 0);
  const published = clips.filter((c) => c.status === "published").length;

  return (
    <div className="space-y-5 pb-8">
      {/* Header */}
      <section className="relative isolate overflow-hidden rounded-3xl bg-linear-to-br from-rose-500 via-fuchsia-600 to-violet-600 p-5 text-white shadow-lg shadow-fuchsia-500/20 sm:p-7">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-20 -z-10 size-72 rounded-full bg-white/15 blur-3xl"
        />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium ring-1 ring-inset ring-white/25">
              <Clapperboard className="size-3.5" />
              {t("badge")}
            </p>
            <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">{t("pageTitle")}</h1>
            <p className="mt-1 max-w-xl text-sm text-white/85">
              {mode === "admin" ? t("pageSubtitleAdmin") : t("pageSubtitle")}
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
              <span className="rounded-lg bg-white/15 px-3 py-1.5 ring-1 ring-inset ring-white/20">
                {t("statClips", { count: clips.length })}
              </span>
              <span className="rounded-lg bg-white/15 px-3 py-1.5 ring-1 ring-inset ring-white/20">
                {t("statPublished", { count: published })}
              </span>
              <span className="rounded-lg bg-white/15 px-3 py-1.5 ring-1 ring-inset ring-white/20">
                {t("statViews", { count: totalViews })}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              asChild
              variant="outline"
              className="border-white/30 bg-white/15 text-white hover:bg-white/25 hover:text-white"
            >
              <a href={`/${locale}/clips`} target="_blank" rel="noreferrer">
                <ExternalLink className="me-2 size-4" />
                {t("viewFeed")}
              </a>
            </Button>
            <Button onClick={openNew} className="bg-white text-fuchsia-700 shadow-md hover:bg-white/90">
              <Plus className="me-2 size-4" />
              {t("newClip")}
            </Button>
          </div>
        </div>
      </section>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                filter === f.id
                  ? "bg-linear-to-r from-rose-500 to-violet-600 text-white shadow-sm"
                  : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchClips")}
            className="ps-8"
          />
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex min-h-60 items-center justify-center">
          <Loader2 className="size-7 animate-spin text-muted-foreground" />
        </div>
      ) : clips.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed bg-card px-6 py-16 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-linear-to-br from-rose-500 to-violet-600 text-white shadow-lg">
            <Clapperboard className="size-7" />
          </span>
          <p className="text-base font-semibold">{t("emptyTitle")}</p>
          <p className="max-w-sm text-sm text-muted-foreground">{t("emptyDescription")}</p>
          <Button onClick={openNew} className="mt-2 bg-linear-to-r from-rose-500 to-violet-600 text-white">
            <Plus className="me-2 size-4" />
            {t("newClip")}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
          {clips.map((clip) => (
            <article
              key={clip.id}
              className="group overflow-hidden rounded-2xl border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <button
                type="button"
                onClick={() => openEdit(clip)}
                className="relative block aspect-9/16 w-full overflow-hidden bg-slate-900"
              >
                <video
                  src={clip.videoUrl}
                  poster={clip.posterUrl || undefined}
                  muted
                  playsInline
                  loop
                  preload="metadata"
                  className="size-full object-cover"
                  onMouseEnter={(e) => void e.currentTarget.play().catch(() => {})}
                  onMouseLeave={(e) => e.currentTarget.pause()}
                />
                <span
                  className={cn(
                    "absolute start-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-semibold shadow",
                    STATUS_STYLES[clip.status],
                  )}
                >
                  {clip.status === "published"
                    ? t("statusPublished")
                    : clip.status === "draft"
                      ? t("statusDraft")
                      : t("statusHidden")}
                </span>
                <span className="absolute end-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur">
                  <Eye className="size-3" />
                  {clip.viewCount.toLocaleString(locale)}
                </span>
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                  <span className="flex size-12 items-center justify-center rounded-full bg-white/25 text-white backdrop-blur">
                    <Play className="size-6 fill-current" />
                  </span>
                </span>
                <span className="absolute inset-x-2 bottom-2 inline-flex items-center gap-1 self-start rounded-full bg-rose-500 px-2 py-0.5 text-[11px] font-semibold text-white shadow">
                  <ShoppingBag className="size-3" />
                  {t("pinnedCount", { count: clip.products.length })}
                </span>
              </button>
              <div className="space-y-2 p-3">
                <p className="line-clamp-2 min-h-9 text-sm font-semibold leading-tight">
                  {clip.title || clip.caption || t("untitled")}
                </p>
                {mode === "admin" ? (
                  <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                    <Store className="size-3 shrink-0" />
                    <span className="truncate">
                      {clip.vendorName}
                      {clip.vendorDistrict
                        ? ` · ${kalasinDistrictLabel(clip.vendorDistrict, locale)}`
                        : ""}
                    </span>
                  </p>
                ) : null}
                {clip.status === "hidden" && clip.hiddenReason ? (
                  <p className="flex items-start gap-1 text-xs text-red-600">
                    <EyeOff className="mt-0.5 size-3 shrink-0" />
                    <span className="line-clamp-2">{clip.hiddenReason}</span>
                  </p>
                ) : null}
                <div className="flex items-center gap-1.5">
                  <Button size="sm" variant="outline" className="h-8 flex-1" onClick={() => openEdit(clip)}>
                    <Pencil className="me-1.5 size-3.5" />
                    {t("edit")}
                  </Button>
                  {clip.status === "published" ? (
                    <Button asChild size="sm" variant="outline" className="h-8 px-2">
                      <a
                        href={`/${locale}/clips?start=${clip.id}`}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={t("viewOnStore")}
                      >
                        <ExternalLink className="size-3.5" />
                      </a>
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-2 text-red-600 hover:text-red-700"
                    onClick={() => void handleDelete(clip)}
                    aria-label={t("delete")}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <ClipEditorDialog
        mode={mode}
        open={editorOpen}
        onOpenChange={setEditorOpen}
        clip={editing}
        onSaved={(saved) => {
          setClips((current) => {
            const exists = current.some((c) => c.id === saved.id);
            return exists
              ? current.map((c) => (c.id === saved.id ? saved : c))
              : [saved, ...current];
          });
        }}
      />
    </div>
  );
}
