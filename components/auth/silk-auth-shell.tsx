"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import Link from "@/components/language/link";
import { useAppSettings } from "@/providers/app-settings-provider";
import { cn } from "@/lib/utils";
import { SILK_FORM_CONTROLS, SILK_GRADIENT, SilkBackdrop } from "./silk-pattern";


/**
 * The account card: the silk panel introducing the store beside the form.
 * On a phone the panel shrinks to the logo and headline so the form is on
 * the first screen.
 */
export function SilkAuthShell({
  headline,
  body,
  perks,
  footnote,
  children,
}: {
  headline: string;
  body?: string;
  perks?: Array<{ icon: LucideIcon; label: string }>;
  footnote?: string;
  children: ReactNode;
}) {
  const { storeName, logoUrl, darkModeLogoUrl } = useAppSettings();
  const panelLogo = darkModeLogoUrl || logoUrl;

  return (
    <div className="auth-wide mx-auto grid w-full max-w-5xl overflow-hidden rounded-[28px] border bg-card shadow-[0_30px_80px_-40px_rgba(60,15,10,0.45)] lg:grid-cols-[1.05fr_1fr]">
      <aside
        className="relative isolate overflow-hidden px-6 py-6 text-white sm:px-10 sm:py-8 lg:py-12"
        style={{ background: SILK_GRADIENT }}
      >
        <SilkBackdrop />
        <div className="flex h-full flex-col">
          <Link href="/" className="inline-flex w-fit items-center gap-3">
            {panelLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={panelLogo} alt={storeName} className="h-12 w-auto max-w-[240px] object-contain drop-shadow-sm sm:h-16" />
            ) : (
              <span className="text-xl font-extrabold">{storeName}</span>
            )}
          </Link>

          <div className="mt-5 sm:mt-8 lg:mt-12">
            <h2 className="text-xl font-extrabold leading-snug tracking-tight sm:text-3xl">{headline}</h2>
            <span aria-hidden className="mt-3 block h-1.5 w-16 rounded-full bg-highlight sm:mt-4 sm:w-20" />
            {body ? (
              <p className="mt-4 hidden max-w-sm text-sm leading-relaxed text-white/80 sm:block">{body}</p>
            ) : null}
          </div>

          {perks?.length ? (
            <ul className="mt-8 hidden space-y-3 sm:block lg:mt-10">
              {perks.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-highlight ring-1 ring-inset ring-white/15 backdrop-blur-sm">
                    <Icon className="size-5" />
                  </span>
                  <span className="text-sm font-medium text-white/90">{label}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {footnote ? <p className="mt-auto hidden pt-10 text-xs text-white/55 lg:block">{footnote}</p> : null}
        </div>
      </aside>

      <section className={cn("px-6 py-8 sm:px-10 lg:py-12", SILK_FORM_CONTROLS)}>{children}</section>
    </div>
  );
}
