import type { SocialPlatformId } from "@/lib/site-config/social-platforms";
import { cn } from "@/lib/utils";

/**
 * One glyph per social network, drawn in the text colour so it sits on any
 * background — the storefront's round buttons as much as the admin's brand
 * tiles (`SocialBrandTile`).
 */
const GLYPHS: Record<SocialPlatformId, React.ReactNode> = {
  facebook: (
    <path d="M14.2 8.4V6.6c0-.85.2-1.3 1.45-1.3H17.3V2.2c-.3-.04-1.25-.12-2.37-.12-2.35 0-3.95 1.43-3.95 4.06V8.4H8.3v3.45h2.68V21.9h3.22v-10.05h2.66l.42-3.45h-3.08Z" />
  ),
  instagram: (
    <g fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="5.2" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.4" cy="6.6" r="0.6" fill="currentColor" stroke="none" />
    </g>
  ),
  tiktok: (
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43V9.84a8.16 8.16 0 0 0 4.77 1.52V8.07a4.85 4.85 0 0 1-1.84-1.38z" />
  ),
  line: (
    <path
      fillRule="evenodd"
      d="M21.6 10.9c0-4.3-4.3-7.8-9.6-7.8s-9.6 3.5-9.6 7.8c0 3.85 3.42 7.08 8.03 7.69.31.07.74.2.84.47.1.24.06.62.03.86l-.14.82c-.04.24-.19.95.83.52 1.02-.43 5.52-3.25 7.53-5.57 1.39-1.53 2.08-3.08 2.08-4.78ZM8.83 13.2H6.93a.5.5 0 0 1-.5-.5V8.88a.5.5 0 1 1 1 0v3.32h1.4a.5.5 0 1 1 0 1Zm1.98-.5a.5.5 0 1 1-1 0V8.88a.5.5 0 1 1 1 0v3.82Zm4.6 0a.5.5 0 0 1-.9.3l-1.96-2.66v2.36a.5.5 0 1 1-1 0V8.88a.5.5 0 0 1 .9-.3l1.96 2.66V8.88a.5.5 0 1 1 1 0v3.82Zm3.08-2.42a.5.5 0 1 1 0 1h-1.4v.9h1.4a.5.5 0 1 1 0 1h-1.9a.5.5 0 0 1-.5-.5V8.88c0-.28.22-.5.5-.5h1.9a.5.5 0 1 1 0 1h-1.4v.9h1.4Z"
    />
  ),
  youtube: (
    <path
      fillRule="evenodd"
      d="M21.6 7.2a2.5 2.5 0 0 0-1.77-1.77C18.27 5 12 5 12 5s-6.27 0-7.83.43A2.5 2.5 0 0 0 2.4 7.2C2 8.76 2 12 2 12s0 3.24.4 4.8a2.5 2.5 0 0 0 1.77 1.77C5.73 19 12 19 12 19s6.27 0 7.83-.43a2.5 2.5 0 0 0 1.77-1.77c.4-1.56.4-4.8.4-4.8s0-3.24-.4-4.8ZM10 15V9l5.2 3L10 15Z"
    />
  ),
  x: (
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
  ),
  threads: (
    <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M17.6 7.6C16.4 5.3 14.4 4 12 4c-4.4 0-7 3.3-7 8s2.6 8 7 8c3.6 0 6.2-2 6.2-4.9 0-2.6-2.1-3.9-4.9-3.9-2.3 0-3.8 1-3.8 2.5 0 1.3 1.1 2.1 2.6 2.1 2.6 0 3.8-2 3.8-5.4 0-.6 0-1.1-.1-1.6" />
    </g>
  ),
  pinterest: (
    <path
      fillRule="evenodd"
      d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm.55 3.6c-3.6 0-5.5 2.45-5.5 4.6 0 1.3.5 2.45 1.55 2.88.17.07.33 0 .38-.2l.15-.6c.05-.2.03-.27-.12-.44-.31-.37-.51-.85-.51-1.53 0-1.97 1.47-3.73 3.83-3.73 2.09 0 3.24 1.28 3.24 2.98 0 2.24-.99 4.13-2.46 4.13-.81 0-1.42-.67-1.22-1.5.23-.98.69-2.04.69-2.75 0-.63-.34-1.16-1.04-1.16-.83 0-1.49.86-1.49 2 0 .73.25 1.22.25 1.22l-1 4.24c-.3 1.26-.05 2.8-.02 2.95.01.1.13.12.19.05.08-.1 1.08-1.34 1.42-2.58l.55-2.15c.27.52 1.07.98 1.92.98 2.52 0 4.24-2.3 4.24-5.38 0-2.33-1.97-4.5-4.96-4.5Z"
    />
  ),
  linkedin: (
    <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9.75h3.96V21H3V9.75Zm6.5 0h3.8v1.54h.05c.53-1 1.82-2.04 3.75-2.04 4.01 0 4.75 2.64 4.75 6.07V21h-3.96v-5.03c0-1.2-.02-2.74-1.67-2.74-1.67 0-1.93 1.3-1.93 2.65V21H9.5V9.75Z" />
  ),
  whatsapp: (
    <path
      fillRule="evenodd"
      d="M12.04 2a9.9 9.9 0 0 0-8.5 14.98L2 22l5.17-1.5A9.9 9.9 0 1 0 12.04 2ZM8.7 6.9c.2-.02.45-.02.64 0 .2 0 .43.02.62.5l.86 2.06c.08.18.07.37-.05.56l-.58.74c-.13.16-.16.33-.04.53a8.1 8.1 0 0 0 3.74 3.24c.2.09.38.06.52-.1l.8-.98c.17-.2.36-.23.58-.14l2 .94c.25.12.4.2.43.33.08.4-.06 1.17-.5 1.62-.55.55-1.42.98-2.4.85-1.74-.23-3.86-1.24-5.6-3.12-1.37-1.48-2.08-3.06-2.1-4.27-.02-.92.4-1.77.95-2.27.15-.15.34-.33.53-.35Z"
    />
  ),
  telegram: (
    <path d="M21.2 3.4 2.9 10.5c-1.25.5-1.24 1.2-.23 1.5l4.7 1.47 1.8 5.53c.22.6.11.84.75.84.49 0 .7-.22.98-.49l2.35-2.29 4.9 3.62c.9.5 1.55.24 1.77-.84l3.2-15.1c.33-1.32-.5-1.92-1.42-1.34Zm-12.9 10.3 9.9-6.25c.48-.29.92-.13.56.2l-8.47 7.65-.33 3.52-1.66-5.12Z" />
  ),
};

export function SocialGlyph({
  platform,
  className,
}: {
  platform: SocialPlatformId;
  className?: string;
}) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={cn("size-4", className)}>
      {GLYPHS[platform]}
    </svg>
  );
}

const TILE_STYLE: Record<SocialPlatformId, string> = {
  facebook: "bg-[#1877F2] text-white",
  instagram: "bg-[linear-gradient(45deg,#FEDA75_0%,#FA7E1E_25%,#D62976_50%,#962FBF_75%,#4F5BD5_100%)] text-white",
  tiktok: "bg-black text-white dark:bg-white dark:text-black",
  line: "bg-[#06C755] text-white",
  youtube: "bg-[#FF0000] text-white",
  x: "bg-black text-white dark:bg-white dark:text-black",
  threads: "bg-black text-white dark:bg-white dark:text-black",
  pinterest: "bg-[#E60023] text-white",
  linkedin: "bg-[#0A66C2] text-white",
  whatsapp: "bg-[#25D366] text-white",
  telegram: "bg-[#26A5E4] text-white",
};

/** The glyph on the network's own colour, for settings rows and previews. */
export function SocialBrandTile({
  platform,
  className,
  glyphClassName,
  muted,
}: {
  platform: SocialPlatformId;
  className?: string;
  glyphClassName?: string;
  /** Greyed, for a profile not set or a button switched off. */
  muted?: boolean;
}) {
  return (
    <span
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-xl shadow-sm transition",
        muted ? "bg-muted text-muted-foreground shadow-none" : TILE_STYLE[platform],
        className,
      )}
      aria-hidden="true"
    >
      <SocialGlyph platform={platform} className={cn("size-[18px]", glyphClassName)} />
    </span>
  );
}
