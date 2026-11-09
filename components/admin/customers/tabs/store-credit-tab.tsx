"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Loader2, Plus, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionCard } from "../section-card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/ui/number-input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast-notification";
import { formatCurrency } from "@/lib/intl/money";
import { resolveCurrency } from "@/lib/intl/currencies";
import { useAppSettings } from "@/providers/app-settings-provider";

type Balance = {
  currency: string;
  balance: number;
  nextExpiry: { amount: number; expiresAt: string } | null;
};

type HistoryRow = {
  _id: string;
  type: "issue" | "redeem" | "expire";
  amount: number;
  currency: string;
  status?: "held" | "spent" | "released";
  source: string;
  remaining?: number;
  expiresAt?: string | null;
  note?: string;
  createdAt: string;
};

/** Message keys (admin.hc.customerDetail). */
const SOURCE_LABELS: Record<string, string> = {
  return_refund: "creditReturnRefund",
  order_refund: "creditOrderRefund",
  order_refund_restore: "creditOrderRefundRestore",
  goodwill: "creditGoodwill",
  loyalty: "creditLoyalty",
};

function money(amount: number, currencyCode: string) {
  const currency = resolveCurrency(String(currencyCode || "").toUpperCase() || "USD");
  return formatCurrency(Number(amount || 0), currency.code, currency.locale);
}

/**
 * A customer's store credit (R8): what they hold, and every change. Only an
 * admin gives credit (D3); staff who can see customers see it.
 */
export function StoreCreditTab({ customerId }: { customerId: string }) {
  const t = useTranslations("admin.hc.customerDetail");
  const locale = useLocale();
  const { defaultCurrency } = useAppSettings();
  const currency = String(defaultCurrency || "USD").toUpperCase();
  const [loading, setLoading] = useState(true);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [canIssue, setCanIssue] = useState(false);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<number | undefined>(undefined);
  const [expiresOn, setExpiresOn] = useState("");
  const [note, setNote] = useState("");
  const [requestId, setRequestId] = useState("");
  const [saving, setSaving] = useState(false);
  // Bumped to read the credit again after some is given.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/customers/${customerId}/store-credit`);
        const data = await res.json().catch(() => null);
        if (!cancelled && res.ok && data?.success) {
          setBalances(data.data?.balances || []);
          setHistory(data.data?.history || []);
          setCanIssue(Boolean(data.data?.canIssue));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [customerId, reloadKey]);

  const openDialog = () => {
    setAmount(undefined);
    setExpiresOn("");
    setNote("");
    setRequestId(
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    setOpen(true);
  };

  const give = async () => {
    if (!amount || amount <= 0) {
      toast.error(t("creditAmountRequired"));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/customers/${customerId}/store-credit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          currency,
          ...(expiresOn ? { expiresOn } : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
          requestId,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.message || data?.error || "");
      toast.success(t("creditGiven"));
      setOpen(false);
      setReloadKey((key) => key + 1);
    } catch (error) {
      toast.error((error instanceof Error && error.message) || t("creditFailed"));
    } finally {
      setSaving(false);
    }
  };

  const date = (value: string) =>
    new Date(value).toLocaleDateString(locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  const describe = (row: HistoryRow) => {
    if (row.type === "expire") return t("creditExpired");
    if (row.type === "redeem") {
      return row.status === "held" ? t("creditHeld") : t("creditSpent");
    }
    return SOURCE_LABELS[row.source] ? t(SOURCE_LABELS[row.source]) : t("creditGeneric");
  };

  return (
    <SectionCard
      icon={Wallet}
      tone="emerald"
      title={t("creditTitle")}
      action={
        canIssue ? (
          <Button type="button" size="sm" variant="outline" className="rounded-xl" onClick={openDialog}>
            <Plus className="mr-1.5 h-4 w-4" />
            {t("giveCredit")}
          </Button>
        ) : null
      }
    >
      <div className="space-y-6">
        {loading ? (
          <Skeleton className="h-20 w-full" />
        ) : balances.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
            <Wallet className="size-8 opacity-40" />
            <p className="text-sm">{t("noCredit")}</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-4">
            {balances.map((entry) => (
              <div key={entry.currency} className="rounded-2xl bg-emerald-50 px-5 py-4 dark:bg-emerald-500/10">
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{money(entry.balance, entry.currency)}</p>
                {entry.nextExpiry ? (
                  <p className="text-sm text-muted-foreground">
                    {t("creditExpires", {
                      amount: money(entry.nextExpiry.amount, entry.currency),
                      date: date(entry.nextExpiry.expiresAt),
                    })}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}

        {!loading && history.length > 0 ? (
          <div className="divide-y rounded-xl border">
            {history.map((row) => (
              <div key={row._id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{describe(row)}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {date(row.createdAt)}
                    {row.note ? ` · ${row.note}` : ""}
                    {row.type === "issue" && row.expiresAt
                      ? ` · ${t("creditExpiresShort", { date: date(row.expiresAt) })}`
                      : ""}
                  </p>
                </div>
                <span
                  className={`shrink-0 font-semibold ${row.type === "issue" ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}
                >
                  {row.type === "issue" ? "+" : "−"}
                  {money(row.amount, row.currency)}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="grid-cols-1">
          <DialogHeader>
            <DialogTitle>{t("giveCreditTitle")}</DialogTitle>
            <DialogDescription>{t("giveCreditDescription", { currency })}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="store-credit-amount">{t("creditAmount", { currency })}</Label>
              <NumberInput
                id="store-credit-amount"
                min={0}
                step={0.01}
                value={amount}
                onValueChange={setAmount}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="store-credit-expiry">
                {t("creditExpiry")} <span className="text-muted-foreground">{t("optionalSuffix")}</span>
              </Label>
              <Input
                id="store-credit-expiry"
                type="date"
                value={expiresOn}
                onChange={(event) => setExpiresOn(event.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="store-credit-note">
                {t("creditNote")} <span className="text-muted-foreground">{t("optionalSuffix")}</span>
              </Label>
              <Textarea
                id="store-credit-note"
                value={note}
                maxLength={500}
                onChange={(event) => setNote(event.target.value)}
                placeholder={t("creditNotePlaceholder")}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              {t("cancel")}
            </Button>
            <Button onClick={() => void give()} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("giveCredit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}
