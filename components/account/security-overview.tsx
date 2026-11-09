"use client";

import { useTranslations } from "next-intl";
import { CheckCircle2, Circle, ShieldCheck } from "lucide-react";
import { ClientSuspense } from "@/components/common/client-suspense";
import { Skeleton } from "@/components/ui/skeleton";
import { useSuspenseResource } from "@/hooks/use-suspense-resource";
import { USER_PROFILE_URL, type UserProfilePayload } from "@/components/account/user-profile-resource";
import { KHIT_TILE, SILK_GRADIENT } from "@/components/auth/silk-pattern";
import { cn } from "@/lib/utils";

/**
 * How well the account is protected, at a glance, on the store's silk: a
 * checklist of what is on, with a ring that fills as it does. Reads the
 * profile the cards below read too, so it costs no request of its own.
 */
export function SecurityOverview({ phoneAvailable, phoneLinked }: { phoneAvailable: boolean; phoneLinked: boolean }) {
  return (
    <ClientSuspense fallback={<Skeleton className="h-36 w-full rounded-3xl" />}>
      <SecurityOverviewContent phoneAvailable={phoneAvailable} phoneLinked={phoneLinked} />
    </ClientSuspense>
  );
}

function SecurityOverviewContent({ phoneAvailable, phoneLinked }: { phoneAvailable: boolean; phoneLinked: boolean }) {
  const t = useTranslations("account.hub.security");
  const { data } = useSuspenseResource<UserProfilePayload>(USER_PROFILE_URL);
  const user = data?.user;
  const checks = [
    { key: "password", done: true },
    { key: "email", done: Boolean(user?.emailVerified) },
    ...(user?.twoFactorAvailable || user?.twoFactorEnabled ? [{ key: "twoFactor", done: Boolean(user?.twoFactorEnabled) }] : []),
    ...(phoneAvailable || phoneLinked ? [{ key: "phone", done: phoneLinked }] : []),
  ];
  const done = checks.filter((check) => check.done).length;
  const ratio = done / checks.length;
  const level = ratio >= 1 ? "strong" : ratio >= 0.6 ? "good" : "weak";
  const circumference = 2 * Math.PI * 26;

  return (
    <section
      className="relative isolate overflow-hidden rounded-3xl p-5 text-white shadow-lg shadow-primary/20 sm:p-6"
      style={{ background: SILK_GRADIENT }}
    >
      <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 opacity-[0.12]" style={{ backgroundImage: KHIT_TILE }} />
      <span aria-hidden className="pointer-events-none absolute -right-16 -top-20 -z-10 size-56 rounded-full bg-[var(--highlight)]/25 blur-3xl" />
      <div className="flex flex-wrap items-center gap-5">
        <div className="relative size-16 shrink-0">
          <svg viewBox="0 0 60 60" className="size-full -rotate-90">
            <circle cx="30" cy="30" r="26" fill="none" stroke="rgb(255 255 255 / 0.2)" strokeWidth="5" />
            <circle
              cx="30"
              cy="30"
              r="26"
              fill="none"
              stroke="var(--highlight)"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - ratio)}
            />
          </svg>
          <ShieldCheck className="absolute inset-0 m-auto size-7" />
        </div>
        <div className="min-w-0 flex-1 basis-48">
          <p className="text-sm text-white/75">{t("title")}</p>
          <p className="text-xl font-extrabold">{t(`level.${level}`)}</p>
          <p className="text-xs text-white/75">{t("progress", { done, total: checks.length })}</p>
        </div>
      </div>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {checks.map((check) => (
          <li
            key={check.key}
            className={cn(
              "flex items-center gap-2 rounded-xl px-3 py-2 text-sm ring-1 ring-inset",
              check.done ? "bg-white/15 ring-white/20" : "bg-black/15 ring-white/10 text-white/80",
            )}
          >
            {check.done ? (
              <CheckCircle2 className="size-4 shrink-0 text-[var(--highlight)]" />
            ) : (
              <Circle className="size-4 shrink-0 text-white/50" />
            )}
            <span className="truncate">{t(`checks.${check.key}`)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
