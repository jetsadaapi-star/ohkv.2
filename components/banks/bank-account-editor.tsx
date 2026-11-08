"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, ChevronDown, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RequiredMark } from "@/components/admin/ui/required-mark";
import { findThaiBank, isWallet, THAI_BANKS, type ThaiBank } from "@/lib/banks/thai-banks";
import { cn } from "@/lib/utils";
import { BankAccountCard, BankLogo } from "./bank-account-card";

export interface BankAccountValue {
  bankName: string;
  accountName: string;
  accountNumber: string;
  routingNumber?: string;
  swiftCode?: string;
}

/**
 * Pick the bank from its logo, type the holder and number, and see the
 * account as a card in the bank's colours. The bank is saved as its full
 * Thai name (e.g. "ธนาคารกสิกรไทย"), so the stored data stays plain text.
 */
export function BankAccountEditor({
  value,
  onChange,
  disabled,
  idPrefix = "bank",
  showInternational = true,
}: {
  value: BankAccountValue;
  onChange: (patch: Partial<BankAccountValue>) => void;
  disabled?: boolean;
  idPrefix?: string;
  /** Routing / SWIFT fields, folded away (Thai transfers don't use them). */
  showInternational?: boolean;
}) {
  const t = useTranslations("admin.hc.bankEditor");
  const [query, setQuery] = useState("");
  const [moreOpen, setMoreOpen] = useState(Boolean(value.routingNumber || value.swiftCode));
  const selected = useMemo(() => findThaiBank(value.bankName), [value.bankName]);

  const banks = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return THAI_BANKS;
    return THAI_BANKS.filter((b) =>
      [b.symbol, b.name, b.nameLong, b.nameEN].some((x) => x.toLowerCase().includes(q)),
    );
  }, [query]);

  const pick = (bank: ThaiBank) => onChange({ bankName: bank.nameLong });
  const wallet = isWallet(selected);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
      <div className="space-y-5">
        {/* Bank */}
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label>
              {t("bank")}
              <RequiredMark />
            </Label>
            <div className="relative w-full sm:w-56">
              <Search className="absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("searchBank")}
                className="h-9 ps-8"
                disabled={disabled}
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-5">
            {banks.map((bank) => {
              const active = selected?.symbol === bank.symbol;
              return (
                <button
                  key={bank.symbol}
                  type="button"
                  onClick={() => pick(bank)}
                  disabled={disabled}
                  aria-pressed={active}
                  className={cn(
                    "group relative flex flex-col items-center gap-1.5 rounded-2xl border bg-card p-2.5 text-center transition-all hover:-translate-y-0.5 hover:shadow-md disabled:pointer-events-none disabled:opacity-60",
                    active && "shadow-md",
                  )}
                  style={active ? { borderColor: bank.color, boxShadow: `0 0 0 2px ${bank.color}33` } : undefined}
                >
                  <BankLogo bank={bank} size={40} />
                  <span className="line-clamp-1 text-xs font-medium">{bank.name}</span>
                  {active ? (
                    <span
                      className="absolute -end-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full text-white shadow"
                      style={{ background: bank.color }}
                    >
                      <Check className="size-3" strokeWidth={3} />
                    </span>
                  ) : null}
                </button>
              );
            })}
            {banks.length === 0 ? (
              <p className="col-span-full py-4 text-center text-sm text-muted-foreground">{t("noBankFound")}</p>
            ) : null}
          </div>
          {value.bankName && !selected ? (
            <p className="text-xs text-amber-600">{t("unknownBank", { name: value.bankName })}</p>
          ) : null}
        </div>

        {/* Holder + number */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-account-name`}>
              {t("accountName")}
              <RequiredMark />
            </Label>
            <Input
              id={`${idPrefix}-account-name`}
              value={value.accountName}
              onChange={(e) => onChange({ accountName: e.target.value })}
              placeholder={t("accountNamePlaceholder")}
              disabled={disabled}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-account-number`}>
              {wallet ? t("walletNumber") : t("accountNumber")}
              <RequiredMark />
            </Label>
            <Input
              id={`${idPrefix}-account-number`}
              value={value.accountNumber}
              inputMode="numeric"
              onChange={(e) => onChange({ accountNumber: e.target.value.replace(/[^\d-]/g, "") })}
              placeholder={wallet ? t("walletNumberPlaceholder") : t("accountNumberPlaceholder")}
              className="font-mono tracking-wider"
              disabled={disabled}
            />
          </div>
        </div>

        {showInternational ? (
          <div className="rounded-2xl border">
            <button
              type="button"
              onClick={() => setMoreOpen((o) => !o)}
              className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium"
            >
              {t("international")}
              <ChevronDown className={cn("size-4 transition-transform", moreOpen && "rotate-180")} />
            </button>
            {moreOpen ? (
              <div className="grid gap-4 border-t p-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor={`${idPrefix}-routing`}>{t("routing")}</Label>
                  <Input
                    id={`${idPrefix}-routing`}
                    value={value.routingNumber ?? ""}
                    onChange={(e) => onChange({ routingNumber: e.target.value })}
                    placeholder={t("optional")}
                    disabled={disabled}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${idPrefix}-swift`}>{t("swift")}</Label>
                  <Input
                    id={`${idPrefix}-swift`}
                    value={value.swiftCode ?? ""}
                    onChange={(e) => onChange({ swiftCode: e.target.value.toUpperCase() })}
                    placeholder={t("optional")}
                    disabled={disabled}
                  />
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Live card */}
      <div className="space-y-2 lg:sticky lg:top-20 lg:self-start">
        <p className="text-xs font-medium text-muted-foreground">{t("preview")}</p>
        <BankAccountCard
          bank={selected}
          bankName={value.bankName}
          accountName={value.accountName}
          accountNumber={value.accountNumber}
        />
        <p className="text-[11px] text-muted-foreground">{t("previewHint")}</p>
      </div>
    </div>
  );
}
