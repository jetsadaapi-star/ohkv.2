"use client";

import { useLocale, useTranslations } from "next-intl";
import { ArrowDownLeft, ArrowUpRight, Clock, History, ShoppingBag, Wallet } from "lucide-react";
import Link from "@/components/language/link";
import { cn } from "@/lib/utils";
import { KHIT_TILE, SILK_GRADIENT } from "@/components/auth/silk-pattern";
import { AccountEmpty, AccountSection } from "./account-ui";
import { useFallbackTranslator } from "@/hooks/use-fallback-translator";
import { useSuspenseResource } from "@/hooks/use-suspense-resource";
import { formatCurrency } from "@/lib/intl/money";
import { resolveCurrency } from "@/lib/intl/currencies";

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
  expiresAt?: string | null;
  note?: string;
  createdAt: string;
};

function money(amount: number, currencyCode: string) {
  const currency = resolveCurrency(String(currencyCode || "").toUpperCase() || "USD");
  return formatCurrency(Number(amount || 0), currency.code, currency.locale);
}

/**
 * The shopper's store credit (R8): what they can spend, currency by currency,
 * the part that expires next, and one quiet list of what added to it or took
 * from it.
 *
 * Suspends until the first answer — render it inside `<ClientSuspense>`. A
 * failed read shows the empty state, as it always has.
 */
export function CustomerStoreCredit() {
  const t = useTranslations();
  const tr = useFallbackTranslator(t);
  const locale = useLocale();
  const { data } = useSuspenseResource<{
    balances?: Balance[];
    history?: HistoryRow[];
  }>("/api/user/store-credit");
  const balances = data?.balances ?? [];
  const history = data?.history ?? [];

  const date = (value: string) =>
    new Date(value).toLocaleDateString(locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  const describe = (row: HistoryRow) => {
    if (row.type === "expire") return tr("account.storeCreditExpired", "Expired");
    if (row.type === "redeem") {
      return row.status === "held"
        ? tr("account.storeCreditHeld", "Held for an order being paid")
        : tr("account.storeCreditSpent", "Spent on an order");
    }
    if (row.source === "return_refund") return tr("account.storeCreditFromReturn", "Refund for a return");
    if (row.source === "order_refund") return tr("account.storeCreditFromRefund", "Refund");
    if (row.source === "loyalty") return tr("account.storeCreditFromLoyalty", "Loyalty points redeemed");
    if (row.source === "order_refund_restore") {
      return tr("account.storeCreditRestored", "Given back from a refunded order");
    }
    return tr("account.storeCreditFromStore", "From the store");
  };

  return (
    <div className="space-y-6">
      {balances.length === 0 ? (
        <AccountEmpty
          icon={<Wallet />}
          title={tr("account.storeCreditEmpty", "You have no store credit.")}
          description={tr("account.storeCreditDesc", "")}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {balances.map((entry) => (
            // A wallet card on the store's silk: what can be spent, and the
            // part that runs out first.
            <div
              key={entry.currency}
              className="relative isolate overflow-hidden rounded-3xl p-5 text-white shadow-lg shadow-primary/20 sm:p-6"
              style={{ background: SILK_GRADIENT }}
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 -z-10 opacity-[0.12]"
                style={{ backgroundImage: KHIT_TILE }}
              />
              <span aria-hidden className="pointer-events-none absolute -right-16 -top-16 -z-10 size-48 rounded-full bg-[var(--highlight)]/25 blur-2xl" />
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-white/80">
                  {tr("account.storeCreditBalance", "Available")}
                </p>
                <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-bold tracking-wider ring-1 ring-inset ring-white/25">
                  {entry.currency}
                </span>
              </div>
              <p className="mt-3 text-4xl font-extrabold tabular-nums tracking-tight">
                {money(entry.balance, entry.currency)}
              </p>
              {entry.nextExpiry ? (
                <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-black/15 px-3 py-1 text-xs text-white/90">
                  <Clock className="size-3.5 text-[var(--highlight)]" />
                  {tr("account.storeCreditExpires", "{amount} expires {date}", {
                    amount: money(entry.nextExpiry.amount, entry.currency),
                    date: date(entry.nextExpiry.expiresAt),
                  })}
                </p>
              ) : null}
              <Link
                href="/products"
                className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-primary shadow-sm transition hover:bg-white/90"
              >
                <ShoppingBag className="size-4" />
                {tr("account.startShopping", "Start shopping")}
              </Link>
            </div>
          ))}
        </div>
      )}

      {history.length > 0 ? (
        <AccountSection
          icon={<History />}
          tone="jade"
          title={tr("account.hub.creditHistory", "History")}
          bodyClassName="px-0 py-0 sm:px-0"
        >
          <ul className="divide-y border-t">
            {history.map((row) => {
              const incoming = row.type === "issue";
              return (
                <li key={row._id} className="flex items-center gap-3 px-5 py-3.5 sm:px-6">
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-xl",
                      incoming
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-primary/10 text-primary",
                    )}
                  >
                    {incoming ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{describe(row)}</p>
                    <p className="text-xs text-muted-foreground">{date(row.createdAt)}</p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 text-sm font-bold tabular-nums",
                      incoming ? "text-emerald-600 dark:text-emerald-400" : "text-foreground",
                    )}
                  >
                    {incoming ? "+" : "−"}
                    {money(row.amount, row.currency)}
                  </span>
                </li>
              );
            })}
          </ul>
        </AccountSection>
      ) : null}
    </div>
  );
}
