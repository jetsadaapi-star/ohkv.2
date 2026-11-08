/**
 * Colour sets the zone cards rotate through, so 18 districts side by side read
 * as distinct places rather than one repeated tile. Class names are spelled
 * out in full so Tailwind finds them.
 */
export const ZONE_TONES = [
  {
    card: "border-emerald-200/70 from-emerald-50 via-white to-emerald-100/70 dark:border-emerald-900/50 dark:from-emerald-950/60 dark:via-background dark:to-emerald-900/20",
    glow: "bg-emerald-400/25",
    icon: "bg-linear-to-br from-emerald-500 to-emerald-600 shadow-emerald-500/30",
    text: "text-emerald-700 dark:text-emerald-300",
  },
  {
    card: "border-sky-200/70 from-sky-50 via-white to-sky-100/70 dark:border-sky-900/50 dark:from-sky-950/60 dark:via-background dark:to-sky-900/20",
    glow: "bg-sky-400/25",
    icon: "bg-linear-to-br from-sky-500 to-sky-600 shadow-sky-500/30",
    text: "text-sky-700 dark:text-sky-300",
  },
  {
    card: "border-amber-200/70 from-amber-50 via-white to-amber-100/70 dark:border-amber-900/50 dark:from-amber-950/60 dark:via-background dark:to-amber-900/20",
    glow: "bg-amber-400/25",
    icon: "bg-linear-to-br from-amber-400 to-amber-500 shadow-amber-500/30",
    text: "text-amber-700 dark:text-amber-300",
  },
  {
    card: "border-violet-200/70 from-violet-50 via-white to-violet-100/70 dark:border-violet-900/50 dark:from-violet-950/60 dark:via-background dark:to-violet-900/20",
    glow: "bg-violet-400/25",
    icon: "bg-linear-to-br from-violet-500 to-violet-600 shadow-violet-500/30",
    text: "text-violet-700 dark:text-violet-300",
  },
  {
    card: "border-rose-200/70 from-rose-50 via-white to-rose-100/70 dark:border-rose-900/50 dark:from-rose-950/60 dark:via-background dark:to-rose-900/20",
    glow: "bg-rose-400/25",
    icon: "bg-linear-to-br from-rose-500 to-rose-600 shadow-rose-500/30",
    text: "text-rose-700 dark:text-rose-300",
  },
  {
    card: "border-teal-200/70 from-teal-50 via-white to-teal-100/70 dark:border-teal-900/50 dark:from-teal-950/60 dark:via-background dark:to-teal-900/20",
    glow: "bg-teal-400/25",
    icon: "bg-linear-to-br from-teal-500 to-teal-600 shadow-teal-500/30",
    text: "text-teal-700 dark:text-teal-300",
  },
] as const;
