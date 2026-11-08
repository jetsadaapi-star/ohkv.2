import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const ICON_TONE = {
  violet: "bg-violet-500",
  amber: "bg-amber-500",
  sky: "bg-sky-500",
  rose: "bg-rose-500",
  emerald: "bg-emerald-600",
  indigo: "bg-indigo-500",
  teal: "bg-teal-500",
  orange: "bg-orange-500",
  cyan: "bg-cyan-500",
} as const;

/** The vendor area's page heading: a coloured icon, the title and one line on what the page is for. */
export function VendorPageHeader({
  icon,
  title,
  description,
  tone = "emerald",
  actions,
}: {
  icon: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  tone?: keyof typeof ICON_TONE;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        <span
          className={cn(
            "mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm [&_svg]:size-5",
            ICON_TONE[tone],
          )}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
          {description ? (
            <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
