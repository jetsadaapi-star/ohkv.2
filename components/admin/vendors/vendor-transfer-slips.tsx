"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { CheckCircle2, Clock3, ImageOff, Landmark, Loader2, QrCode, Receipt, Store, XCircle } from "lucide-react";
import Link from "@/components/language/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { VendorPageHeader } from "@/components/vendor/vendor-page-header";
import { apiClient } from "@/lib/api/client";
import { useCurrency } from "@/providers/currency-provider";
import { cn } from "@/lib/utils";

interface Row {
  id: string;
  kind: "boost" | "subscription" | "commission";
  kindLabel: string;
  description?: string;
  method: "promptpay" | "bank_transfer";
  amount: number;
  currency: string;
  reference: string;
  status: "awaiting_slip" | "reviewing" | "approved" | "rejected" | "expired";
  paymentStatus: string;
  vendor: { id: string; name: string; slug?: string } | null;
  createdAt: string;
  expiresAt: string;
  slipUploadedAt?: string;
  slipCount: number;
  hasSlip: boolean;
  rejectReason?: string;
  reviewedAt?: string;
}

const STATUS_STYLE: Record<Row["status"], string> = {
  reviewing: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  awaiting_slip: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  approved: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  rejected: "bg-red-500/15 text-red-700 dark:text-red-300",
  expired: "bg-muted text-muted-foreground",
};

/**
 * Admin → Vendors → Transfer slips: what vendors paid the marketplace by
 * PromptPay or bank transfer — an ad, a plan, commission — with the slip to
 * check against the bank. Approving finalizes the payment exactly as a
 * gateway would; rejecting tells the vendor why and lets them send another.
 */
export function VendorTransferSlips() {
  const t = useTranslations("admin.vendorTransfers");
  const locale = useLocale();
  const { formatPrice } = useCurrency();
  const [filter, setFilter] = useState<"reviewing" | "all">("reviewing");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Row | null>(null);
  const [rejecting, setRejecting] = useState<Row | null>(null);
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await apiClient.get<{ transfers: Row[] }>(`/api/admin/vendors/transfer-slips?filter=${filter}`);
      setRows(data.transfers);
    } catch {
      setRows([]);
      toast.error(t("loadFailed"));
    }
  }, [filter, t]);

  useEffect(() => {
    // Loads on arrival and whenever the tab changes; reviewing reloads it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const review = async (row: Row, action: "approve" | "reject", note?: string) => {
    setBusy(row.id);
    try {
      await apiClient.post(`/api/admin/vendors/transfer-slips/${row.id}`, { action, reason: note });
      toast.success(action === "approve" ? t("approved") : t("rejected"));
      setRejecting(null);
      setViewing(null);
      setReason("");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("reviewFailed"));
    } finally {
      setBusy(null);
    }
  };

  const when = (value?: string) =>
    value ? new Date(value).toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

  const slipUrl = (row: Row) => `/api/admin/vendors/transfer-slips/${row.id}/slip`;

  return (
    <div className="space-y-6">
      <VendorPageHeader icon={<Receipt />} tone="emerald" title={t("title")} description={t("description")} />

      <div className="inline-flex rounded-xl border bg-muted/40 p-1">
        {(["reviewing", "all"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setRows(null);
              setFilter(value);
            }}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition",
              filter === value ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t(`filter.${value}`)}
          </button>
        ))}
      </div>

      {rows === null ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center">
          <CheckCircle2 className="mx-auto size-10 text-emerald-500" />
          <p className="mt-3 font-semibold">{filter === "reviewing" ? t("emptyReviewing") : t("emptyAll")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("emptyHint")}</p>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {rows.map((row) => (
            <div key={row.id} className="flex gap-4 overflow-hidden rounded-2xl border bg-card p-4">
              <button
                type="button"
                onClick={() => (row.hasSlip ? setViewing(row) : null)}
                className={cn(
                  "relative flex h-36 w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted",
                  row.hasSlip && "cursor-zoom-in transition hover:ring-2 hover:ring-primary/40",
                )}
                aria-label={t("viewSlip")}
              >
                {row.hasSlip ? (
                  // Private storage behind an admin route: next/image cannot fetch it.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={slipUrl(row)} alt={t("slipAlt", { reference: row.reference })} className="size-full object-cover" />
                ) : (
                  <ImageOff className="size-6 text-muted-foreground" />
                )}
              </button>

              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={cn("rounded-full border-0", STATUS_STYLE[row.status])}>{t(`status.${row.status}`)}</Badge>
                  <Badge variant="outline" className="gap-1 rounded-full font-normal">
                    {row.method === "promptpay" ? <QrCode className="size-3" /> : <Landmark className="size-3" />}
                    {t(`method.${row.method}`)}
                  </Badge>
                </div>
                <p className="text-2xl font-extrabold tracking-tight tabular-nums">{formatPrice(row.amount)}</p>
                <p className="text-sm font-semibold">{row.kindLabel}</p>
                {row.description ? <p className="line-clamp-2 text-xs text-muted-foreground">{row.description}</p> : null}
                {row.vendor ? (
                  <Link
                    href={`/admin/vendors/${row.vendor.id}`}
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    <Store className="size-3.5" />
                    {row.vendor.name}
                  </Link>
                ) : null}
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  <dt>{t("reference")}</dt>
                  <dd className="truncate font-mono text-foreground">{row.reference}</dd>
                  <dt>{t("slipAt")}</dt>
                  <dd>{when(row.slipUploadedAt)}{row.slipCount > 1 ? ` · ${t("slipCount", { count: row.slipCount })}` : ""}</dd>
                  {row.status === "awaiting_slip" || row.status === "rejected" ? (
                    <>
                      <dt>{t("deadline")}</dt>
                      <dd>{when(row.expiresAt)}</dd>
                    </>
                  ) : null}
                  {row.rejectReason && row.status === "rejected" ? (
                    <>
                      <dt>{t("reason")}</dt>
                      <dd className="text-red-600">{row.rejectReason}</dd>
                    </>
                  ) : null}
                </dl>
                {row.status === "reviewing" ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      size="sm"
                      className="rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
                      disabled={busy === row.id}
                      onClick={() => void review(row, "approve")}
                    >
                      {busy === row.id ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                      {t("approve")}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl text-red-600 hover:text-red-700"
                      disabled={busy === row.id}
                      onClick={() => setRejecting(row)}
                    >
                      <XCircle className="size-4" />
                      {t("reject")}
                    </Button>
                  </div>
                ) : row.status === "awaiting_slip" ? (
                  <p className="inline-flex items-center gap-1 pt-1 text-xs text-muted-foreground">
                    <Clock3 className="size-3.5" />
                    {t("waitingForSlip")}
                  </p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={Boolean(viewing)} onOpenChange={(open) => (open ? null : setViewing(null))}>
        <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{viewing ? `${viewing.kindLabel} · ${formatPrice(viewing.amount)}` : ""}</DialogTitle>
            <DialogDescription>{viewing?.vendor?.name}</DialogDescription>
          </DialogHeader>
          {viewing ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={slipUrl(viewing)} alt={t("slipAlt", { reference: viewing.reference })} className="w-full rounded-xl border" />
          ) : null}
          {viewing?.status === "reviewing" ? (
            <DialogFooter className="gap-2">
              <Button variant="outline" className="text-red-600" onClick={() => setRejecting(viewing)} disabled={busy === viewing.id}>
                {t("reject")}
              </Button>
              <Button
                className="bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={() => void review(viewing, "approve")}
                disabled={busy === viewing.id}
              >
                {t("approve")}
              </Button>
            </DialogFooter>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(rejecting)} onOpenChange={(open) => (open ? null : setRejecting(null))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("rejectTitle")}</DialogTitle>
            <DialogDescription>{t("rejectHint")}</DialogDescription>
          </DialogHeader>
          <Textarea
            value={reason}
            maxLength={300}
            rows={3}
            placeholder={t("reasonPlaceholder")}
            onChange={(event) => setReason(event.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)}>
              {t("cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={!rejecting || busy === rejecting.id}
              onClick={() => rejecting && void review(rejecting, "reject", reason)}
            >
              {t("confirmReject")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
