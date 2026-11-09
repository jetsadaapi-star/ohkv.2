import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export interface AdminStatsStripItem {
  title: string;
  value: string | number;
  description: string;
  icon: ReactNode;
  iconClassName?: string;
}

interface AdminStatsStripProps {
  items: AdminStatsStripItem[];
  /** Full responsive column spec. Omit it: the columns follow the cell count. */
  columnsClassName?: string;
  /**
   * "tiles": one colourful tile per figure, in each item's own hue — the
   * vendor dashboard's look; a single swipeable row on phones. Default "strip".
   */
  variant?: "strip" | "tiles";
}

const TILE_HUES = ["silk", "gold", "violet", "amber", "orange", "blue", "green", "indigo", "cyan", "teal", "rose"] as const;
type TileHue = (typeof TILE_HUES)[number] | "slate";
const TILE_TONE: Record<TileHue, { tile: string; icon: string }> = {
  // The store theme's colours: primary (Phrae Wa red-brown) and its gold accent.
  silk: { tile: "from-primary/[0.06] ring-primary/20 text-primary dark:from-primary/15", icon: "bg-primary" },
  gold: {
    tile: "from-highlight-surface ring-highlight/40 text-[color-mix(in_oklab,var(--highlight)_60%,black)] dark:from-highlight/10 dark:text-highlight",
    icon: "bg-[color-mix(in_oklab,var(--highlight)_85%,black)]",
  },
  violet: { tile: "from-violet-50 ring-violet-200 text-violet-700 dark:from-violet-500/10", icon: "bg-violet-500" },
  amber: { tile: "from-amber-50 ring-amber-200 text-amber-700 dark:from-amber-500/10", icon: "bg-amber-500" },
  orange: { tile: "from-orange-50 ring-orange-200 text-orange-700 dark:from-orange-500/10", icon: "bg-orange-500" },
  blue: { tile: "from-sky-50 ring-sky-200 text-sky-700 dark:from-sky-500/10", icon: "bg-sky-500" },
  green: { tile: "from-emerald-50 ring-emerald-200 text-emerald-700 dark:from-emerald-500/10", icon: "bg-emerald-500" },
  indigo: { tile: "from-indigo-50 ring-indigo-200 text-indigo-700 dark:from-indigo-500/10", icon: "bg-indigo-500" },
  cyan: { tile: "from-cyan-50 ring-cyan-200 text-cyan-700 dark:from-cyan-500/10", icon: "bg-cyan-500" },
  teal: { tile: "from-teal-50 ring-teal-200 text-teal-700 dark:from-teal-500/10", icon: "bg-teal-500" },
  rose: { tile: "from-rose-50 ring-rose-200 text-rose-700 dark:from-rose-500/10", icon: "bg-rose-500" },
  slate: { tile: "from-slate-50 ring-slate-200 text-slate-700 dark:from-slate-500/10", icon: "bg-slate-700" },
};
function hueOf(iconClassName?: string): TileHue {
  return TILE_HUES.find((hue) => iconClassName?.includes(hue)) ?? "slate";
}

function StatsTiles({ items }: { items: AdminStatsStripItem[] }) {
  return (
    <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] sm:overflow-visible sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden">
      {items.map((item) => {
        const tone = TILE_TONE[hueOf(item.iconClassName)];
        return (
          <div
            key={item.title}
            title={item.description}
            className={`flex min-w-[10rem] shrink-0 snap-start items-center gap-3 rounded-2xl bg-linear-to-br to-white p-3 ring-1 ring-inset sm:min-w-0 sm:p-4 dark:to-card ${tone.tile}`}
          >
            <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl text-white shadow-sm sm:size-10 [&_svg]:size-5 ${tone.icon}`}>
              {item.icon}
            </span>
            <div className="min-w-0">
              <p className="line-clamp-2 text-xs leading-tight font-medium opacity-80">{item.title}</p>
              <p className="truncate text-xl font-extrabold tracking-tight text-foreground tabular-nums">
                {typeof item.value === "number" ? item.value.toLocaleString() : item.value}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function getIconThemeClasses(iconClassName?: string) {
  if (!iconClassName) {
    return "bg-muted text-muted-foreground dark:bg-muted/70 dark:text-foreground";
  }

  if (iconClassName === "silk") return "bg-primary/10 text-primary dark:bg-primary/25";
  if (iconClassName === "gold") return "bg-highlight-surface text-highlight-surface-foreground dark:bg-highlight/20 dark:text-highlight";
  if (iconClassName.includes("blue")) {
    return `${iconClassName} dark:bg-blue-500/20 dark:text-blue-300`;
  }
  if (iconClassName.includes("green")) {
    return `${iconClassName} dark:bg-green-500/20 dark:text-green-300`;
  }
  if (iconClassName.includes("indigo")) {
    return `${iconClassName} dark:bg-indigo-500/20 dark:text-indigo-300`;
  }
  if (iconClassName.includes("violet")) {
    return `${iconClassName} dark:bg-violet-500/20 dark:text-violet-300`;
  }
  if (iconClassName.includes("cyan")) {
    return `${iconClassName} dark:bg-cyan-500/20 dark:text-cyan-300`;
  }
  if (iconClassName.includes("teal")) {
    return `${iconClassName} dark:bg-teal-500/20 dark:text-teal-300`;
  }
  if (iconClassName.includes("amber")) {
    return `${iconClassName} dark:bg-amber-500/20 dark:text-amber-300`;
  }
  if (iconClassName.includes("orange")) {
    return `${iconClassName} dark:bg-orange-500/20 dark:text-orange-300`;
  }
  if (iconClassName.includes("rose")) {
    return `${iconClassName} dark:bg-rose-500/20 dark:text-rose-300`;
  }

  return `${iconClassName} dark:bg-muted/70 dark:text-foreground`;
}

/**
 * Column tracks per cell count, so a strip of N cells fills the row instead of
 * leaving an empty divided cell at the end of a fixed five-column grid. Spelled
 * out per count because Tailwind only ships class names it can see in source.
 */
const stripColumns: Record<number, string> = {
  1: "",
  2: "md:grid-cols-2",
  3: "md:grid-cols-2 lg:grid-cols-3",
  4: "md:grid-cols-2 lg:grid-cols-4",
  5: "md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5",
  6: "md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6",
};

function stripColumnsFor(count: number) {
  return stripColumns[count] ?? "md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
}

export function AdminStatsStrip({
  items,
  columnsClassName,
  variant = "strip",
}: AdminStatsStripProps) {
  if (variant === "tiles") return <StatsTiles items={items} />;
  return (
    <Card className="overflow-hidden rounded-[12px] border border-border/70 p-0 shadow-sm">
      <div
        className={`grid grid-cols-1 divide-y divide-border md:divide-x md:divide-y-0 ${columnsClassName ?? stripColumnsFor(items.length)}`}
      >
        {items.map((item) => (
          <div key={item.title} className="px-6 py-4">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 px-0 pt-0">
              <CardTitle className="text-sm font-medium text-foreground/85">
                {item.title}
              </CardTitle>
              <div
                className={`inline-flex h-8 w-8 items-center justify-center rounded-full ring-1 ring-black/5 [&_svg]:h-4 [&_svg]:w-4 dark:ring-white/10 ${getIconThemeClasses(item.iconClassName)}`}
              >
                {item.icon}
              </div>
            </CardHeader>
            <CardContent className="space-y-2 px-0 pb-0">
              <p className="text-xl font-bold tracking-tight text-foreground">
                {typeof item.value === "number"
                  ? item.value.toLocaleString()
                  : item.value}
              </p>
              <p className="text-xs text-muted-foreground">
                {item.description}
              </p>
            </CardContent>
          </div>
        ))}
      </div>
    </Card>
  );
}

interface AdminStatsStripSkeletonProps {
  items?: number;
  /** Only needed when the real strip also overrides its columns. */
  columnsClassName?: string;
}

/**
 * Placeholder for the strip above. It reproduces the real markup — ONE card
 * whose cells are separated by dividers — rather than N free-floating tiles,
 * because the strip renders while a server component is still aggregating its
 * counts and a differently-shaped placeholder reflows the page underneath it.
 */
export function AdminStatsStripSkeleton({
  items = 5,
  columnsClassName,
}: AdminStatsStripSkeletonProps) {
  return (
    <Card className="overflow-hidden rounded-[12px] border border-border/70 p-0 shadow-sm">
      <div
        className={`grid grid-cols-1 divide-y divide-border md:divide-x md:divide-y-0 ${columnsClassName ?? stripColumnsFor(items)}`}
      >
        {Array.from({ length: items }).map((_, index) => (
          <div key={`admin-stat-skeleton-${index}`} className="px-6 py-4">
            <div className="flex flex-row items-center justify-between">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
            <div className="mt-4 space-y-2">
              <Skeleton className="h-6 w-14" />
              <Skeleton className="h-2.5 w-28" />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
