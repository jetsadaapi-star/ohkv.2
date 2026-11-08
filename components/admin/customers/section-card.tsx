import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const TONES = {
  emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  sky: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  violet: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  rose: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  slate: "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300",
} as const;

export type SectionTone = keyof typeof TONES;

/**
 * The customer page's card: an icon tile, title and one-line description over
 * the content. One component so every section reads the same.
 */
export function SectionCard({
  icon: Icon,
  tone = "slate",
  title,
  description,
  action,
  children,
  className,
  contentClassName,
}: {
  icon: LucideIcon;
  tone?: SectionTone;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <section className={cn("overflow-hidden rounded-2xl border bg-card shadow-sm", className)}>
      <header className="flex items-start gap-3 border-b bg-muted/30 px-5 py-4">
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", TONES[tone])}>
          <Icon className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-semibold leading-tight">{title}</h3>
          {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>
      <div className={cn("p-5", contentClassName)}>{children}</div>
    </section>
  );
}

export function toneClass(tone: SectionTone) {
  return TONES[tone];
}
