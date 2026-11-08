import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { toneClass, type SectionTone } from "./section-card";

/** A small KPI tile: icon, label, value. */
export function SummaryStat({
  label,
  value,
  icon: Icon,
  tone = "slate",
}: {
  label: string;
  value: string;
  icon?: LucideIcon;
  tone?: SectionTone;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-sm">
      {Icon ? (
        <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", toneClass(tone))}>
          <Icon className="size-5" />
        </span>
      ) : null}
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
        <p className="mt-0.5 truncate text-lg font-semibold tabular-nums">{value}</p>
      </div>
    </div>
  );
}
