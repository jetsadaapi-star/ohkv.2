import type { ComponentProps, ReactNode } from "react";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { KHIT_TILE } from "@/components/auth/silk-pattern";

type DashboardStatTrendDirection = "up" | "down" | "neutral";

/**
 * A colour of its own for each KPI card, so the cards on the dashboard read
 * apart at a glance. Cards without a tone keep the plain panel look used by the
 * analytics, vendor and finance pages.
 */
export type DashboardStatTone =
  | "blue"
  | "emerald"
  | "violet"
  | "amber"
  | "rose"
  | "cyan"
  | "indigo"
  | DashboardThreadTone;

/**
 * Thread colours of a hand-woven Phrae Wa cloth, for the dashboard: the
 * store's own primary and gold accent (so they follow the theme), and the
 * natural dyes woven beside them — terracotta, indigo (khram), jade and madder.
 */
export type DashboardThreadTone = "silk" | "gold" | "terracotta" | "khram" | "jade" | "madder";

const threadColours: Record<DashboardThreadTone, string> = {
  silk: "var(--primary)",
  gold: "color-mix(in oklab, var(--highlight) 82%, black)",
  terracotta: "#b5562a",
  khram: "#2f4f86",
  jade: "#23775c",
  madder: "#b42335",
};

function isThreadTone(tone: DashboardStatTone): tone is DashboardThreadTone {
  return tone in threadColours;
}

interface ToneClasses {
  card: string;
  glow: string;
  icon: string;
  label: string;
}

/* Class names are spelled out in full so Tailwind can find them. */
const toneClassNames: Record<Exclude<DashboardStatTone, DashboardThreadTone>, ToneClasses> = {
  blue: {
    card: "border-blue-200/70 bg-gradient-to-br from-blue-50 via-white to-blue-100/80 dark:border-blue-900/60 dark:from-blue-950/70 dark:via-blue-950/40 dark:to-blue-900/30",
    glow: "bg-blue-400/25 dark:bg-blue-500/20",
    icon: "bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-blue-500/30",
    label: "text-blue-900/70 dark:text-blue-200/80",
  },
  emerald: {
    card: "border-emerald-200/70 bg-gradient-to-br from-emerald-50 via-white to-emerald-100/80 dark:border-emerald-900/60 dark:from-emerald-950/70 dark:via-emerald-950/40 dark:to-emerald-900/30",
    glow: "bg-emerald-400/25 dark:bg-emerald-500/20",
    icon: "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-emerald-500/30",
    label: "text-emerald-900/70 dark:text-emerald-200/80",
  },
  violet: {
    card: "border-violet-200/70 bg-gradient-to-br from-violet-50 via-white to-violet-100/80 dark:border-violet-900/60 dark:from-violet-950/70 dark:via-violet-950/40 dark:to-violet-900/30",
    glow: "bg-violet-400/25 dark:bg-violet-500/20",
    icon: "bg-gradient-to-br from-violet-500 to-violet-600 text-white shadow-violet-500/30",
    label: "text-violet-900/70 dark:text-violet-200/80",
  },
  amber: {
    card: "border-amber-200/70 bg-gradient-to-br from-amber-50 via-white to-amber-100/80 dark:border-amber-900/60 dark:from-amber-950/70 dark:via-amber-950/40 dark:to-amber-900/30",
    glow: "bg-amber-400/25 dark:bg-amber-500/20",
    icon: "bg-gradient-to-br from-amber-400 to-amber-500 text-white shadow-amber-500/30",
    label: "text-amber-900/70 dark:text-amber-200/80",
  },
  rose: {
    card: "border-rose-200/70 bg-gradient-to-br from-rose-50 via-white to-rose-100/80 dark:border-rose-900/60 dark:from-rose-950/70 dark:via-rose-950/40 dark:to-rose-900/30",
    glow: "bg-rose-400/25 dark:bg-rose-500/20",
    icon: "bg-gradient-to-br from-rose-500 to-rose-600 text-white shadow-rose-500/30",
    label: "text-rose-900/70 dark:text-rose-200/80",
  },
  cyan: {
    card: "border-cyan-200/70 bg-gradient-to-br from-cyan-50 via-white to-cyan-100/80 dark:border-cyan-900/60 dark:from-cyan-950/70 dark:via-cyan-950/40 dark:to-cyan-900/30",
    glow: "bg-cyan-400/25 dark:bg-cyan-500/20",
    icon: "bg-gradient-to-br from-cyan-500 to-cyan-600 text-white shadow-cyan-500/30",
    label: "text-cyan-900/70 dark:text-cyan-200/80",
  },
  indigo: {
    card: "border-indigo-200/70 bg-gradient-to-br from-indigo-50 via-white to-indigo-100/80 dark:border-indigo-900/60 dark:from-indigo-950/70 dark:via-indigo-950/40 dark:to-indigo-900/30",
    glow: "bg-indigo-400/25 dark:bg-indigo-500/20",
    icon: "bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-indigo-500/30",
    label: "text-indigo-900/70 dark:text-indigo-200/80",
  },
};

const trendPillClassNames: Record<DashboardStatTrendDirection, string> = {
  up: "bg-emerald-500/10 text-emerald-700 ring-emerald-600/20 dark:text-emerald-300",
  down: "bg-red-500/10 text-red-600 ring-red-600/20 dark:text-red-300",
  neutral: "bg-slate-500/10 text-slate-600 ring-slate-500/20 dark:text-slate-300",
};

export interface DashboardStatTrendConfig {
  value: ReactNode;
  direction?: DashboardStatTrendDirection;
}

export interface DashboardStatCardItem {
  id: string;
  label: ReactNode;
  value: ReactNode;
  subLabel?: ReactNode;
  icon?: ReactNode;
  trend?: DashboardStatTrendConfig;
  className?: string;
}

interface DashboardStatCardProps extends Omit<
  ComponentProps<"article">,
  "children"
> {
  label: ReactNode;
  value: ReactNode;
  subLabel?: ReactNode;
  icon?: ReactNode;
  trend?: DashboardStatTrendConfig;
  /** When true, the label and icon stay visible but the value/sub-label swap to skeletons. */
  loading?: boolean;
  /** Gives the card its own colour (dashboard KPI style). */
  tone?: DashboardStatTone;
}

interface DashboardStatsGridProps {
  stats: DashboardStatCardItem[];
  className?: string;
  cardClassName?: string;
}

interface DashboardStatTrendProps extends DashboardStatTrendConfig {
  className?: string;
}

const trendClassNames: Record<DashboardStatTrendDirection, string> = {
  up: "text-emerald-600",
  down: "text-red-500",
  neutral: "text-muted-foreground",
};

const trendIcons = {
  up: TrendingUp,
  down: TrendingDown,
  neutral: Minus,
};

export function DashboardStatTrend({
  value,
  direction = "neutral",
  className,
}: DashboardStatTrendProps) {
  const Icon = trendIcons[direction];

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 text-xs",
        trendClassNames[direction],
        className,
      )}
    >
      {value}
      <Icon className="size-3" />
    </span>
  );
}

export function DashboardStatCard({
  label,
  value,
  subLabel,
  icon,
  trend,
  loading = false,
  tone,
  className,
  ...props
}: DashboardStatCardProps) {
  const valueTitle =
    typeof value === "string" || typeof value === "number"
      ? String(value)
      : undefined;

  if (tone && isThreadTone(tone)) {
    return (
      <article
        className={cn(
          "group relative isolate overflow-hidden rounded-2xl border border-[color-mix(in_oklab,var(--tone)_18%,var(--border))] bg-card p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-5",
          className,
        )}
        style={{ "--tone": threadColours[tone] } as React.CSSProperties}
        {...props}
      >
        {/* A woven hem along the top, and the khit lattice fading in the corner. */}
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-[var(--tone)]" />
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-6 -right-6 -z-10 size-36 bg-[var(--tone)] opacity-[0.07] transition-opacity duration-300 group-hover:opacity-[0.12]"
          style={{
            maskImage: `${KHIT_TILE}, radial-gradient(circle at 100% 100%, black, transparent 70%)`,
            WebkitMaskImage: `${KHIT_TILE}, radial-gradient(circle at 100% 100%, black, transparent 70%)`,
            maskComposite: "intersect",
            WebkitMaskComposite: "source-in",
            maskSize: "22px 22px, 100% 100%",
            WebkitMaskSize: "22px 22px, 100% 100%",
            maskRepeat: "repeat, no-repeat",
            WebkitMaskRepeat: "repeat, no-repeat",
          }}
        />
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 truncate pt-1 text-sm font-medium leading-tight text-muted-foreground">{label}</p>
          {icon ? (
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_oklab,var(--tone)_12%,transparent)] text-[var(--tone)] ring-1 ring-inset ring-[color-mix(in_oklab,var(--tone)_22%,transparent)] dark:bg-[color-mix(in_oklab,var(--tone)_28%,transparent)] dark:text-[color-mix(in_oklab,var(--tone)_55%,white)] [&_svg]:size-5">
              {icon}
            </span>
          ) : null}
        </div>

        {loading ? (
          <Skeleton className="mt-3 h-8 w-28" />
        ) : (
          <p className="mt-3 truncate text-[1.65rem] font-bold leading-tight tracking-tight text-foreground tabular-nums" title={valueTitle}>
            {value}
          </p>
        )}

        {loading ? (
          <div className="mt-3 flex items-center gap-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-12 rounded-full" />
          </div>
        ) : subLabel || trend ? (
          <div className="mt-3 flex min-w-0 flex-wrap items-center justify-between gap-2 border-t border-dashed border-[color-mix(in_oklab,var(--tone)_20%,var(--border))] pt-2.5 text-xs text-muted-foreground">
            {subLabel ? <span className="min-w-0 truncate">{subLabel}</span> : <span />}
            {trend ? (
              <DashboardStatTrend
                {...trend}
                className={cn(
                  "rounded-full px-2 py-0.5 font-semibold ring-1 ring-inset",
                  trendPillClassNames[trend.direction ?? "neutral"],
                )}
              />
            ) : null}
          </div>
        ) : null}
      </article>
    );
  }

  if (tone) {
    const palette = toneClassNames[tone];
    return (
      <article
        className={cn(
          "group relative isolate overflow-hidden rounded-2xl border p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-5",
          palette.card,
          className,
        )}
        {...props}
      >
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute -right-8 -top-10 -z-10 size-32 rounded-full blur-2xl transition-transform duration-300 group-hover:scale-110",
            palette.glow,
          )}
        />
        <div className="flex items-start justify-between gap-3">
          <p
            className={cn(
              "min-w-0 truncate pt-1 text-sm font-medium leading-tight",
              palette.label,
            )}
          >
            {label}
          </p>
          {icon ? (
            <span
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-xl shadow-lg [&_svg]:size-5",
                palette.icon,
              )}
            >
              {icon}
            </span>
          ) : null}
        </div>

        {loading ? (
          <Skeleton className="mt-3 h-7 w-28" />
        ) : (
          <p
            className="mt-3 truncate text-2xl font-bold leading-tight tracking-tight text-foreground tabular-nums"
            title={valueTitle}
          >
            {value}
          </p>
        )}

        {loading ? (
          <div className="mt-3 flex items-center gap-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-12 rounded-full" />
          </div>
        ) : subLabel || trend ? (
          <div className="mt-3 flex min-w-0 flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            {subLabel ? (
              <span className="min-w-0 truncate">{subLabel}</span>
            ) : (
              <span />
            )}
            {trend ? (
              <DashboardStatTrend
                {...trend}
                className={cn(
                  "rounded-full px-2 py-0.5 font-semibold ring-1 ring-inset",
                  trendPillClassNames[trend.direction ?? "neutral"],
                )}
              />
            ) : null}
          </div>
        ) : null}
      </article>
    );
  }

  return (
    <article
      className={cn(
        "!rounded-sm border border-border bg-card px-4 py-4",
        className,
      )}
      {...props}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-xs leading-none text-muted-foreground">
          {label}
        </p>
        {icon ? (
          <span className="shrink-0 text-muted-foreground [&_svg]:size-4">
            {icon}
          </span>
        ) : null}
      </div>

      {loading ? (
        <Skeleton className="h-5 w-24" />
      ) : (
        <p
          className="truncate text-lg font-semibold leading-none tracking-tight text-foreground"
          title={valueTitle}
        >
          {value}
        </p>
      )}

      {loading ? (
        <div className="mt-2 flex items-center gap-2">
          <Skeleton className="h-3.5 w-16" />
          <Skeleton className="h-3.5 w-10" />
        </div>
      ) : subLabel || trend ? (
        <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2 text-xs leading-none text-muted-foreground">
          {subLabel ? (
            <span className="min-w-0 truncate">{subLabel}</span>
          ) : null}
          {trend ? <DashboardStatTrend {...trend} /> : null}
        </div>
      ) : null}
    </article>
  );
}

/**
 * Column track counts written out per card count, so a row of N cards fills the
 * full width instead of leaving empty tracks in a fixed six-column grid. The
 * classes are spelled out rather than built from the number because Tailwind
 * only ships the class names it can find in the source. Seven or more cards
 * wrap deliberately — a single row that narrow is unreadable.
 */
const statsGridColumns: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  5: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5",
  6: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6",
};

export function statsGridColumnsFor(count: number) {
  return (
    statsGridColumns[count] ??
    "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
  );
}

export function DashboardStatsGrid({
  stats,
  className,
  cardClassName,
}: DashboardStatsGridProps) {
  return (
    <div
      className={cn("grid gap-3", statsGridColumnsFor(stats.length), className)}
    >
      {stats.map(({ id, className: itemClassName, ...stat }) => (
        <DashboardStatCard
          key={id}
          {...stat}
          className={cn(cardClassName, itemClassName)}
        />
      ))}
    </div>
  );
}

function DashboardStatCardSkeleton({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      className={cn(
        "!rounded-sm border border-border bg-card px-4 py-4",
        className,
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="size-4 rounded-full" />
      </div>
      <Skeleton className="h-5 w-24" />
      <div className="mt-2 flex items-center gap-2">
        <Skeleton className="h-3.5 w-16" />
        <Skeleton className="h-3.5 w-10" />
      </div>
    </div>
  );
}

export function DashboardStatsGridSkeleton({
  items = 6,
  className,
  cardClassName,
}: {
  items?: number;
  className?: string;
  cardClassName?: string;
}) {
  return (
    <div className={cn("grid gap-3", statsGridColumnsFor(items), className)}>
      {Array.from({ length: items }).map((_, index) => (
        <DashboardStatCardSkeleton
          key={`dashboard-stat-skeleton-${index}`}
          className={cardClassName}
        />
      ))}
    </div>
  );
}
