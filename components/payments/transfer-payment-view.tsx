"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import QRCode from "qrcode";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Copy,
  Download,
  FileImage,
  ImagePlus,
  Loader2,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Upload,
  X,
  XCircle,
} from "lucide-react";
import Link from "@/components/language/link";
import { BankAccountCard } from "@/components/banks/bank-account-card";
import { findThaiBank, formatAccountNumber } from "@/lib/banks/thai-banks";
import { SLIP_MAX_BYTES, SLIP_MIME_TYPES } from "@/lib/payments/transfer-payment";
import type { TransferPaymentView as View } from "@/lib/payments/transfer-orders";
import { cn } from "@/lib/utils";

const PROMPTPAY_BLUE = "#113566";

function formatBaht(amount: number, locale: string) {
  return new Intl.NumberFormat(locale.startsWith("th") ? "th-TH" : locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/* ---------------------------------- bits ---------------------------------- */

function CopyButton({ value, label, className }: { value: string; label: string; className?: string }) {
  const t = useTranslations("storeText.transferPay");
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <button
      type="button"
      aria-label={t("copyAria", { label })}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => setCopied(false), 1600);
        } catch {
          /* clipboard refused: nothing to do */
        }
      }}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:border-emerald-400 hover:text-emerald-700 active:scale-95",
        copied && "border-emerald-400 bg-emerald-50 text-emerald-700",
        className,
      )}
    >
      {copied ? <Check className="size-3.5" strokeWidth={3} /> : <Copy className="size-3.5" />}
      {copied ? t("copied") : t("copy")}
    </button>
  );
}

/** Only this re-renders each second. */
function Countdown({
  deadline,
  totalMs,
  onExpire,
}: {
  deadline: number;
  totalMs: number;
  onExpire: () => void;
}) {
  const t = useTranslations("storeText.transferPay");
  // Null until mounted: the server's clock and this one never agree to the second.
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let fired = false;
    const tick = () => {
      const remaining = Math.max(0, deadline - Date.now());
      setLeft(remaining);
      if (remaining === 0) {
        if (!fired) {
          fired = true;
          onExpire();
        }
        return;
      }
      timer = setTimeout(tick, Math.min(1000, remaining));
    };
    tick();
    const onVisible = () => {
      if (!document.hidden) {
        clearTimeout(timer);
        tick();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [deadline, onExpire]);

  const seconds = Math.ceil((left ?? totalMs) / 1000);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const share = totalMs > 0 && left !== null ? Math.min(1, left / totalMs) : 1;
  const r = 30;
  const c = 2 * Math.PI * r;
  const urgent = left !== null && seconds <= 120;
  const text = left === null ? "--:--" : h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;

  return (
    <div className={cn("flex items-center gap-3", urgent && "text-red-600")}>
      <div className="relative size-[72px] shrink-0">
        <svg viewBox="0 0 72 72" className="size-full -rotate-90" aria-hidden>
          <circle cx="36" cy="36" r={r} fill="none" strokeWidth="6" className="stroke-slate-200" />
          <circle
            cx="36"
            cy="36"
            r={r}
            fill="none"
            strokeWidth="6"
            strokeLinecap="round"
            className={cn("transition-[stroke-dashoffset] duration-1000 ease-linear", urgent ? "stroke-red-500" : "stroke-emerald-500")}
            style={{ strokeDasharray: c, strokeDashoffset: c * (1 - share) }}
          />
        </svg>
        <strong
          role="timer"
          aria-label={t("timeLeftAria")}
          className={cn("absolute inset-0 flex items-center justify-center font-mono font-bold tabular-nums", h > 0 ? "text-xs" : "text-sm")}
        >
          {text}
        </strong>
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{t("payWithin")}</p>
        <p className={cn("text-sm font-semibold", urgent ? "text-red-600" : "text-slate-800")}>
          {urgent ? t("hurry") : t("keepPageOpen")}
        </p>
      </div>
    </div>
  );
}

function Stepper({ current }: { current: 1 | 2 | 3 }) {
  const t = useTranslations("storeText.transferPay");
  const steps = [t("stepTransfer"), t("stepSlip"), t("stepReview")];
  return (
    <ol className="flex items-center gap-2" aria-label={t("stepsAria")}>
      {steps.map((label, i) => {
        const step = (i + 1) as 1 | 2 | 3;
        const done = step < current;
        const active = step === current;
        return (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors",
                done && "bg-emerald-500 text-white",
                active && "bg-slate-900 text-white ring-4 ring-slate-900/10",
                !done && !active && "bg-slate-100 text-slate-400",
              )}
            >
              {done ? <Check className="size-3.5" strokeWidth={3} /> : step}
            </span>
            <span className={cn("truncate text-xs font-semibold sm:text-sm", active ? "text-slate-900" : "text-slate-400")}>{label}</span>
            {i < steps.length - 1 ? <span className={cn("h-0.5 flex-1 rounded-full", done ? "bg-emerald-400" : "bg-slate-200")} /> : null}
          </li>
        );
      })}
    </ol>
  );
}

function PromptPayCard({ view }: { view: View }) {
  const t = useTranslations("storeText.transferPay");
  const locale = useLocale();
  const [qr, setQr] = useState<string>("");
  const pp = view.promptpay!;

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(pp.payload, { errorCorrectionLevel: "M", margin: 1, width: 560, color: { dark: "#0f172a", light: "#ffffff" } })
      .then((url) => active && setQr(url))
      .catch(() => active && setQr(""));
    return () => {
      active = false;
    };
  }, [pp.payload]);

  return (
    <div className="mx-auto w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-slate-900/5">
      <div className="flex items-center justify-between gap-3 px-5 py-3.5 text-white" style={{ background: PROMPTPAY_BLUE }}>
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/banks/icons/PromptPay.png" alt="" className="size-9 rounded-lg bg-white object-contain p-1" />
          <div className="leading-tight">
            <p className="text-sm font-bold tracking-wide">THAI QR PAYMENT</p>
            <p className="text-[11px] opacity-80">{t("promptpayBrand")}</p>
          </div>
        </div>
        <QrCode className="size-5 opacity-80" />
      </div>
      <div className="px-6 pb-5 pt-5 text-center">
        <div className="relative mx-auto aspect-square w-full max-w-[260px] overflow-hidden rounded-2xl border-2 border-slate-100 bg-white p-2">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt={t("qrAlt")} className="size-full" />
          ) : (
            <div className="flex size-full items-center justify-center">
              <Loader2 className="size-8 animate-spin text-slate-300" />
            </div>
          )}
        </div>
        <p className="mt-4 text-xs font-medium text-muted-foreground">{t("scanToPay")}</p>
        <p className="mt-0.5 text-3xl font-extrabold tracking-tight text-slate-900 tabular-nums">
          ฿{formatBaht(view.total, locale)}
        </p>
        <div className="mt-4 space-y-1 rounded-2xl bg-slate-50 px-4 py-3 text-start text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">{t("accountName")}</span>
            <span className="truncate font-semibold">{pp.accountName || "—"}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">{t(`idType.${pp.idType}`)}</span>
            <span className="font-mono font-semibold tracking-wide">{pp.maskedId}</span>
          </div>
        </div>
        {qr ? (
          <a
            href={qr}
            download={`promptpay-${view.orderNumber}.png`}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-slate-900 px-4 py-2.5 text-sm font-bold text-slate-900 transition-colors hover:bg-slate-900 hover:text-white"
          >
            <Download className="size-4" />
            {t("saveQr")}
          </a>
        ) : null}
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">{t("saveQrHint")}</p>
      </div>
    </div>
  );
}

function BankAccounts({ view }: { view: View }) {
  const t = useTranslations("storeText.transferPay");
  const accounts = view.accounts ?? [];
  return (
    <div className="space-y-5">
      {accounts.map((a, i) => {
        const bank = findThaiBank(a.bankName);
        return (
          <div key={`${a.accountNumber}-${i}`} className="space-y-3">
            <BankAccountCard bank={bank} bankName={a.bankName} accountName={a.accountName} accountNumber={a.accountNumber} className="mx-auto" />
            <div className="mx-auto flex max-w-sm flex-wrap items-center justify-between gap-2 rounded-2xl border bg-white px-4 py-3 shadow-sm">
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-muted-foreground">{t("accountNumber")}</p>
                <p className="font-mono text-base font-bold tracking-wider">{formatAccountNumber(a.accountNumber, bank)}</p>
                {a.branch ? <p className="text-[11px] text-muted-foreground">{a.branch}</p> : null}
              </div>
              <CopyButton value={a.accountNumber} label={t("accountNumber")} />
            </div>
          </div>
        );
      })}
      <p className="text-center text-xs text-muted-foreground">{t("onlyTheseAccounts")}</p>
    </div>
  );
}

function SlipUpload({
  token,
  disabled,
  onUploaded,
  rejected,
}: {
  token: string;
  disabled?: boolean;
  onUploaded: (view: View) => void;
  rejected?: boolean;
}) {
  const t = useTranslations("storeText.transferPay");
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [dragging, setDragging] = useState(false);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const pick = (f: File | undefined | null) => {
    setError(null);
    if (!f) return;
    if (!(SLIP_MIME_TYPES as readonly string[]).includes(f.type)) {
      setError(t("slipTypeError"));
      return;
    }
    if (f.size > SLIP_MAX_BYTES) {
      setError(t("slipSizeError"));
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const clear = () => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const send = async () => {
    if (!file) return;
    setSending(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(`/api/payments/transfer/${encodeURIComponent(token)}/slip`, { method: "POST", body });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.message || json?.error || t("slipSendError"));
      }
      clear();
      onUploaded(json.data as View);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("slipSendError"));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept={SLIP_MIME_TYPES.join(",")}
        className="sr-only"
        onChange={(e) => pick(e.target.files?.[0])}
        disabled={disabled || sending}
      />
      {!file ? (
        <button
          type="button"
          disabled={disabled || sending}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            pick(e.dataTransfer.files?.[0]);
          }}
          className={cn(
            "flex w-full flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed px-6 py-8 text-center transition-colors disabled:opacity-60",
            dragging ? "border-emerald-500 bg-emerald-50" : "border-slate-300 bg-slate-50/60 hover:border-emerald-400 hover:bg-emerald-50/50",
          )}
        >
          <span className="flex size-14 items-center justify-center rounded-2xl bg-white text-emerald-600 shadow-sm ring-1 ring-slate-900/5">
            <ImagePlus className="size-7" />
          </span>
          <span className="text-base font-bold text-slate-900">{rejected ? t("pickNewSlip") : t("pickSlip")}</span>
          <span className="text-xs text-muted-foreground">{t("slipRules")}</span>
        </button>
      ) : (
        <div className="overflow-hidden rounded-3xl border bg-white shadow-sm">
          <div className="relative flex max-h-80 justify-center bg-slate-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt={t("slipPreviewAlt")} className="max-h-80 object-contain" />
          </div>
          <div className="flex items-center gap-3 px-4 py-3">
            <FileImage className="size-5 shrink-0 text-emerald-600" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{file.name}</p>
              <p className="text-[11px] text-muted-foreground">{Math.ceil(file.size / 1024).toLocaleString()} KB</p>
            </div>
            <button
              type="button"
              onClick={clear}
              disabled={sending}
              aria-label={t("removeSlip")}
              className="flex size-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}

      {error ? (
        <div role="alert" className="flex items-start gap-2 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p>{error}</p>
        </div>
      ) : null}

      <button
        type="button"
        onClick={send}
        disabled={!file || sending || disabled}
        className="flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3.5 text-base font-bold text-white shadow-lg shadow-emerald-600/25 transition-all hover:bg-emerald-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
      >
        {sending ? <Loader2 className="size-5 animate-spin" /> : <Upload className="size-5" />}
        {sending ? t("sending") : t("sendSlip")}
      </button>
      <p className="text-center text-[11px] text-muted-foreground">{t("slipTip")}</p>
    </div>
  );
}

function ResultCard({
  tone,
  icon,
  title,
  body,
  children,
}: {
  tone: "success" | "warning" | "info";
  icon: React.ReactNode;
  title: string;
  body?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-md rounded-[2rem] bg-white p-6 text-center shadow-xl ring-1 ring-slate-900/5 sm:p-8">
      <div
        className={cn(
          "mx-auto flex size-20 items-center justify-center rounded-full",
          tone === "success" && "bg-emerald-100 text-emerald-600",
          tone === "warning" && "bg-red-100 text-red-600",
          tone === "info" && "bg-amber-100 text-amber-600",
        )}
      >
        {icon}
      </div>
      <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-slate-900">{title}</h1>
      {body ? <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p> : null}
      {children}
    </div>
  );
}

/* ---------------------------------- page ---------------------------------- */

export function TransferPaymentView({ token, initial }: { token: string; initial: View }) {
  const t = useTranslations("storeText.transferPay");
  const locale = useLocale();
  const [view, setView] = useState<View>(initial);
  const [refreshing, setRefreshing] = useState(false);
  const [itemsOpen, setItemsOpen] = useState(false);

  // The server's clock decides the deadline; correct for this device's.
  const skew = useMemo(() => new Date(initial.serverNow).getTime() - Date.now(), [initial.serverNow]);
  const deadline = new Date(view.expiresAt).getTime() - skew;
  const totalMs = view.timeLimitMinutes * 60_000;

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/payments/transfer/${encodeURIComponent(token)}`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success) setView(json.data as View);
    } finally {
      setRefreshing(false);
    }
  }, [token]);

  // Poll while the store is checking, slower while the shopper is paying.
  useEffect(() => {
    if (view.outcome !== "open") return;
    const every = view.status === "reviewing" ? 5000 : 15000;
    const id = setInterval(() => {
      if (!document.hidden) void refresh();
    }, every);
    return () => clearInterval(id);
  }, [view.outcome, view.status, refresh]);

  const onExpire = useCallback(() => {
    setTimeout(() => void refresh(), 1500);
  }, [refresh]);

  const amount = `฿${formatBaht(view.total, locale)}`;
  const methodLabel = view.method === "promptpay" ? t("methodPromptpay") : t("methodBank");

  const wrap = (children: React.ReactNode) => (
    <div className="min-h-[calc(100dvh-4rem)] bg-linear-to-b from-emerald-50/70 via-white to-white">
      <div className="mx-auto w-full max-w-5xl px-4 pb-16 pt-5 sm:pt-8">{children}</div>
    </div>
  );

  if (view.outcome === "paid") {
    return wrap(
      <ResultCard tone="success" icon={<CheckCircle2 className="size-10" />} title={t("paidTitle")} body={t("paidBody")}>
        <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">{t("orderNumber")}</span><span className="font-semibold">{view.orderNumber}</span></div>
          <div className="mt-1 flex justify-between"><span className="text-muted-foreground">{t("amountPaid")}</span><span className="font-bold">{amount}</span></div>
        </div>
        <div className="mt-6 grid gap-2">
          <Link href="/account/orders" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800">
            {t("viewOrders")}
            <ArrowRight className="size-4" />
          </Link>
          <Link href="/" className="rounded-2xl px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50">{t("continueShopping")}</Link>
        </div>
      </ResultCard>,
    );
  }

  if (view.outcome === "cancelled") {
    return wrap(
      <ResultCard
        tone="warning"
        icon={<XCircle className="size-10" />}
        title={view.status === "expired" ? t("expiredTitle") : t("cancelledTitle")}
        body={t("expiredBody")}
      >
        <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">{t("orderNumber")}</span><span className="font-semibold">{view.orderNumber}</span></div>
          <div className="mt-1 flex justify-between"><span className="text-muted-foreground">{t("amount")}</span><span className="font-bold">{amount}</span></div>
        </div>
        <Link href="/" className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800">
          {t("backToShop")}
        </Link>
      </ResultCard>,
    );
  }

  if (view.status === "reviewing") {
    return wrap(
      <>
        <div className="mx-auto mb-6 max-w-md"><Stepper current={3} /></div>
        <ResultCard tone="info" icon={<Clock3 className="size-10" />} title={t("reviewTitle")} body={t("reviewBody")}>
          <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-amber-500" />
            </span>
            {t("reviewing")}
          </span>
          <div className="mt-6 space-y-1.5 rounded-2xl bg-slate-50 p-4 text-start text-sm">
            <div className="flex justify-between gap-3"><span className="text-muted-foreground">{t("orderNumber")}</span><span className="font-semibold">{view.orderNumber}</span></div>
            <div className="flex justify-between gap-3"><span className="text-muted-foreground">{t("amount")}</span><span className="font-bold">{amount}</span></div>
            <div className="flex justify-between gap-3"><span className="text-muted-foreground">{t("method")}</span><span className="font-semibold">{methodLabel}</span></div>
            {view.slipUploadedAt ? (
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">{t("slipSentAt")}</span>
                <span className="font-semibold">
                  {new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(view.slipUploadedAt))}
                </span>
              </div>
            ) : null}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">{t("noDoublePay")}</p>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={refreshing}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border-2 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
            {t("checkStatus")}
          </button>
        </ResultCard>
      </>,
    );
  }

  const rejected = view.status === "rejected";

  return wrap(
    <>
      <h1 className="sr-only">{t("pageTitle")}</h1>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600/10 px-3 py-1 text-xs font-bold text-emerald-700">
          <ShieldCheck className="size-3.5" />
          {t("secure")}
        </span>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm ring-1 ring-slate-900/5">
          {methodLabel}
        </span>
      </div>

      <div className="mb-6 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-900/5">
        <Stepper current={1} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] lg:items-start">
        {/* Summary */}
        <aside className="space-y-4 lg:sticky lg:top-24">
          <div className="overflow-hidden rounded-3xl bg-slate-900 p-5 text-white shadow-xl">
            <p className="text-xs font-medium text-white/60">{t("amountToPay")}</p>
            <div className="mt-1 flex items-end justify-between gap-3">
              <p className="text-4xl font-extrabold tracking-tight tabular-nums">{amount}</p>
              <CopyButton value={view.total.toFixed(2)} label={t("amount")} className="border-white/20 bg-white/10 text-white hover:text-white" />
            </div>
            <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-white/10 px-3.5 py-2.5">
              <div className="min-w-0">
                <p className="text-[11px] text-white/60">{t("orderNumber")}</p>
                <p className="truncate font-mono text-sm font-bold">{view.orderNumber}</p>
              </div>
              <CopyButton value={view.orderNumber} label={t("orderNumber")} className="border-white/20 bg-white/10 text-white hover:text-white" />
            </div>
          </div>

          <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-900/5">
            <Countdown deadline={deadline} totalMs={totalMs} onExpire={onExpire} />
          </div>

          {view.items.length > 0 ? (
            <div className="rounded-3xl bg-white shadow-sm ring-1 ring-slate-900/5">
              <button
                type="button"
                onClick={() => setItemsOpen((o) => !o)}
                className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold"
              >
                {t("itemsCount", { count: view.items.reduce((n, i) => n + i.quantity, 0) })}
                <ChevronDown className={cn("size-4 transition-transform", itemsOpen && "rotate-180")} />
              </button>
              {itemsOpen ? (
                <ul className="space-y-2 border-t px-4 py-3">
                  {view.items.map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm">
                      {item.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.image} alt="" className="size-10 rounded-lg object-cover" />
                      ) : (
                        <span className="size-10 rounded-lg bg-slate-100" />
                      )}
                      <span className="line-clamp-2 flex-1">{item.name}</span>
                      <span className="text-muted-foreground">×{item.quantity}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          <div className="flex items-start gap-3 rounded-2xl bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800 ring-1 ring-amber-200">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" />
            <p>{t("checkBeforeConfirm")}</p>
          </div>
        </aside>

        {/* Pay + slip */}
        <div className="space-y-6">
          {rejected ? (
            <div role="alert" className="flex items-start gap-3 rounded-3xl bg-red-50 p-4 text-red-800 ring-1 ring-red-200">
              <AlertTriangle className="mt-0.5 size-5 shrink-0" />
              <div className="min-w-0">
                <p className="font-bold">{t("rejectedTitle")}</p>
                <p className="mt-0.5 text-sm">{view.rejectReason || t("rejectedBody")}</p>
                <p className="mt-1 text-xs opacity-80">{t("rejectedHint")}</p>
              </div>
            </div>
          ) : null}

          <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-900/5 sm:p-6">
            <div className="mb-5 flex items-start gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">1</span>
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {view.method === "promptpay" ? t("step1PromptpayTitle") : t("step1BankTitle")}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {view.method === "promptpay" ? t("step1PromptpayBody", { amount }) : t("step1BankBody", { amount })}
                </p>
              </div>
            </div>
            {view.method === "promptpay" && view.promptpay ? <PromptPayCard view={view} /> : <BankAccounts view={view} />}
            {view.instructions ? (
              <p className="mt-5 whitespace-pre-line rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">{view.instructions}</p>
            ) : null}
          </section>

          <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-900/5 sm:p-6">
            <div className="mb-5 flex items-start gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">2</span>
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {t("step2Title")}
                  {view.slipRequired ? <span className="ms-1.5 text-red-500">*</span> : null}
                </h2>
                <p className="text-sm text-muted-foreground">{t("step2Body")}</p>
              </div>
            </div>
            <SlipUpload token={token} onUploaded={setView} rejected={rejected} />
          </section>
        </div>
      </div>
    </>,
  );
}
