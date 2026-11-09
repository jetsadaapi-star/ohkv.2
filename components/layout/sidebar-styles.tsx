import type { ComponentType } from "react";
import { cn } from "@/lib/utils";

/**
 * The dashboard sidebar's look, in one place, so the main menu, the POS menu
 * and the settings menu read as one system.
 *
 * - A page that is open: brand gradient, white text (the one loud element).
 * - A section holding the open page: a soft brand tint.
 * - Everything else: quiet slate text, a light tile behind each icon.
 *
 * "Apparent" is the coloured sidebar an admin can pick in Preferences; there
 * everything is drawn in white over the paint instead.
 *
 * Active styles are written with `data-[active=true]:` as well, so they win
 * over the sidebar primitive's own `data-[active=true]:bg-sidebar-accent`.
 */

/** Spacing shared by every top-level row, including the icon rail. */
const ROW_BASE =
  "group/btn relative h-10 gap-3 rounded-xl px-2 text-[13.5px] font-medium transition-all duration-200 " +
  "group-data-[collapsible=icon]:h-auto group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:flex-col " +
  "group-data-[collapsible=icon]:gap-1 group-data-[collapsible=icon]:rounded-xl group-data-[collapsible=icon]:px-1 group-data-[collapsible=icon]:py-2";

const LEAF_ACTIVE =
  "bg-linear-to-r from-primary to-[color-mix(in_oklab,var(--primary)_68%,var(--highlight))] text-white font-semibold shadow-md shadow-primary/25 " +
  "hover:text-white hover:brightness-110 active:text-white " +
  "data-[active=true]:bg-transparent data-[active=true]:text-white data-[active=true]:font-semibold " +
  "data-[state=open]:hover:text-white";

const SECTION_ACTIVE =
  "bg-primary/10 text-primary font-semibold hover:bg-primary/15 hover:text-primary " +
  "data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=true]:font-semibold " +
  "dark:bg-white/10 dark:text-white dark:data-[active=true]:bg-white/10 dark:data-[active=true]:text-white";

const EXPANDED =
  "bg-slate-100/80 text-foreground hover:bg-slate-100 hover:text-foreground dark:bg-white/5";

const IDLE =
  "text-slate-600 hover:bg-white hover:text-foreground hover:shadow-sm hover:shadow-slate-200/70 " +
  "dark:text-foreground/70 dark:hover:bg-white/5 dark:hover:shadow-none";

export function sidebarRowClass({
  isApparent,
  isActive,
  isExpanded = false,
  kind = "leaf",
}: {
  isApparent: boolean;
  isActive: boolean;
  isExpanded?: boolean;
  /** A link to a page (`leaf`) or a header that opens a list (`section`). */
  kind?: "leaf" | "section";
}) {
  if (isApparent) {
    return cn(
      ROW_BASE,
      isActive
        ? "bg-white/20 text-white font-semibold shadow-sm shadow-black/10 hover:bg-white/25 hover:text-white data-[active=true]:bg-white/20 data-[active=true]:text-white"
        : isExpanded
          ? "bg-white/10 text-white hover:bg-white/15 hover:text-white"
          : "text-white/80 hover:bg-white/10 hover:text-white",
    );
  }
  return cn(
    ROW_BASE,
    isActive ? (kind === "leaf" ? LEAF_ACTIVE : SECTION_ACTIVE) : isExpanded ? EXPANDED : IDLE,
  );
}

/** The rounded tile behind each top-level icon. */
export function SidebarIconTile({
  Icon,
  isApparent,
  isActive,
  kind = "leaf",
  className,
}: {
  Icon: ComponentType<{ className?: string }>;
  isApparent: boolean;
  isActive: boolean;
  kind?: "leaf" | "section";
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-lg transition-all duration-200",
        "group-data-[collapsible=icon]:size-9 group-data-[collapsible=icon]:rounded-xl",
        isApparent
          ? isActive
            ? "bg-white/25 text-white"
            : "bg-white/10 text-white/90 group-hover/btn:bg-white/20"
          : isActive
            ? kind === "leaf"
              ? "bg-white/20 text-white"
              : "bg-primary text-white shadow-sm shadow-primary/30"
            : "bg-slate-100 text-slate-500 group-hover/btn:bg-primary/10 group-hover/btn:text-primary dark:bg-white/10 dark:text-foreground/70",
        className,
      )}
    >
      <Icon className="size-4 stroke-2 group-data-[collapsible=icon]:size-[18px]" />
    </span>
  );
}

/** The small label under an icon on the collapsed rail. */
export function sidebarRailLabelClass({
  isApparent,
  isActive,
  kind = "leaf",
}: {
  isApparent: boolean;
  isActive: boolean;
  kind?: "leaf" | "section";
}) {
  return cn(
    "hidden text-[10.5px] leading-tight font-medium group-data-[collapsible=icon]:block text-center wrap-break-word whitespace-normal overflow-visible",
    isApparent
      ? "text-white"
      : isActive
        ? kind === "leaf"
          ? "text-white"
          : "text-primary"
        : "text-slate-500 dark:text-foreground/60",
  );
}

/** A group heading ("Catalog", "Sales"…) with a hairline running after it. */
export function sidebarGroupLabelClass(isApparent: boolean) {
  return cn(
    "mb-1 flex h-6 items-center gap-2 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] group-data-[collapsible=icon]:hidden",
    "after:h-px after:flex-1 after:content-['']",
    isApparent
      ? "text-white/60 after:bg-white/20"
      : "text-slate-400 after:bg-slate-200 dark:text-foreground/40 dark:after:bg-white/10",
  );
}

/** A row inside an opened section. */
export function sidebarSubRowClass({
  isApparent,
  isActive,
  isOpen = false,
  size = "md",
}: {
  isApparent: boolean;
  isActive: boolean;
  isOpen?: boolean;
  size?: "md" | "sm";
}) {
  return cn(
    "relative z-10 w-full rounded-lg px-2.5 font-medium transition-colors",
    size === "md" ? "h-8 text-[13px]" : "h-7 text-[12.5px]",
    isApparent
      ? isActive
        ? "bg-white/20 text-white font-semibold data-[active=true]:bg-white/20 data-[active=true]:text-white"
        : isOpen
          ? "bg-white/10 text-white font-semibold hover:bg-white/15"
          : "text-white/85 hover:bg-white/15 hover:text-white"
      : isActive
        ? "bg-primary/10 text-primary font-semibold data-[active=true]:bg-primary/10 data-[active=true]:text-primary dark:bg-white/10 dark:text-white dark:data-[active=true]:bg-white/10 dark:data-[active=true]:text-white"
        : isOpen
          ? "bg-slate-100 text-foreground font-semibold hover:bg-slate-100"
          : "text-slate-500 hover:bg-white hover:text-foreground dark:text-foreground/60 dark:hover:bg-white/5",
  );
}

/** The guide line of an opened section's list (and its marker for the open row). */
export function sidebarSubGuideClass(isApparent: boolean) {
  return isApparent ? "bg-white/25" : "bg-slate-200 dark:bg-white/15";
}
