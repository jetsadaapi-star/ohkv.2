"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  Clock3,
  ExternalLink,
  ImageOff,
  Loader2,
  QrCode,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
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
import { BankLogo } from "@/components/banks/bank-account-card";
import { findThaiBank, formatAccountNumber } from "@/lib/banks/thai-banks";
import { formatPromptPayId } from "@/lib/payments/promptpay";
import type { TransferPaymentView } from "@/lib/payments/transfer-orders";
import { cn } from "@/lib/utils";

type AdminState = TransferPaymentView & {
  hasSlip: boolean;
  reviewedAt?: string;
  rejectReason?: string;
  token: string;
  promptpayId?: { idType: "phone" | "national_id" | "tax_id" | "ewallet"; idValue: string };
};

const STATUS_TONE: Record<string, string> = {
  awaiting_slip: "bg-slate-100 text-slate-700 ring-slate-200",
  reviewing: "bg-amber-50 text-amber-700 ring-amber-200",
  approved: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  rejected: "bg-red-50 text-red-700 ring-red-200",
  expired: "bg-slate-100 text-slate-500 ring-slate-200",
};

/**
 * The slip a shopper attached to a PromptPay / bank-transfer order, and the
 * store's decision on it. Approving marks the order paid.
 */
export function OrderTransferReview({ orderId, canReview }: { orderId: string; canReview: boolean }) {
  const t = useTranslations("admin.hc.transferReview");
  const locale = useLocale();
  const router = useRouter();
  const [state, setState] = useState<AdminState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [slipFailed, setSlipFailed] = useState(false);
  // A checked slip folds to one line; the full card opens on request.
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/transfer`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      setState(res.ok && json?.success ? (json.data as AdminState) : null);
      setSlipFailed(false);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (decision: "approved" | "rejected") => {
    setBusy(decision === "approved" ? "approve" : "reject");
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, reason: decision === "rejected" ? reason.trim() || undefined : undefined }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.message || json?.error || t("actionFailed"));
      toast.success(decision === "approved" ? t("approvedToast") : t("rejectedToast"));
      setRejectOpen(false);
      setReason("");
      setState(json.data as AdminState);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("actionFailed"));
    } finally {
      setBusy(null);
    }
  };

  if (loading && !state) {
    return (
      <div className="flex items-center gap-2 rounded-3xl border bg-card p-5 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        {t("loading")}
      </div>
    );
  }
  if (!state) return null;

  const amount = `฿${new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2 }).format(state.total)}`;
  const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });
  const canDecide = canReview && state.outcome === "open" && state.status === "reviewing";
  const canApproveWithoutSlip = canReview && state.outcome === "open" && state.status !== "reviewing";
  const quickReasons = [t("reasonAmount"), t("reasonUnreadable"), t("reasonAccount"), t("reasonDuplicate")];
  // Nothing left to decide: approved, or the order closed without a payment.
  const settled = state.outcome !== "open" || state.status === "approved" || state.status === "expired";
  const slipHref = `/api/admin/orders/${orderId}/transfer/slip?v=${state.slipCount}`;

  if (settled && !expanded) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card px-4 py-3 shadow-sm">
        <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/5">
          {state.method === "promptpay" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/banks/icons/PromptPay.png" alt="" className="size-full object-contain p-1" />
          ) : (
            <QrCode className="size-4 text-slate-500" />
          )}
        </span>
        <div className="min-w-[12rem] flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">{t("title")}</p>
            <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset", STATUS_TONE[state.status])}>
              {state.status === "approved" ? <CheckCircle2 className="size-3" /> : <XCircle className="size-3" />}
              {t(`status.${state.status}`)}
            </span>
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {state.method === "promptpay" ? t("methodPromptpay") : t("methodBank")} · {amount}
            {state.reviewedAt ? ` · ${t("reviewedAt")} ${dateFmt.format(new Date(state.reviewedAt))}` : ""}
          </p>
        </div>
        <div className="flex w-full shrink-0 items-center justify-end gap-1 sm:w-auto">
          {state.hasSlip ? (
            <Button asChild variant="outline" size="sm" className="h-8 gap-1.5">
              <a href={slipHref} target="_blank" rel="noreferrer">
                <Eye className="size-3.5" />
                {t("viewSlip")}
              </a>
            </Button>
          ) : null}
          <Button variant="ghost" size="sm" className="h-8 gap-1" onClick={() => setExpanded(true)}>
            {t("details")}
            <ChevronDown className="size-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-3xl border bg-card shadow-sm",
        state.status === "reviewing" && "border-amber-300 ring-4 ring-amber-100 dark:ring-amber-500/10",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/30 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/5">
            {state.method === "promptpay" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src="/banks/icons/PromptPay.png" alt="" className="size-full object-contain p-1" />
            ) : (
              <QrCode className="size-5 text-slate-500" />
            )}
          </span>
          <div>
            <h3 className="font-semibold leading-tight">{t("title")}</h3>
            <p className="text-xs text-muted-foreground">
              {state.method === "promptpay" ? t("methodPromptpay") : t("methodBank")} · {amount}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset", STATUS_TONE[state.status])}>
            {state.status === "reviewing" ? <Clock3 className="size-3.5" /> : null}
            {state.status === "approved" ? <CheckCircle2 className="size-3.5" /> : null}
            {state.status === "rejected" || state.status === "expired" ? <XCircle className="size-3.5" /> : null}
            {t(`status.${state.status}`)}
          </span>
          {settled ? (
            <Button variant="ghost" size="sm" className="h-8 gap-1" onClick={() => setExpanded(false)}>
              {t("collapse")}
              <ChevronUp className="size-3.5" />
            </Button>
          ) : null}
          <Button variant="ghost" size="icon" className="size-8" onClick={() => void load()} aria-label={t("refresh")}>
            <RefreshCw className={cn("size-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      <div className="grid gap-5 p-5 md:grid-cols-[minmax(0,240px)_minmax(0,1fr)]">
        {/* Slip */}
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">{t("slip")}</p>
          {state.hasSlip && !slipFailed ? (
            <a
              href={slipHref}
              target="_blank"
              rel="noreferrer"
              className="group relative block overflow-hidden rounded-2xl border bg-muted/40"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/admin/orders/${orderId}/transfer/slip?v=${state.slipCount}`}
                alt={t("slipAlt")}
                className="max-h-96 w-full object-contain"
                onError={() => setSlipFailed(true)}
              />
              <span className="absolute end-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[11px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                <ExternalLink className="size-3" />
                {t("openFull")}
              </span>
            </a>
          ) : (
            <div className="flex aspect-[3/4] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed bg-muted/30 p-4 text-center text-xs text-muted-foreground">
              <ImageOff className="size-6" />
              {slipFailed ? t("slipLoadFailed") : t("noSlip")}
            </div>
          )}
          {state.slipUploadedAt ? (
            <p className="mt-2 text-[11px] text-muted-foreground">
              {t("sentAt", { date: dateFmt.format(new Date(state.slipUploadedAt)), count: state.slipCount })}
            </p>
          ) : null}
        </div>

        {/* Details + decision */}
        <div className="space-y-4">
          <dl className="grid gap-2 rounded-2xl bg-muted/30 p-4 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">{t("expected")}</dt>
              <dd className="text-base font-bold">{amount}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">{t("deadline")}</dt>
              <dd className="font-medium">{dateFmt.format(new Date(state.expiresAt))}</dd>
            </div>
            {state.reviewedAt ? (
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{t("reviewedAt")}</dt>
                <dd className="font-medium">{dateFmt.format(new Date(state.reviewedAt))}</dd>
              </div>
            ) : null}
            {state.rejectReason && state.status === "rejected" ? (
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{t("rejectReason")}</dt>
                <dd className="text-end font-medium text-red-600">{state.rejectReason}</dd>
              </div>
            ) : null}
          </dl>

          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">{t("paidInto")}</p>
            {state.method === "promptpay" && state.promptpayId ? (
              <div className="flex items-center gap-3 rounded-2xl border p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/banks/icons/PromptPay.png" alt="" className="size-9 rounded-lg object-contain" />
                <div className="min-w-0 text-sm">
                  <p className="font-semibold">{state.promptpay?.accountName || "—"}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {t(`idType.${state.promptpayId.idType}`)} · {formatPromptPayId(state.promptpayId.idType, state.promptpayId.idValue)}
                  </p>
                </div>
              </div>
            ) : (
              <ul className="space-y-2">
                {(state.accounts ?? []).map((a, i) => {
                  const bank = findThaiBank(a.bankName);
                  return (
                    <li key={i} className="flex items-center gap-3 rounded-2xl border p-3">
                      {bank ? <BankLogo bank={bank} size={36} /> : null}
                      <div className="min-w-0 text-sm">
                        <p className="truncate font-semibold">{a.accountName}</p>
                        <p className="font-mono text-xs text-muted-foreground">
                          {bank?.name || a.bankName} · {formatAccountNumber(a.accountNumber, bank)}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {canDecide || canApproveWithoutSlip ? (
            <div className="space-y-2 rounded-2xl border border-dashed p-4">
              <p className="flex items-start gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                {canDecide ? t("checkHint") : t("noSlipHint")}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void decide("approved")} disabled={Boolean(busy)} className="bg-emerald-600 hover:bg-emerald-700">
                  {busy === "approve" ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                  {t("approve")}
                </Button>
                {canDecide ? (
                  <Button variant="outline" onClick={() => setRejectOpen(true)} disabled={Boolean(busy)} className="text-red-600 hover:text-red-700">
                    <XCircle className="size-4" />
                    {t("reject")}
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("rejectTitle")}</DialogTitle>
            <DialogDescription>{t("rejectDescription")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-1.5">
            {quickReasons.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors hover:border-red-300",
                  reason === r && "border-red-400 bg-red-50 text-red-700",
                )}
              >
                {r}
              </button>
            ))}
          </div>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={300} placeholder={t("reasonPlaceholder")} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              {t("cancel")}
            </Button>
            <Button variant="destructive" onClick={() => void decide("rejected")} disabled={Boolean(busy)}>
              {busy === "reject" ? <Loader2 className="size-4 animate-spin" /> : null}
              {t("confirmReject")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
