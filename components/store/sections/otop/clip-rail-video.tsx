"use client";

/** A rail card's video: still until hovered, then a silent preview loop. */
export function ClipRailVideo({ src, poster }: { src: string; poster?: string }) {
  return (
    <video
      src={src}
      poster={poster || undefined}
      muted
      playsInline
      loop
      preload="metadata"
      className="absolute inset-0 size-full object-cover"
      onMouseEnter={(event) => void event.currentTarget.play().catch(() => {})}
      onMouseLeave={(event) => {
        event.currentTarget.pause();
        event.currentTarget.currentTime = 0;
      }}
    />
  );
}
