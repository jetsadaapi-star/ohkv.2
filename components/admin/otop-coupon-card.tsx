"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * A discount coupon dressed as a piece of local craft — the store sells OTOP
 * goods from Kalasin, famous for Phrae Wa silk. The face is a woven silk
 * panel (a khit diamond lattice in gold thread over the cloth's colour), edged
 * with a saw-tooth "fan pla" border and a lotus in the corner; the stub is
 * cream cotton with the code stamped on it.
 *
 * Each kind of discount wears a different traditional dye: lac red for a
 * percentage, indigo for a fixed amount, banana-leaf green for free delivery.
 * Every motif is drawn here in SVG; nothing is taken from an existing logo.
 */

export type OtopCouponTone = "lac" | "indigo" | "leaf";

const TONES: Record<
  OtopCouponTone,
  { cloth: string; deep: string; thread: string; ink: string; seal: string }
> = {
  // ครั่ง — lac-dyed silk
  lac: { cloth: "#8E1B2C", deep: "#4F0D18", thread: "#E7C36A", ink: "#7A1626", seal: "#B8862B" },
  // คราม — indigo cotton
  indigo: { cloth: "#24336B", deep: "#111A3D", thread: "#E2C26F", ink: "#1E2B5E", seal: "#A9842F" },
  // ใบตอง — banana leaf
  leaf: { cloth: "#1F5B3A", deep: "#0E2E1D", thread: "#E9CB78", ink: "#184A2F", seal: "#B08A33" },
};

/** An eight-petal lotus, the way it is carved on temple gables. */
function Lotus({ color, className }: { color: string; className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <g fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round">
        {Array.from({ length: 8 }, (_, index) => (
          <path
            key={index}
            transform={`rotate(${index * 45} 50 50)`}
            d="M50 50 C44 38 44 22 50 8 C56 22 56 38 50 50 Z"
          />
        ))}
        {Array.from({ length: 8 }, (_, index) => (
          <path
            key={`inner-${index}`}
            transform={`rotate(${index * 45 + 22.5} 50 50)`}
            d="M50 50 C46 42 46 32 50 24 C54 32 54 42 50 50 Z"
            opacity="0.7"
          />
        ))}
        <circle cx="50" cy="50" r="7" />
        <circle cx="50" cy="50" r="2.5" fill={color} />
      </g>
    </svg>
  );
}

export function OtopCouponCard({
  tone,
  headline,
  label,
  statusLabel,
  statusActive,
  code,
  condition,
  validity,
  footer,
  className,
}: {
  tone: OtopCouponTone;
  /** The offer in a few words: "ลด 15%", "ส่งฟรี". */
  headline: string;
  /** The coupon's own name, or its kind. */
  label: string;
  statusLabel: string;
  statusActive: boolean;
  /** The code to type; empty draws a placeholder. */
  code: string;
  /** The one condition worth putting on the face (the minimum order). */
  condition: string;
  /** "Until 7 Dec 2026". */
  validity: string;
  /** Small print under the code, e.g. the store's name. */
  footer?: string;
  className?: string;
}) {
  const id = useId().replace(/:/g, "");
  const c = TONES[tone];

  return (
    <div
      className={cn(
        "relative isolate overflow-hidden rounded-[22px] shadow-[0_18px_40px_-18px_rgba(60,10,20,0.55)]",
        className,
      )}
      style={{ background: c.deep }}
    >
      {/* Face — the woven panel */}
      <div className="relative px-5 pb-6 pt-5" style={{ background: `linear-gradient(150deg, ${c.cloth} 0%, ${c.deep} 100%)` }}>
        <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
          <defs>
            {/* Khit: a diamond lattice with a dot in each eye, as on Phrae Wa */}
            <pattern id={`khit-${id}`} width="22" height="22" patternUnits="userSpaceOnUse">
              <path d="M11 1 L21 11 L11 21 L1 11 Z" fill="none" stroke={c.thread} strokeWidth="0.8" opacity="0.28" />
              <path d="M11 6 L16 11 L11 16 L6 11 Z" fill="none" stroke={c.thread} strokeWidth="0.6" opacity="0.2" />
              <circle cx="11" cy="11" r="1.1" fill={c.thread} opacity="0.35" />
            </pattern>
            {/* A silk sheen across the weave */}
            <linearGradient id={`sheen-${id}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#fff" stopOpacity="0.16" />
              <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
              <stop offset="0.75" stopColor="#fff" stopOpacity="0.08" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
          </defs>
          <rect width="100%" height="100%" fill={`url(#khit-${id})`} />
          <rect width="100%" height="100%" fill={`url(#sheen-${id})`} />
        </svg>

        {/* Fan pla — the saw-tooth border woven along a sarong's hem */}
        <svg className="absolute inset-x-0 top-0 h-2.5 w-full" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <pattern id={`teeth-${id}`} width="12" height="10" patternUnits="userSpaceOnUse">
              <path d="M0 0 L6 9 L12 0 Z" fill={c.thread} opacity="0.85" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#teeth-${id})`} />
        </svg>

        <Lotus color={c.thread} className="pointer-events-none absolute -bottom-9 -right-9 size-36 opacity-35" />

        <div className="relative flex items-start justify-between gap-2">
          <span
            className="max-w-[70%] truncate rounded-full border px-2.5 py-0.5 text-[11px] font-semibold backdrop-blur-sm"
            style={{ borderColor: `${c.thread}80`, color: c.thread, background: "rgba(0,0,0,0.18)" }}
          >
            {label}
          </span>
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
            style={
              statusActive
                ? { background: c.thread, color: c.ink }
                : { background: "rgba(255,255,255,0.18)", color: "#fff" }
            }
          >
            <span className="size-1.5 rounded-full" style={{ background: statusActive ? c.ink : "#fff" }} />
            {statusLabel}
          </span>
        </div>

        <p
          className="relative mt-5 bg-clip-text text-[2.15rem] font-black leading-none tracking-tight text-transparent drop-shadow-[0_2px_0_rgba(0,0,0,0.25)]"
          style={{ backgroundImage: `linear-gradient(180deg, #FFF3C9 0%, ${c.thread} 55%, ${c.seal} 100%)` }}
        >
          {headline}
        </p>
        <p className="relative mt-2 text-xs font-medium text-white/85">{condition}</p>

        {/* A gold seal: the mark of a community-made product */}
        <div
          className="absolute bottom-4 right-5 flex size-[3.25rem] rotate-[-12deg] flex-col items-center justify-center rounded-full border-2 border-dashed text-center leading-none"
          style={{ borderColor: c.thread, color: c.thread, background: "rgba(0,0,0,0.15)" }}
          aria-hidden="true"
        >
          <span className="text-[11px] font-black tracking-wider">OTOP</span>
          <span className="mt-0.5 text-[7px] font-semibold">★ ★ ★</span>
        </div>
      </div>

      {/* Perforation, with the two half-moon notches of a torn ticket */}
      <div className="relative h-0">
        <div className="absolute inset-x-5 top-0 border-t-2 border-dashed" style={{ borderColor: `${c.thread}aa` }} />
        <span className="absolute -left-3 -top-3 size-6 rounded-full bg-background" />
        <span className="absolute -right-3 -top-3 size-6 rounded-full bg-background" />
      </div>

      {/* Stub — cream cotton with the code stamped on */}
      <div className="relative px-5 pb-4 pt-4" style={{ background: "linear-gradient(180deg, #FBF4E2 0%, #F3E6C6 100%)" }}>
        <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
          <defs>
            <pattern id={`weft-${id}`} width="6" height="6" patternUnits="userSpaceOnUse">
              <path d="M0 3 H6" stroke={c.ink} strokeWidth="0.4" opacity="0.06" />
              <path d="M3 0 V6" stroke={c.ink} strokeWidth="0.4" opacity="0.04" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#weft-${id})`} />
        </svg>
        <div className="relative flex items-center justify-between gap-3">
          <div
            className="min-w-0 rounded-lg border-2 border-dashed px-3 py-1.5"
            style={{ borderColor: `${c.ink}66`, background: "rgba(255,255,255,0.55)" }}
          >
            <span
              className="block truncate font-mono text-base font-black tracking-[0.18em]"
              style={{ color: c.ink }}
            >
              {code || "••••••••"}
            </span>
          </div>
          <span className="shrink-0 text-right text-[11px] font-semibold" style={{ color: `${c.ink}cc` }}>
            {validity}
          </span>
        </div>
        {footer ? (
          <p className="relative mt-4 truncate text-[10px] font-medium" style={{ color: `${c.ink}99` }}>
            {footer}
          </p>
        ) : null}
      </div>
    </div>
  );
}
