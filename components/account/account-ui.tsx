import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { FAN_PLA_TILE, KHIT_TILE, Lotus, SILK_GRADIENT } from "@/components/auth/silk-pattern";

/**
 * The account area's own pieces, woven from the store theme like the sign-in
 * pages: the primary as the silk, the gold accent (highlight) as its thread.
 * No hooks and no "use client", so server pages and client components draw
 * them alike.
 */

/** Natural-dye colours beside the theme's own, for tiles that need telling apart. */
export type AccountTone = "silk" | "gold" | "jade" | "khram" | "terracotta" | "madder";

export const ACCOUNT_TONE: Record<AccountTone, string> = {
  silk: "var(--primary)",
  gold: "color-mix(in oklab, var(--highlight) 78%, black)",
  jade: "#23775c",
  khram: "#2f4f86",
  terracotta: "#b5562a",
  madder: "#b42335",
};

/** The icon chip: a soft wash of the tone with its colour on top. */
export function ToneIcon({
  tone = "silk",
  className,
  children,
}: {
  tone?: AccountTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-xl [&_svg]:size-5",
        "bg-[color-mix(in_oklab,var(--tone)_12%,transparent)] text-[var(--tone)] ring-1 ring-inset ring-[color-mix(in_oklab,var(--tone)_18%,transparent)]",
        className,
      )}
      style={{ "--tone": ACCOUNT_TONE[tone] } as CSSProperties}
    >
      {children}
    </span>
  );
}

/**
 * A page's title row: the icon on silk, the title and what the page is for,
 * and its actions. On phones the top bar already names the page, so only the
 * description and the actions show there.
 */
export function AccountPageHeader({
  icon,
  title,
  description,
  actions,
  className,
}: {
  icon: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-wrap items-center gap-x-4 gap-y-3", className)}>
      <span
        aria-hidden
        className="relative isolate hidden size-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl text-white shadow-md shadow-primary/20 lg:flex [&_svg]:size-6"
        style={{ background: SILK_GRADIENT }}
      >
        <span className="absolute inset-0 -z-10 opacity-20" style={{ backgroundImage: KHIT_TILE, backgroundSize: "22px" }} />
        {icon}
      </span>
      <div className="min-w-0 flex-1 basis-56">
        <h1 className="hidden text-2xl font-extrabold tracking-tight lg:block">{title}</h1>
        {description ? (
          <p className="text-sm text-muted-foreground lg:mt-0.5">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/**
 * A section of a page: a card with a gold thread along its top, an optional
 * title row (icon, title, description, action) and its body.
 */
export function AccountSection({
  icon,
  tone = "silk",
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
  thread = true,
}: {
  icon?: ReactNode;
  tone?: AccountTone;
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** The gold thread along the top edge. */
  thread?: boolean;
}) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-[0_1px_2px_rgb(0_0_0/0.04),0_8px_24px_-12px_color-mix(in_oklab,var(--primary)_18%,transparent)]",
        className,
      )}
    >
      {thread ? (
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-[3px] bg-[linear-gradient(90deg,var(--primary),var(--highlight)_55%,var(--primary))] opacity-80"
        />
      ) : null}
      {title ? (
        <div className="flex flex-wrap items-start gap-3 px-5 pb-1 pt-5 sm:px-6">
          {icon ? <ToneIcon tone={tone}>{icon}</ToneIcon> : null}
          <div className="min-w-0 flex-1 basis-48">
            <h2 className="text-base font-bold leading-tight sm:text-lg">{title}</h2>
            {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      <div className={cn("px-5 py-5 sm:px-6", title && "pt-4", bodyClassName)}>{children}</div>
    </section>
  );
}

/** Nothing here yet: a lotus, what would be here, and the way to it. */
export function AccountEmpty({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative isolate flex flex-col items-center overflow-hidden rounded-2xl border border-dashed border-primary/25 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklab,var(--primary)_6%,transparent),transparent_70%)] px-6 py-12 text-center",
        className,
      )}
    >
      <Lotus className="pointer-events-none absolute -top-10 left-1/2 -z-10 size-56 -translate-x-1/2 text-highlight opacity-25" />
      <span
        className="flex size-16 items-center justify-center rounded-2xl text-white shadow-lg shadow-primary/25 [&_svg]:size-7"
        style={{ background: SILK_GRADIENT }}
      >
        {icon}
      </span>
      <h2 className="mt-5 text-lg font-bold">{title}</h2>
      {description ? <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/** A figure on a tile: its icon in a tone, the value large, the label below. */
export function AccountStat({
  icon,
  tone = "silk",
  value,
  label,
  className,
}: {
  icon: ReactNode;
  tone?: AccountTone;
  value: ReactNode;
  label: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "group relative flex items-center gap-3 overflow-hidden rounded-2xl border bg-card p-3.5 transition hover:-translate-y-0.5 hover:shadow-md sm:p-4",
        className,
      )}
      style={{ "--tone": ACCOUNT_TONE[tone] } as CSSProperties}
    >
      <span aria-hidden className="absolute inset-y-3 start-0 w-[3px] rounded-e-full bg-[var(--tone)] opacity-70" />
      <ToneIcon tone={tone}>{icon}</ToneIcon>
      <div className="min-w-0">
        <p className="truncate text-lg font-extrabold tabular-nums leading-tight sm:text-xl">{value}</p>
        <p className="truncate text-xs text-muted-foreground sm:text-sm">{label}</p>
      </div>
    </div>
  );
}

/** The gold fan-pla hem, as a divider or along a silk panel's top. */
export function FanPlaHem({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("pointer-events-none block h-[9px] w-full", className)}
      style={{ backgroundImage: FAN_PLA_TILE, backgroundSize: "16px 9px" }}
    />
  );
}

/** Pill tabs above a list: which slice of it is showing. */
export function AccountPills<T extends string>({
  items,
  value,
  onChange,
  label,
}: {
  items: Array<{ id: T; label: ReactNode; count?: number }>;
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.id)}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition",
              active
                ? "border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/25"
                : "bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
            )}
          >
            {item.label}
            {typeof item.count === "number" && item.count > 0 ? (
              <span
                className={cn(
                  "rounded-full px-1.5 text-[11px] font-bold tabular-nums",
                  active ? "bg-white/20" : "bg-muted text-foreground",
                )}
              >
                {item.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
