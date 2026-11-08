import { ArrowRight } from "lucide-react";
import Link from "@/components/language/link";

/** The OTOP theme's section title: accent bar, title, optional subtitle and "view all". */
export function OtopSectionHeading({
  title,
  subtitle,
  viewAllLabel,
  viewAllHref,
}: {
  title: string;
  subtitle?: string;
  viewAllLabel?: string;
  viewAllHref?: string;
}) {
  if (!title && !subtitle) return null;
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2.5 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          <span
            aria-hidden
            className="h-7 w-1.5 shrink-0 rounded-full bg-linear-to-b from-primary to-highlight"
          />
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-1 ps-4 text-sm text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {viewAllLabel && viewAllHref ? (
        <Link
          href={viewAllHref}
          className="group inline-flex shrink-0 items-center gap-1 rounded-full border border-primary/25 bg-white px-3.5 py-1.5 text-sm font-semibold text-primary transition-colors hover:border-primary/40 hover:bg-primary/5"
        >
          {viewAllLabel}
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100" />
        </Link>
      ) : null}
    </div>
  );
}
