"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Check,
  Clapperboard,
  EyeOff,
  Loader2,
  Package,
  Search,
  Send,
  ShoppingBag,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { MediaUploader, type UploadedMedia } from "@/components/ui/media-uploader";
import { toast } from "@/components/ui/toast-notification";
import { useCurrency } from "@/providers/currency-provider";
import { kalasinDistrictLabel } from "@/config/kalasin-districts";
import {
  SHORT_CLIP_LIMITS,
  type ClipDashboardItem,
  type ClipProductSummary,
  type ShortClipStatus,
} from "@/lib/clips/clip-types";
import { cn } from "@/lib/utils";

type Mode = "vendor" | "admin";

interface StoreOption {
  id: string;
  storeName: string;
  district: string;
  isDefault: boolean;
}

/** Whatever a product list endpoint returns, reduced to what the picker shows. */
function toSummary(raw: Record<string, unknown>): ClipProductSummary | null {
  const id = String(raw._id ?? raw.id ?? "");
  if (!id) return null;
  const images = Array.isArray(raw.images) ? (raw.images as string[]) : [];
  const media = Array.isArray(raw.media)
    ? (raw.media as Array<{ type?: string; url?: string; thumbnailUrl?: string }>)
    : [];
  const firstImage =
    media.find((m) => m.type === "image")?.url ??
    media.find((m) => m.thumbnailUrl)?.thumbnailUrl ??
    images[0];
  const range = raw.priceRange as { min?: number } | undefined;
  return {
    id,
    name: String(raw.name ?? raw.title ?? ""),
    slug: String(raw.slug ?? ""),
    image: firstImage || undefined,
    price: Number(range?.min ?? raw.price ?? 0) || 0,
    status: typeof raw.status === "string" ? raw.status : undefined,
  };
}

function videoMedia(clip: ClipDashboardItem | null): UploadedMedia[] {
  if (!clip?.videoUrl) return [];
  return [
    {
      _id: "clip-video",
      url: clip.videoUrl,
      type: "video",
      mimeType: clip.videoMimeType || "video/mp4",
      position: 0,
    },
  ];
}

function posterMedia(clip: ClipDashboardItem | null): UploadedMedia[] {
  if (!clip?.posterUrl) return [];
  return [
    { _id: "clip-poster", url: clip.posterUrl, type: "image", mimeType: "image/*", position: 0 },
  ];
}

export function ClipEditorDialog({
  mode,
  open,
  onOpenChange,
  clip,
  onSaved,
}: {
  mode: Mode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null for a new clip. */
  clip: ClipDashboardItem | null;
  onSaved: (clip: ClipDashboardItem) => void;
}) {
  const t = useTranslations("clips");
  const locale = useLocale();
  const { formatPrice } = useCurrency();

  const [vendorId, setVendorId] = useState(clip?.vendorId ?? "");
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [video, setVideo] = useState<UploadedMedia[]>(videoMedia(clip));
  const [poster, setPoster] = useState<UploadedMedia[]>(posterMedia(clip));
  const [title, setTitle] = useState(clip?.title ?? "");
  const [caption, setCaption] = useState(clip?.caption ?? "");
  const [products, setProducts] = useState<ClipProductSummary[]>(clip?.products ?? []);
  const [status, setStatus] = useState<ShortClipStatus>(clip?.status ?? "published");
  const [hiddenReason, setHiddenReason] = useState(clip?.hiddenReason ?? "");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ClipProductSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const lockedByAdmin = mode === "vendor" && clip?.status === "hidden";
  const vendorIdRef = useRef(vendorId);
  useEffect(() => {
    vendorIdRef.current = vendorId;
  }, [vendorId]);

  // Reset whenever another clip (or a new one) is opened.
  useEffect(() => {
    if (!open) return;
    setVendorId(clip?.vendorId ?? "");
    setVideo(videoMedia(clip));
    setPoster(posterMedia(clip));
    setTitle(clip?.title ?? "");
    setCaption(clip?.caption ?? "");
    setProducts(clip?.products ?? []);
    setStatus(clip?.status ?? "published");
    setHiddenReason(clip?.hiddenReason ?? "");
    setQuery("");
  }, [open, clip]);

  // Admin: the stores to choose from (server-searched).
  const loadStores = useCallback(
    async (search: string) => {
      if (mode !== "admin") return;
      try {
        const res = await fetch(
          `/api/admin/clips/stores?search=${encodeURIComponent(search)}`,
        );
        const json = await res.json();
        if (json?.success && Array.isArray(json.data)) {
          // The matches, plus the store already chosen so its label survives.
          setStores((current) => {
            const found = json.data as StoreOption[];
            const chosen = current.find((s) => s.id === vendorIdRef.current);
            return chosen && !found.some((s) => s.id === chosen.id)
              ? [chosen, ...found]
              : found;
          });
        }
      } catch {
        // The picker just stays as it was.
      }
    },
    [mode],
  );
  useEffect(() => {
    if (open) void loadStores("");
  }, [open, loadStores]);

  const storeOptions = useMemo(
    () =>
      stores.map((store) => ({
        value: store.id,
        label: `${store.storeName}${store.district ? ` · ${kalasinDistrictLabel(store.district, locale)}` : ""}`,
        keywords: store.storeName,
      })),
    [stores, locale],
  );

  // Product search, debounced; scoped to the clip's store.
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!open) return;
    if (mode === "admin" && !vendorId) {
      setResults([]);
      return;
    }
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const params = new URLSearchParams({ limit: "20" });
        if (query.trim()) params.set("search", query.trim());
        if (mode === "admin") params.set("vendor", vendorId);
        const res = await fetch(
          `/api/${mode === "admin" ? "admin" : "vendor"}/products?${params.toString()}`,
        );
        const json = await res.json();
        const rows = (json?.data?.data ?? json?.data ?? []) as Record<string, unknown>[];
        setResults(rows.map(toSummary).filter((p): p is ClipProductSummary => Boolean(p)));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [open, mode, vendorId, query]);

  const pinnedIds = useMemo(() => new Set(products.map((p) => p.id)), [products]);
  const togglePin = (product: ClipProductSummary) => {
    setProducts((current) => {
      if (current.some((p) => p.id === product.id)) {
        return current.filter((p) => p.id !== product.id);
      }
      if (current.length >= SHORT_CLIP_LIMITS.products) {
        toast.error(t("tooManyProducts", { max: SHORT_CLIP_LIMITS.products }));
        return current;
      }
      return [...current, product];
    });
  };

  const handleSave = async () => {
    const file = video[0];
    if (!file?.url) return toast.error(t("videoRequired"));
    if (mode === "admin" && !vendorId) return toast.error(t("storeRequired"));
    if (status === "published" && products.length === 0) {
      return toast.error(t("productsRequired"));
    }
    setSaving(true);
    try {
      const payload = {
        ...(mode === "admin" ? { vendorId, hiddenReason } : {}),
        title: title.trim(),
        caption: caption.trim(),
        videoUrl: file.url,
        videoMimeType: file.mimeType || "video/mp4",
        ...(file.size ? { videoSize: file.size } : {}),
        ...(file.width ? { videoWidth: file.width } : {}),
        ...(file.height ? { videoHeight: file.height } : {}),
        posterUrl: poster[0]?.url ?? "",
        productIds: products.map((p) => p.id),
        status,
      };
      const base = mode === "admin" ? "/api/admin/clips" : "/api/vendor/clips";
      const res = await fetch(clip ? `${base}/${clip.id}` : base, {
        method: clip ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.message || json?.error || t("saveFailed"));
      }
      toast.success(clip ? t("updated") : t("created"));
      onSaved(json.data as ClipDashboardItem);
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
            <span className="flex size-8 items-center justify-center rounded-lg bg-linear-to-br from-rose-500 to-violet-600 text-white">
              <Clapperboard className="size-4" />
            </span>
            {clip ? t("editTitle") : t("newTitle")}
          </DialogTitle>
          <DialogDescription>{t("editorDescription")}</DialogDescription>
        </DialogHeader>

        {lockedByAdmin ? (
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <EyeOff className="mt-0.5 size-4 shrink-0" />
            <span>
              {t("hiddenByAdmin")}
              {clip?.hiddenReason ? ` — ${clip.hiddenReason}` : ""}
            </span>
          </div>
        ) : null}

        <div className="grid gap-6 md:grid-cols-[260px_1fr]">
          {/* Left: the video, in the shape the feed plays it. */}
          <div className="space-y-3">
            <Label>{t("video")} *</Label>
            <MediaUploader
              value={video}
              onChange={(items) => setVideo(items.filter((i) => i.type === "video").slice(0, 1))}
              maxFiles={1}
              acceptTypes={["video"]}
              uploadTitle={t("uploadVideo")}
              uploadDescription={t("uploadVideoHint")}
              mediaGridClassName="grid-cols-1 md:grid-cols-1"
              previewAspectRatio="9 / 16"
              previewFit="cover"
              showCoverBadge={false}
              hideUploadZoneWhenFull
              disabled={lockedByAdmin}
            />
            <Label className="pt-2">{t("cover")}</Label>
            <MediaUploader
              value={poster}
              onChange={(items) => setPoster(items.filter((i) => i.type === "image").slice(0, 1))}
              maxFiles={1}
              acceptTypes={["image"]}
              uploadTitle={t("uploadCover")}
              uploadDescription={t("uploadCoverHint")}
              mediaGridClassName="grid-cols-1 md:grid-cols-1 max-w-28"
              previewAspectRatio="9 / 16"
              previewFit="cover"
              showCoverBadge={false}
              hideUploadZoneWhenFull
              disabled={lockedByAdmin}
            />
          </div>

          {/* Right: what it says and what it sells. */}
          <div className="space-y-4">
            {mode === "admin" ? (
              <div className="space-y-1.5">
                <Label htmlFor="clip-store">{t("store")} *</Label>
                <SearchableSelect
                  id="clip-store"
                  modal
                  options={storeOptions}
                  value={vendorId || undefined}
                  onValueChange={(value) => {
                    if (value !== vendorId) setProducts([]);
                    setVendorId(value);
                  }}
                  onSearch={(search) => void loadStores(search)}
                  placeholder={t("chooseStore")}
                  searchPlaceholder={t("searchStore")}
                  emptyText={t("noStore")}
                />
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="clip-title">{t("titleLabel")}</Label>
              <Input
                id="clip-title"
                value={title}
                maxLength={SHORT_CLIP_LIMITS.title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("titlePlaceholder")}
                disabled={lockedByAdmin}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="clip-caption">{t("caption")}</Label>
              <Textarea
                id="clip-caption"
                value={caption}
                rows={3}
                maxLength={SHORT_CLIP_LIMITS.caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder={t("captionPlaceholder")}
                disabled={lockedByAdmin}
              />
            </div>

            {/* Pinned products */}
            <div className="space-y-2 rounded-2xl border bg-muted/30 p-3">
              <div className="flex items-center justify-between gap-2">
                <Label className="flex items-center gap-1.5">
                  <ShoppingBag className="size-4 text-rose-500" />
                  {t("pinnedProducts")} *
                </Label>
                <span className="text-xs text-muted-foreground">
                  {products.length}/{SHORT_CLIP_LIMITS.products}
                </span>
              </div>
              {products.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {products.map((product, index) => (
                    <span
                      key={product.id}
                      className="inline-flex max-w-full items-center gap-2 rounded-full border bg-background py-1 ps-1 pe-2 text-xs shadow-xs"
                    >
                      <span className="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
                        {product.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={product.image} alt="" className="size-full object-cover" />
                        ) : (
                          <Package className="size-3.5 text-muted-foreground" />
                        )}
                      </span>
                      <span className="font-semibold text-rose-600">{index + 1}</span>
                      <span className="max-w-40 truncate">{product.name}</span>
                      {!lockedByAdmin ? (
                        <button
                          type="button"
                          onClick={() => togglePin(product)}
                          className="text-muted-foreground hover:text-foreground"
                          aria-label={t("unpin")}
                        >
                          <X className="size-3.5" />
                        </button>
                      ) : null}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">{t("noPinned")}</p>
              )}

              <div className="relative">
                <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={
                    mode === "admin" && !vendorId ? t("chooseStoreFirst") : t("searchProducts")
                  }
                  className="ps-8"
                  disabled={lockedByAdmin || (mode === "admin" && !vendorId)}
                />
                {searching ? (
                  <Loader2 className="absolute end-2.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                ) : null}
              </div>
              <div className="max-h-56 space-y-1 overflow-y-auto">
                {results.map((product) => {
                  const pinned = pinnedIds.has(product.id);
                  return (
                    <button
                      key={product.id}
                      type="button"
                      disabled={lockedByAdmin}
                      onClick={() => togglePin(product)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl border px-2 py-1.5 text-start text-sm transition-colors",
                        pinned
                          ? "border-rose-300 bg-rose-50 dark:bg-rose-950/30"
                          : "border-transparent bg-background hover:border-border",
                      )}
                    >
                      <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                        {product.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={product.image} alt="" className="size-full object-cover" />
                        ) : (
                          <Package className="size-4 text-muted-foreground" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{product.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {formatPrice(product.price)}
                          {product.status && product.status !== "active"
                            ? ` · ${product.status}`
                            : ""}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "flex size-6 shrink-0 items-center justify-center rounded-full border",
                          pinned ? "border-rose-500 bg-rose-500 text-white" : "text-transparent",
                        )}
                      >
                        <Check className="size-3.5" />
                      </span>
                    </button>
                  );
                })}
                {!searching && results.length === 0 && (mode === "vendor" || vendorId) ? (
                  <p className="px-1 py-2 text-xs text-muted-foreground">{t("noProducts")}</p>
                ) : null}
              </div>
            </div>

            {/* Status */}
            <div className="space-y-3 rounded-2xl border p-3">
              <label className="flex items-center justify-between gap-3">
                <span>
                  <span className="block text-sm font-medium">{t("publishNow")}</span>
                  <span className="block text-xs text-muted-foreground">{t("publishHint")}</span>
                </span>
                <Switch
                  checked={status === "published"}
                  disabled={lockedByAdmin || status === "hidden"}
                  onCheckedChange={(on) => setStatus(on ? "published" : "draft")}
                />
              </label>
              {mode === "admin" ? (
                <>
                  <label className="flex items-center justify-between gap-3">
                    <span>
                      <span className="block text-sm font-medium text-red-600">
                        {t("takeDown")}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {t("takeDownHint")}
                      </span>
                    </span>
                    <Switch
                      checked={status === "hidden"}
                      onCheckedChange={(on) => setStatus(on ? "hidden" : "draft")}
                    />
                  </label>
                  {status === "hidden" ? (
                    <Input
                      value={hiddenReason}
                      maxLength={300}
                      onChange={(e) => setHiddenReason(e.target.value)}
                      placeholder={t("takeDownReason")}
                    />
                  ) : null}
                </>
              ) : null}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t("cancel")}
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || lockedByAdmin}
            className="bg-linear-to-r from-rose-500 to-violet-600 text-white hover:opacity-90"
          >
            {saving ? <Loader2 className="me-2 size-4 animate-spin" /> : <Send className="me-2 size-4" />}
            {status === "published" ? t("savePublish") : t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
