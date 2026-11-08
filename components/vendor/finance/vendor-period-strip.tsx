"use client";

import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface VendorPeriodStripItem {
  id: string;
  label: string;
  value: string;
  /** Said in a tooltip, not on the screen: the figure is the point. */
  hint?: string;
  /** The tile's colour; by position when left out (opening, earned, paid out, held). */
  hue?: "slate" | "emerald" | "sky" | "violet" | "amber" | "rose";
}

export interface VendorPeriodStripExtra {
  id: string;
  label: string;
  value: string;
  tone?: "negative" | "positive";
}

/**
 * The period's four figures as four coloured tiles.
 *
 * Opening, what was earned, what was paid out, and the balance left — read
 * left to right like the top of a bank statement. Five separate cards with an
 * icon and a sentence each made the overview read as a wall of tiles; the
 * sentences live in tooltips now, where a seller who wants them can find them.
 */
export function VendorPeriodStrip({
  items,
  label,
  extras,
}: {
  items: VendorPeriodStripItem[];
  label: string;
  /**
   * Movements that changed the balance but have no tile of their own — a
   * refund, a delivery label. One quiet line under the figures, so Opening +
   * Earned − Paid out + these = Held for you adds up without a second panel.
   */
  extras?: { label: string; items: VendorPeriodStripExtra[] };
}) {
  return (
    <div role="group" aria-label={label} className="space-y-2">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {items.map((item, index) => {
          const tone = TILE_TONES[item.hue ?? DEFAULT_HUES[index % DEFAULT_HUES.length]];
          return (
            <div
              key={item.id}
              className={cn(
                "min-w-0 rounded-2xl bg-linear-to-br to-white p-4 ring-1 ring-inset dark:to-card",
                tone,
              )}
            >
              <div className="flex items-center gap-1.5 text-xs font-semibold opacity-90">
                <span className="truncate">{item.label}</span>
                {item.hint ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-label={item.hint}
                        className="inline-flex shrink-0 rounded-sm opacity-70 hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      >
                        <Info className="size-3.5" aria-hidden="true" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-56">
                      {item.hint}
                    </TooltipContent>
                  </Tooltip>
                ) : null}
              </div>
              <p
                className="mt-1.5 truncate text-xl font-extrabold tracking-tight text-foreground tabular-nums sm:text-2xl"
                title={item.value}
              >
                {item.value}
              </p>
            </div>
          );
        })}
      </div>
      {extras && extras.items.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-dashed bg-muted/30 px-4 py-2.5 text-xs">
          <span className="font-semibold text-muted-foreground">{extras.label}</span>
          {extras.items.map((extra) => (
            <span
              key={extra.id}
              className={cn(
                "inline-flex items-baseline gap-1.5 rounded-full px-2.5 py-1 ring-1 ring-inset",
                extra.tone === "negative"
                  ? "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30"
                  : "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30",
              )}
            >
              <span className="opacity-80">{extra.label}</span>
              <span className="font-bold tabular-nums">{extra.value}</span>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

type TileHue = "slate" | "emerald" | "sky" | "violet" | "amber" | "rose";
const DEFAULT_HUES: TileHue[] = ["slate", "emerald", "sky", "violet"];
const TILE_TONES: Record<TileHue, string> = {
  slate: "from-slate-50 ring-slate-200 text-slate-700 dark:from-slate-500/10",
  emerald: "from-emerald-50 ring-emerald-200 text-emerald-700 dark:from-emerald-500/10",
  sky: "from-sky-50 ring-sky-200 text-sky-700 dark:from-sky-500/10",
  violet: "from-violet-50 ring-violet-200 text-violet-700 dark:from-violet-500/10",
  amber: "from-amber-50 ring-amber-200 text-amber-700 dark:from-amber-500/10",
  rose: "from-rose-50 ring-rose-200 text-rose-700 dark:from-rose-500/10",
};
