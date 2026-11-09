"use client";

import { SILK_GRADIENT, SilkBackdrop } from "@/components/auth/silk-pattern";
import * as React from "react";
import Link from "@/components/language/link";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  Moon,
  ShoppingBag,
  Sun,
  Sunrise,
} from "lucide-react";
import { useFallbackTranslator } from "@/hooks/use-fallback-translator";

/** What the subtitle says the numbers below cover, per dashboard period. */
const SUBTITLE_FALLBACK: Record<string, string> = {
  today: "Here's what's happening with your store today.",
  yesterday: "Here's what happened with your store yesterday.",
  week: "Here's what's happening with your store over the last 7 days.",
  month: "Here's what's happening with your store this month.",
  all: "Here's how your store has done all time.",
  custom: "Here's what happened with your store from {from} to {to}.",
};

/** "2026-08-27" → "27 Aug 2026", read as the UTC day the dashboard resolved. */
function formatDay(day: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${day}T00:00:00.000Z`));
}

type GreetingKey = "goodMorning" | "goodAfternoon" | "goodEvening";

function resolveGreetingKey(): GreetingKey {
  const hour = new Date().getHours();
  if (hour < 12) return "goodMorning";
  if (hour < 18) return "goodAfternoon";
  return "goodEvening";
}

/**
 * Personalized greeting + quick links shown at the top of the admin dashboard.
 * Kept in its own module so the loading skeleton can reuse it without pulling
 * in the chart-heavy dashboard content bundle.
 */
export function DashboardHeader({
  userName,
  filter,
  period,
}: {
  userName?: string;
  /** The period picker, rendered before the quick links. */
  filter?: React.ReactNode;
  /**
   * The dashboard's selected period, so the subtitle names it instead of
   * always saying "today". `from`/`to` are "YYYY-MM-DD", used for "custom".
   */
  period?: { key: string; from: string; to: string };
}) {
  const t = useTranslations();
  const label = useFallbackTranslator(t);
  const locale = useLocale();
  const periodKey = period?.key ?? "today";
  const subtitle =
    periodKey === "custom" && period?.from && period.to
      ? label("admin.dashboardPage.subtitleFor.custom", SUBTITLE_FALLBACK.custom, {
          from: formatDay(period.from, locale),
          to: formatDay(period.to, locale),
        })
      : periodKey === "today" || !SUBTITLE_FALLBACK[periodKey]
        ? t("admin.dashboardPage.subtitle")
        : label(
            `admin.dashboardPage.subtitleFor.${periodKey}`,
            SUBTITLE_FALLBACK[periodKey],
          );

  const [greetingKey, setGreetingKey] = React.useState<GreetingKey>(
    resolveGreetingKey,
  );

  React.useEffect(() => {
    const update = () => setGreetingKey(resolveGreetingKey());
    update();
    const interval = setInterval(update, 60_000);
    return () => clearInterval(interval);
  }, []);

  const displayName =
    userName?.trim() || t("common.guest");

  // The date chip is formatted in the browser's own timezone, like the greeting.
  const [today, setToday] = React.useState("");
  React.useEffect(() => {
    setToday(
      new Intl.DateTimeFormat(locale, {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date()),
    );
  }, [locale]);

  const GreetingIcon =
    greetingKey === "goodMorning"
      ? Sunrise
      : greetingKey === "goodAfternoon"
        ? Sun
        : Moon;

  return (
    // Woven silk in the store's own colours: the khit lattice, a gold
    // "fan pla" hem and a temple lotus (as on the sign-in pages).
    <section
      className="relative isolate overflow-hidden rounded-3xl p-5 pt-7 text-white shadow-lg shadow-primary/25 sm:p-7 sm:pt-9"
      style={{ backgroundImage: SILK_GRADIENT }}
    >
      <SilkBackdrop lotusClassName="-bottom-24 -right-10 size-80 opacity-20" />

      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white/90 ring-1 ring-inset ring-white/20 backdrop-blur">
            <CalendarDays className="size-3.5" />
            <span suppressHydrationWarning>{today || "\u00a0"}</span>
          </div>
          {/* The greeting depends on the clock, so the server (its own timezone)
              and the browser (the visitor's) can legitimately disagree; the
              effect above corrects it right after hydration. */}
          <h1
            suppressHydrationWarning
            className="mt-3 flex items-center gap-2.5 text-2xl font-bold tracking-tight sm:text-3xl"
          >
            <GreetingIcon className="size-7 shrink-0 text-highlight" aria-hidden />
            <span className="min-w-0 truncate">
              {t(`admin.dashboardPage.${greetingKey}`, {
                name: displayName,
                defaultMessage:
                  greetingKey === "goodMorning"
                    ? `Good morning, ${displayName}.`
                    : greetingKey === "goodAfternoon"
                      ? `Good afternoon, ${displayName}.`
                      : `Good evening, ${displayName}.`,
              })}
            </span>
          </h1>
          <p className="mt-1.5 max-w-xl text-sm text-white/80 sm:text-base">
            {subtitle}
          </p>
        </div>

        <div className="flex w-full flex-wrap items-stretch gap-2 lg:w-auto lg:flex-nowrap">
          {filter ? (
            <div className="w-full sm:w-auto [&_button]:border-white/0 [&_button]:bg-white [&_button]:text-slate-900 [&_button]:shadow-md">
              {filter}
            </div>
          ) : null}
          <Link
            href="/admin/analytics"
            className="group inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-[10px] bg-white/15 px-3.5 text-sm font-semibold text-white ring-1 ring-inset ring-white/30 backdrop-blur transition-all hover:bg-white/25 sm:flex-none"
          >
            <BarChart3 className="size-4" />
            {t("admin.sidebar.analytics")}
            <ArrowUpRight className="size-3.5 opacity-80 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 rtl:-scale-x-100" />
          </Link>
          <Link
            href="/admin/orders"
            className="group inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-[10px] bg-highlight px-3.5 text-sm font-semibold text-highlight-foreground shadow-md shadow-black/20 transition-all hover:brightness-110 sm:flex-none"
          >
            <ShoppingBag className="size-4" />
            {t("admin.sidebar.orders")}
            <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 rtl:-scale-x-100" />
          </Link>
        </div>
      </div>
    </section>
  );
}
