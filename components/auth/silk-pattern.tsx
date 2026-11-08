import { cn } from "@/lib/utils";

/**
 * Woven-silk dressing shared by the account pages (sign in, sign up) and the
 * seller sign-up: a khit lattice over the brand colour, a gold "fan pla" hem
 * and a temple-gable lotus. Every colour comes from the store theme — primary,
 * and the gold accent (highlight) — so on the OTOP theme it is Phrae Wa
 * red-brown and gold thread, and on any other theme it wears that theme.
 *
 * No hooks and no "use client": server pages (become-vendor) read these
 * values directly, which they could not through a client module.
 */

export const KHIT_TILE = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='44' height='44'><g fill='none' stroke='#fff'><path d='M22 2 42 22 22 42 2 22Z' stroke-width='1'/><path d='M22 11 33 22 22 33 11 22Z' stroke-width='.8'/></g><path d='M22 18.5 25.5 22 22 25.5 18.5 22Z' fill='#fff'/><g fill='#fff'><circle cx='0' cy='0' r='1.6'/><circle cx='44' cy='0' r='1.6'/><circle cx='0' cy='44' r='1.6'/><circle cx='44' cy='44' r='1.6'/></g></svg>`,
)}")`;
export const FAN_PLA_TILE = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='16' height='9'><path d='M0 0 8 8 16 0Z' fill='#E2B95A'/></svg>`,
)}")`;

/** The silk's colour: the theme's primary, lit at the top and deepened below. */
export const SILK_GRADIENT =
  "linear-gradient(155deg, color-mix(in oklab, var(--theme-primary) 88%, white) 0%, var(--theme-primary) 45%, color-mix(in oklab, var(--theme-primary) 55%, black) 100%)";

/** An eight-petal lotus, like the ones carved on temple gables. */
export function Lotus({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
        {Array.from({ length: 8 }, (_, index) => (
          <path key={index} transform={`rotate(${index * 45} 50 50)`} d="M50 50 C44 38 44 22 50 8 C56 22 56 38 50 50 Z" />
        ))}
        {Array.from({ length: 8 }, (_, index) => (
          <path key={`i${index}`} transform={`rotate(${index * 45 + 22.5} 50 50)`} d="M50 50 C46 42 46 32 50 24 C54 32 54 42 50 50 Z" opacity="0.7" />
        ))}
        <circle cx="50" cy="50" r="7" />
      </g>
    </svg>
  );
}

/** The woven layers behind a silk panel; place inside a `relative isolate` box. */
export function SilkBackdrop({ lotusClassName }: { lotusClassName?: string }) {
  return (
    <>
      <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 opacity-[0.09]" style={{ backgroundImage: KHIT_TILE }} />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[9px]"
        style={{ backgroundImage: FAN_PLA_TILE, backgroundSize: "16px 9px" }}
      />
      <span aria-hidden className="pointer-events-none absolute -right-28 -top-28 -z-10 size-80 rounded-full bg-highlight/20 blur-3xl" />
      <Lotus
        className={cn(
          "pointer-events-none absolute -bottom-16 -right-16 -z-10 size-72 text-highlight opacity-25",
          lotusClassName,
        )}
      />
    </>
  );
}

/**
 * Form controls in an account form: taller, rounder, on a soft fill. Kept as
 * one class string so every silk page draws its fields alike.
 */
export const SILK_FORM_CONTROLS =
  "[&_input:not([type=checkbox]):not([type=radio]):not([type=file])]:h-11 [&_input:not([type=checkbox]):not([type=radio]):not([type=file])]:rounded-xl [&_input:not([type=checkbox]):not([type=radio]):not([type=file])]:bg-muted/40 [&_input:not([type=checkbox]):not([type=radio]):not([type=file])]:focus-visible:bg-background [&_[data-slot=button]]:rounded-xl [&_button[type=submit]]:h-11 [&_button[type=submit]]:text-base [&_button[type=submit]]:font-semibold [&_button[type=submit]]:shadow-md [&_button[type=submit]]:shadow-primary/20";

