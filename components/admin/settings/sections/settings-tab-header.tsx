import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

const ICON_TONE = {
  emerald: "bg-emerald-600",
  sky: "bg-sky-500",
  violet: "bg-violet-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  indigo: "bg-indigo-500",
  teal: "bg-teal-500",
  orange: "bg-orange-500",
} as const;

export function SettingsTabHeader(props: {
  title: string;
  description?: string;
  meta?: ReactNode;
  /**
   * A small control that belongs to the page as a whole, such as its on/off
   * switch. Unlike `meta` it never wraps: it stays beside the title at every
   * width, where a phone would otherwise drop it under the description.
   */
  control?: ReactNode;
  className?: string;
  /**
   * The page's icon, in a coloured square beside the title — the vendor
   * area's page heading. Without one the header keeps its plain look.
   */
  icon?: ReactNode;
  /** The icon square's colour. Default emerald. */
  tone?: keyof typeof ICON_TONE;
  /** Under the title row, inside the same box: links out of the page, a note. */
  children?: ReactNode;
}) {
  // `meta` is a short status chip, but nothing stops a caller passing a
  // longer one. It keeps its width while it fits, then wraps onto its own
  // line rather than squeezing the title into a one-word column — and
  // `max-w-full` keeps even a sentence inside the card instead of running
  // off the page.
  const titleRow = (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
      <div className="flex min-w-0 flex-1 basis-64 items-start gap-3">
        {props.icon ? (
          <span
            className={cn(
              "mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm [&_svg]:size-5",
              ICON_TONE[props.tone ?? "emerald"],
            )}
          >
            {props.icon}
          </span>
        ) : null}
        <div className="min-w-0 space-y-1">
          <h2 className={cn("text-base font-semibold", props.icon && "text-2xl font-extrabold tracking-tight")}>
            {props.title}
          </h2>
          {props.description ? (
            <p className="text-sm text-muted-foreground">{props.description}</p>
          ) : null}
        </div>
      </div>
      {props.meta ? (
        <div className="min-w-0 max-w-full shrink-0">{props.meta}</div>
      ) : null}
    </div>
  );

  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-linear-to-br from-muted/70 via-card to-card px-6 py-5 shadow-sm dark:from-muted/40",
        props.className,
      )}
    >
      {props.control ? (
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1">{titleRow}</div>
          <div className="shrink-0">{props.control}</div>
        </div>
      ) : (
        titleRow
      )}
      {props.children ? <div className="mt-3.5">{props.children}</div> : null}
    </div>
  );
}
