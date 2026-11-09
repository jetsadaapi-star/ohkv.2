"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { CalendarClock, Loader2, Pencil, Plus, Square, Trash2, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { VendorPageHeader } from "@/components/vendor/vendor-page-header";
import { CollectionProductSelector } from "@/components/admin/collection-product-selector";
import { apiClient } from "@/lib/api/client";
import { useCurrency } from "@/providers/currency-provider";
import { cn } from "@/lib/utils";

type SaleState = "scheduled" | "live" | "ended" | "cancelled";

interface SaleProduct {
  _id: string;
  name?: string;
  price?: number;
  comparePrice?: number;
  images?: Array<string | { url?: string }>;
}

interface SaleItem {
  productId: SaleProduct | string;
  discountPercent: number;
  quantityLimit?: number | null;
  soldCount?: number;
  endedEarly?: boolean;
  skippedReason?: string;
}

interface Sale {
  _id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  state: SaleState;
  items: SaleItem[];
}

interface DraftItem {
  productId: string;
  discountPercent: number;
  quantityLimit: number | "";
}

interface Draft {
  id?: string;
  /** Running now: the products carry the sale price, the regular one is the compare-at price. */
  live?: boolean;
  name: string;
  startsAt: string;
  endsAt: string;
  items: DraftItem[];
}

const STATE_STYLE: Record<SaleState, string> = {
  live: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  scheduled: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  ended: "bg-muted text-muted-foreground",
  cancelled: "bg-muted text-muted-foreground line-through",
};

/** A Date as a datetime-local value, in the browser's time zone. */
function toLocalInput(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function productIdOf(item: SaleItem) {
  return typeof item.productId === "string" ? item.productId : item.productId._id;
}

function imageOf(product?: SaleProduct) {
  const first = product?.images?.[0];
  return typeof first === "string" ? first : first?.url;
}

/**
 * Admin → Flash Sale: the sales, scheduled, running and over, and the form
 * that makes one — a window, products, and for each a discount and an
 * optional cap on units.
 */
export function FlashSalesManager() {
  const t = useTranslations("admin.flashSales");
  const locale = useLocale();
  const { formatPrice } = useCurrency();
  const [sales, setSales] = useState<Sale[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [details, setDetails] = useState<Record<string, SaleProduct>>({});
  const [bulkDiscount, setBulkDiscount] = useState(20);

  const load = useCallback(async () => {
    try {
      const data = await apiClient.get<{ sales: Sale[] }>("/api/admin/flash-sales");
      setSales(data.sales);
      const known: Record<string, SaleProduct> = {};
      for (const sale of data.sales) {
        for (const item of sale.items) {
          if (typeof item.productId !== "string") known[item.productId._id] = item.productId;
        }
      }
      setDetails((current) => ({ ...known, ...current }));
    } catch {
      setSales([]);
      toast.error(t("loadFailed"));
    }
  }, [t]);

  useEffect(() => {
    // The list loads once on arrival; saving reloads it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  // The rows of the form need each picked product's name and price.
  const missing = useMemo(
    () => (draft?.items ?? []).map((item) => item.productId).filter((id) => !details[id]),
    [draft, details],
  );
  useEffect(() => {
    if (missing.length === 0) return;
    let cancelled = false;
    Promise.all(missing.map((id) => apiClient.get<SaleProduct>(`/api/admin/products/${id}`).catch(() => null))).then(
      (rows) => {
        if (cancelled) return;
        setDetails((current) => {
          const next = { ...current };
          for (const row of rows) if (row?._id) next[row._id] = row;
          return next;
        });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [missing]);

  const dateTime = (value: string) =>
    new Date(value).toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  const openNew = () => {
    const start = new Date(Date.now() + 10 * 60_000);
    start.setSeconds(0, 0);
    const end = new Date(start.getTime() + 6 * 3_600_000);
    setDraft({ name: "", startsAt: toLocalInput(start), endsAt: toLocalInput(end), items: [] });
  };

  const openEdit = (sale: Sale) => {
    setDraft({
      id: sale._id,
      live: sale.state === "live",
      name: sale.name,
      startsAt: toLocalInput(new Date(sale.startsAt)),
      endsAt: toLocalInput(new Date(sale.endsAt)),
      items: sale.items.map((item) => ({
        productId: productIdOf(item),
        discountPercent: item.discountPercent,
        quantityLimit: item.quantityLimit ?? "",
      })),
    });
  };

  const setPicked = (ids: string[]) => {
    setDraft((current) => {
      if (!current) return current;
      const byId = new Map(current.items.map((item) => [item.productId, item]));
      return {
        ...current,
        items: ids.map((id) => byId.get(id) ?? { productId: id, discountPercent: bulkDiscount, quantityLimit: "" }),
      };
    });
  };

  const setItem = (productId: string, patch: Partial<DraftItem>) => {
    setDraft((current) =>
      current
        ? { ...current, items: current.items.map((item) => (item.productId === productId ? { ...item, ...patch } : item)) }
        : current,
    );
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const body = {
        name: draft.name,
        startsAt: new Date(draft.startsAt).toISOString(),
        endsAt: new Date(draft.endsAt).toISOString(),
        items: draft.items.map((item) => ({
          productId: item.productId,
          discountPercent: Number(item.discountPercent),
          quantityLimit: item.quantityLimit === "" ? null : Number(item.quantityLimit),
        })),
      };
      if (draft.id) await apiClient.put(`/api/admin/flash-sales/${draft.id}`, body);
      else await apiClient.post("/api/admin/flash-sales", body);
      toast.success(t("saved"));
      setDraft(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const endNow = async (sale: Sale) => {
    if (!window.confirm(t("endConfirm", { name: sale.name }))) return;
    await apiClient.post(`/api/admin/flash-sales/${sale._id}`, {}).catch(() => toast.error(t("saveFailed")));
    await load();
  };

  const remove = async (sale: Sale) => {
    if (!window.confirm(t("deleteConfirm", { name: sale.name }))) return;
    await apiClient.delete(`/api/admin/flash-sales/${sale._id}`).catch(() => toast.error(t("saveFailed")));
    await load();
  };

  return (
    <div className="space-y-6">
      <VendorPageHeader
        icon={<Zap />}
        tone="silk"
        title={t("title")}
        description={t("description")}
        actions={
          <Button onClick={openNew} className="rounded-xl">
            <Plus className="size-4" />
            {t("new")}
          </Button>
        }
      />

      {sales === null ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : sales.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center">
          <Zap className="mx-auto size-10 text-[var(--highlight)]" />
          <p className="mt-3 font-semibold">{t("empty")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("emptyHint")}</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {sales.map((sale) => {
            const editable = sale.state === "scheduled" || sale.state === "live";
            const sold = sale.items.reduce((sum, item) => sum + (item.soldCount ?? 0), 0);
            return (
              <div key={sale._id} className="overflow-hidden rounded-2xl border bg-card">
                <div className="flex flex-wrap items-start gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-bold">{sale.name}</p>
                      <Badge className={cn("rounded-full border-0", STATE_STYLE[sale.state])}>{t(`state.${sale.state}`)}</Badge>
                    </div>
                    <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CalendarClock className="size-3.5" />
                      {dateTime(sale.startsAt)} → {dateTime(sale.endsAt)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("summary", { products: sale.items.length, sold })}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {editable ? (
                      <>
                        <Button size="icon" variant="ghost" aria-label={t("edit")} onClick={() => openEdit(sale)}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button size="icon" variant="ghost" aria-label={t("endNow")} onClick={() => void endNow(sale)}>
                          <Square className="size-4" />
                        </Button>
                      </>
                    ) : null}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      aria-label={t("delete")}
                      onClick={() => void remove(sale)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
                <ul className="divide-y border-t">
                  {sale.items.slice(0, 4).map((item) => {
                    const product = typeof item.productId === "string" ? details[item.productId] : item.productId;
                    return (
                      <li key={productIdOf(item)} className="flex items-center gap-3 px-4 py-2 text-sm">
                        {imageOf(product) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={imageOf(product)} alt="" className="size-9 rounded-lg object-cover" />
                        ) : (
                          <span className="size-9 rounded-lg bg-muted" />
                        )}
                        <span className="min-w-0 flex-1 truncate">{product?.name ?? productIdOf(item)}</span>
                        <span className="font-bold text-primary">-{item.discountPercent}%</span>
                        <span className="w-20 text-end text-xs text-muted-foreground">
                          {item.quantityLimit ? `${item.soldCount ?? 0}/${item.quantityLimit}` : `${item.soldCount ?? 0}`}
                        </span>
                        {item.endedEarly ? (
                          <Badge variant="outline" className="rounded-full text-[10px]">
                            {t(`skipped.${item.skippedReason ?? "sold_out"}`)}
                          </Badge>
                        ) : null}
                      </li>
                    );
                  })}
                  {sale.items.length > 4 ? (
                    <li className="px-4 py-2 text-xs text-muted-foreground">{t("more", { count: sale.items.length - 4 })}</li>
                  ) : null}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={Boolean(draft)} onOpenChange={(open) => (open ? null : setDraft(null))}>
        <DialogContent className="max-h-[92vh] grid-cols-1 overflow-x-hidden overflow-y-auto sm:max-w-3xl [&>*]:min-w-0">
          <DialogHeader>
            <DialogTitle>{draft?.id ? t("editTitle") : t("new")}</DialogTitle>
            <DialogDescription>{t("formHint")}</DialogDescription>
          </DialogHeader>
          {draft ? (
            <div className="min-w-0 space-y-5 [&_*]:min-w-0">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2 sm:col-span-3">
                  <Label htmlFor="flash-name">{t("name")}</Label>
                  <Input
                    id="flash-name"
                    value={draft.name}
                    maxLength={120}
                    placeholder={t("namePlaceholder")}
                    onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="flash-start">{t("startsAt")}</Label>
                  <Input
                    id="flash-start"
                    type="datetime-local"
                    value={draft.startsAt}
                    onChange={(event) => setDraft({ ...draft, startsAt: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="flash-end">{t("endsAt")}</Label>
                  <Input
                    id="flash-end"
                    type="datetime-local"
                    value={draft.endsAt}
                    onChange={(event) => setDraft({ ...draft, endsAt: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="flash-bulk">{t("bulkDiscount")}</Label>
                  <div className="flex gap-2">
                    <Input
                      id="flash-bulk"
                      type="number"
                      min={1}
                      max={90}
                      value={bulkDiscount}
                      onChange={(event) => setBulkDiscount(Math.min(90, Math.max(1, Number(event.target.value) || 1)))}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        setDraft({ ...draft, items: draft.items.map((item) => ({ ...item, discountPercent: bulkDiscount })) })
                      }
                    >
                      {t("applyAll")}
                    </Button>
                  </div>
                </div>
              </div>

              <CollectionProductSelector
                selectedProducts={draft.items.map((item) => item.productId)}
                onChange={setPicked}
                title={t("products")}
                max={100}
              />

              {draft.items.length > 0 ? (
                <div className="overflow-hidden rounded-xl border">
                  <div className="grid grid-cols-[1fr_88px_96px] gap-2 border-b bg-muted/50 px-3 py-2 text-xs font-semibold text-muted-foreground">
                    <span>{t("product")}</span>
                    <span>{t("discount")}</span>
                    <span>{t("limit")}</span>
                  </div>
                  <ul className="divide-y">
                    {draft.items.map((item) => {
                      const product = details[item.productId];
                      const regular =
                        draft.live && (product?.comparePrice ?? 0) > (product?.price ?? 0)
                          ? product?.comparePrice
                          : product?.price;
                      const salePrice =
                        typeof regular === "number"
                          ? Math.round(regular * (1 - Number(item.discountPercent) / 100) * 100) / 100
                          : null;
                      return (
                        <li key={item.productId} className="grid grid-cols-[1fr_88px_96px] items-center gap-2 px-3 py-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{product?.name ?? "…"}</p>
                            {salePrice !== null ? (
                              <p className="text-xs text-muted-foreground">
                                <span className="line-through">{formatPrice(regular!)}</span>{" "}
                                <span className="font-semibold text-primary">{formatPrice(salePrice)}</span>
                              </p>
                            ) : null}
                          </div>
                          <div className="relative">
                            <Input
                              type="number"
                              min={1}
                              max={90}
                              aria-label={t("discount")}
                              value={item.discountPercent}
                              onChange={(event) =>
                                setItem(item.productId, {
                                  discountPercent: Math.min(90, Math.max(1, Number(event.target.value) || 1)),
                                })
                              }
                              className="pe-6"
                            />
                            <span className="pointer-events-none absolute end-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                          </div>
                          <Input
                            type="number"
                            min={0}
                            aria-label={t("limit")}
                            placeholder={t("noLimit")}
                            value={item.quantityLimit}
                            onChange={(event) =>
                              setItem(item.productId, {
                                quantityLimit: event.target.value === "" ? "" : Math.max(0, Math.floor(Number(event.target.value))),
                              })
                            }
                          />
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
              <p className="text-xs text-muted-foreground">{t("note")}</p>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)} disabled={saving}>
              {t("cancel")}
            </Button>
            <Button
              onClick={() => void save()}
              disabled={saving || !draft?.name.trim() || !draft?.items.length}
              className="rounded-xl"
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
