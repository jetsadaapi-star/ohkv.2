"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Loader2, Package, Radio, Search, Tag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MediaUploader, type UploadedMedia } from "@/components/ui/media-uploader";
import { toast } from "@/components/ui/toast-notification";
import { useCurrency } from "@/providers/currency-provider";
import {
  LIVE_LIMITS,
  type LiveDashboardItem,
  type LiveProductSummary,
} from "@/lib/live/live-types";

/** A product list row, reduced to what the picker shows. */
function toSummary(raw: Record<string, unknown>): LiveProductSummary | null {
  const id = String(raw._id ?? raw.id ?? "");
  if (!id) return null;
  const images = Array.isArray(raw.images) ? (raw.images as string[]) : [];
  const media = Array.isArray(raw.media)
    ? (raw.media as Array<{ type?: string; url?: string; thumbnailUrl?: string }>)
    : [];
  const image =
    media.find((m) => m.type === "image")?.url ??
    media.find((m) => m.thumbnailUrl)?.thumbnailUrl ??
    images[0];
  const range = raw.priceRange as { min?: number } | undefined;
  return {
    id,
    name: String(raw.name ?? raw.title ?? ""),
    slug: String(raw.slug ?? ""),
    image: image || undefined,
    price: Number(range?.min ?? raw.price ?? 0) || 0,
    discountPercent: 0,
    status: typeof raw.status === "string" ? raw.status : undefined,
  };
}

/** "2026-11-06T19:30" for a datetime-local input, in the browser's time zone. */
function toLocalInput(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function LiveEditorDialog({
  open,
  onOpenChange,
  live,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null for a new live. */
  live: LiveDashboardItem | null;
  onSaved: (live: LiveDashboardItem) => void;
}) {
  const t = useTranslations("live");
  const { formatPrice } = useCurrency();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [cover, setCover] = useState<UploadedMedia[]>([]);
  const [scheduledAt, setScheduledAt] = useState("");
  const [products, setProducts] = useState<LiveProductSummary[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LiveProductSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(live?.title ?? "");
    setDescription(live?.description ?? "");
    setCover(
      live?.coverUrl
        ? [{ _id: "live-cover", url: live.coverUrl, type: "image", mimeType: "image/*", position: 0 }]
        : [],
    );
    setScheduledAt(toLocalInput(live?.scheduledAt));
    setProducts(live?.products ?? []);
    setQuery("");
  }, [open, live]);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!open) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const params = new URLSearchParams({ limit: "20" });
        if (query.trim()) params.set("search", query.trim());
        const res = await fetch(`/api/vendor/products?${params.toString()}`);
        const json = await res.json();
        const rows = (json?.data?.data ?? json?.data ?? []) as Record<string, unknown>[];
        setResults(rows.map(toSummary).filter((p): p is LiveProductSummary => Boolean(p)));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [open, query]);

  const addedIds = useMemo(() => new Set(products.map((p) => p.id)), [products]);
  const toggle = (product: LiveProductSummary) => {
    setProducts((current) => {
      if (current.some((p) => p.id === product.id)) return current.filter((p) => p.id !== product.id);
      if (current.length >= LIVE_LIMITS.products) {
        toast.error(t("tooManyProducts", { max: LIVE_LIMITS.products }));
        return current;
      }
      return [...current, product];
    });
  };
  const setDiscount = (id: string, value: string) => {
    const n = Math.max(0, Math.min(LIVE_LIMITS.maxDiscount, Number(value) || 0));
    setProducts((current) => current.map((p) => (p.id === id ? { ...p, discountPercent: n } : p)));
  };

  const save = async () => {
    if (!title.trim()) return toast.error(t("titleRequired"));
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        coverUrl: cover[0]?.url ?? "",
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : "",
        products: products.map((p) => ({ productId: p.id, discountPercent: p.discountPercent })),
      };
      const res = await fetch(live ? `/api/vendor/live/${live.id}` : "/api/vendor/live", {
        method: live ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.message || json?.error || t("saveFailed"));
      toast.success(live ? t("updated") : t("created"));
      onSaved(json.data as LiveDashboardItem);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-linear-to-br from-red-500 to-pink-600 text-white">
              <Radio className="size-4" />
            </span>
            {live ? t("editorEdit") : t("editorNew")}
          </DialogTitle>
          <DialogDescription>{t("editorDescription")}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-[220px_1fr]">
          <div className="space-y-2">
            <Label>{t("cover")}</Label>
            <MediaUploader
              value={cover}
              onChange={(items) => setCover(items.filter((i) => i.type === "image").slice(0, 1))}
              maxFiles={1}
              acceptTypes={["image"]}
              uploadTitle={t("uploadCover")}
              uploadDescription={t("uploadCoverHint")}
              mediaGridClassName="grid-cols-1 md:grid-cols-1"
              previewAspectRatio="9 / 16"
              previewFit="cover"
              showCoverBadge={false}
              hideUploadZoneWhenFull
            />
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="live-title">{t("titleLabel")} *</Label>
              <Input
                id="live-title"
                value={title}
                maxLength={LIVE_LIMITS.title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("titlePlaceholder")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="live-desc">{t("descriptionLabel")}</Label>
              <Textarea
                id="live-desc"
                rows={3}
                value={description}
                maxLength={LIVE_LIMITS.description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("descriptionPlaceholder")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="live-at">{t("scheduledAt")}</Label>
              <Input
                id="live-at"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="max-w-64"
              />
              <p className="text-xs text-muted-foreground">{t("scheduledHint")}</p>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Tag className="size-4 text-red-500" />
                {t("productsLabel")} ({products.length}/{LIVE_LIMITS.products})
              </Label>
              <p className="text-xs text-muted-foreground">{t("productsHint")}</p>
              {products.length === 0 ? (
                <p className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
                  {t("noProductsAdded")}
                </p>
              ) : (
                <div className="space-y-2">
                  {products.map((p) => {
                    const livePrice = Math.round(p.price * (1 - p.discountPercent / 100) * 100) / 100;
                    return (
                      <div key={p.id} className="flex items-center gap-3 rounded-xl border bg-card p-2">
                        <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                          {p.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={p.image} alt="" className="size-full object-cover" />
                          ) : (
                            <Package className="size-4 text-muted-foreground" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{p.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatPrice(p.price)}
                            {p.discountPercent > 0 ? (
                              <>
                                {" → "}
                                <b className="text-red-600">
                                  {t("livePrice")} {formatPrice(livePrice)}
                                </b>
                              </>
                            ) : null}
                          </span>
                        </span>
                        <label className="flex items-center gap-1 text-xs text-muted-foreground">
                          {t("discountLabel")}
                          <Input
                            type="number"
                            min={0}
                            max={LIVE_LIMITS.maxDiscount}
                            value={p.discountPercent || ""}
                            placeholder="0"
                            onChange={(e) => setDiscount(p.id, e.target.value)}
                            className="h-8 w-16 text-center"
                          />
                        </label>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="size-8 shrink-0"
                          onClick={() => toggle(p)}
                          aria-label={t("remove")}
                        >
                          <X className="size-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="relative pt-1">
                <Search className="absolute start-3 top-1/2 mt-0.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("searchProducts")}
                  className="ps-9"
                />
              </div>
              <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border p-1">
                {searching ? (
                  <div className="flex justify-center p-4">
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  </div>
                ) : results.length === 0 ? (
                  <p className="p-3 text-center text-sm text-muted-foreground">{t("noProducts")}</p>
                ) : (
                  results.map((p) => {
                    const added = addedIds.has(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => toggle(p)}
                        className="flex w-full items-center gap-3 rounded-lg p-1.5 text-start hover:bg-muted"
                      >
                        <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                          {p.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={p.image} alt="" className="size-full object-cover" />
                          ) : (
                            <Package className="size-4 text-muted-foreground" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm">{p.name}</span>
                        <span className="text-xs text-muted-foreground">{formatPrice(p.price)}</span>
                        <span
                          className={
                            added
                              ? "flex size-6 items-center justify-center rounded-full bg-red-500 text-white"
                              : "flex size-6 items-center justify-center rounded-full border"
                          }
                        >
                          {added ? <Check className="size-3.5" /> : null}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t("cancel")}
          </Button>
          <Button onClick={() => void save()} disabled={saving} className="bg-red-600 hover:bg-red-700">
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
