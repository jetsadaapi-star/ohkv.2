"use client";

import Image from "next/image";
import { Landmark } from "lucide-react";
import { useTranslations } from "next-intl";
import { formatAccountNumber, isLight, isWallet, shade, type ThaiBank } from "@/lib/banks/thai-banks";
import { cn } from "@/lib/utils";

/** A bank's logo in a white rounded tile. */
export function BankLogo({ bank, size = 40, className }: { bank: ThaiBank; size?: number; className?: string }) {
  return (
    <span
      className={cn("relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm", className)}
      style={{ width: size, height: size }}
    >
      <Image src={bank.icon} alt={bank.name} width={size} height={size} className="object-contain p-0.5" />
    </span>
  );
}

/**
 * The account as a bank card in the bank's own colours: logo, bank name,
 * formatted number and holder. Shows a neutral card when no bank is chosen.
 */
export function BankAccountCard({
  bank,
  bankName,
  accountName,
  accountNumber,
  className,
}: {
  bank: ThaiBank | null;
  /** Free-text name, shown when it matches no known bank. */
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  className?: string;
}) {
  const t = useTranslations("admin.hc.bankEditor");
  const color = bank?.color ?? "#334155";
  const light = isLight(color);
  const number = accountNumber?.trim() ? formatAccountNumber(accountNumber, bank) : "•••-•-•••••-•";

  return (
    <div
      className={cn(
        "@container relative isolate aspect-[1.586] w-full max-w-sm overflow-hidden rounded-3xl p-4 shadow-xl @[20rem]:p-5",
        light ? "text-slate-900" : "text-white",
        className,
      )}
      style={{ background: `linear-gradient(135deg, ${shade(color, 0.12)} 0%, ${color} 45%, ${shade(color, -0.4)} 100%)` }}
    >
      {/* Soft shapes */}
      <span aria-hidden className="absolute -end-16 -top-16 -z-10 size-56 rounded-full bg-white/15" />
      <span aria-hidden className="absolute -bottom-24 -start-10 -z-10 size-64 rounded-full bg-black/10" />

      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {bank ? (
            <BankLogo bank={bank} size={40} />
          ) : (
            <span className="flex size-11 items-center justify-center rounded-xl bg-white/20">
              <Landmark className="size-5" />
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-bold leading-tight @[20rem]:text-base">{bank?.nameLong || bankName || t("noBank")}</p>
            {bank ? <p className="truncate text-xs opacity-80">{bank.nameEN}</p> : null}
          </div>
        </div>
        <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-bold tracking-wide backdrop-blur">
          {isWallet(bank) ? t("walletBadge") : t("accountBadge")}
        </span>
      </div>

      {/* Chip */}
      <span
        aria-hidden
        className="mt-3 block h-6 w-9 rounded-md @[20rem]:mt-5 @[20rem]:h-8 @[20rem]:w-11 bg-linear-to-br from-amber-200 via-yellow-300 to-amber-500 shadow-inner ring-1 ring-black/10"
      />

      <p className="mt-2 truncate font-mono text-base font-semibold tracking-widest @[20rem]:mt-4 @[20rem]:text-xl @[24rem]:text-2xl @[24rem]:tracking-[0.12em]">{number}</p>

      <div className="absolute inset-x-4 bottom-3 flex @[20rem]:inset-x-5 @[20rem]:bottom-4 items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider opacity-70">{t("holder")}</p>
          <p className="truncate text-sm font-semibold">{accountName?.trim() || "—"}</p>
        </div>
        {bank ? <p className="shrink-0 text-xs font-bold opacity-80">{bank.symbol}</p> : null}
      </div>
    </div>
  );
}
