"use client";

import { useEffect, useRef, useState } from "react";
import { STAGE_H, STAGE_W, sourceBox, type LiveSource } from "@/lib/live/studio-sources";
import { cn } from "@/lib/utils";

/**
 * Handles over the preview for placing sources: drag one to move it, drag its
 * corner to resize it. The preview shows exactly the stream (9:16), so a
 * fraction of the preview is the same fraction of what viewers see.
 */
export function LiveSourceOverlay({
  sources,
  selectedId,
  onSelect,
  onChange,
}: {
  sources: LiveSource[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (id: string, patch: Partial<LiveSource>) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [fontFamily, setFontFamily] = useState("sans-serif");
  useEffect(() => {
    setFontFamily(getComputedStyle(document.body).fontFamily || "sans-serif");
  }, []);

  const drag = (event: React.PointerEvent, source: LiveSource, mode: "move" | "resize") => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    event.preventDefault();
    event.stopPropagation();
    onSelect(source.id);
    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture(event.pointerId);
    const start = { px: event.clientX, py: event.clientY, x: source.x, y: source.y, size: source.size };
    const centre = { x: box.left + source.x * box.width, y: box.top + source.y * box.height };
    const startDist = Math.max(8, Math.hypot(event.clientX - centre.x, event.clientY - centre.y));
    const move = (e: PointerEvent) => {
      if (mode === "move") {
        onChange(source.id, {
          x: Math.min(1, Math.max(0, start.x + (e.clientX - start.px) / box.width)),
          y: Math.min(1, Math.max(0, start.y + (e.clientY - start.py) / box.height)),
        });
      } else {
        const dist = Math.hypot(e.clientX - centre.x, e.clientY - centre.y);
        onChange(source.id, { size: Math.round(Math.min(100, Math.max(5, (start.size * dist) / startDist))) });
      }
    };
    const up = () => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", up);
      target.removeEventListener("pointercancel", up);
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", up);
    target.addEventListener("pointercancel", up);
  };

  return (
    <div ref={ref} className="absolute inset-0 z-10" onPointerDown={() => onSelect(null)}>
      {sources
        .filter((s) => s.visible)
        .map((source) => {
          const { w, h } = sourceBox(source, fontFamily);
          const selected = source.id === selectedId;
          return (
            <div
              key={source.id}
              onPointerDown={(e) => drag(e, source, "move")}
              className={cn(
                "absolute cursor-move touch-none rounded-md",
                selected ? "outline-2 outline-dashed outline-white bg-white/10" : "outline-1 outline-dashed outline-white/40 hover:outline-white/80",
              )}
              style={{
                left: `${source.x * 100}%`,
                top: `${source.y * 100}%`,
                width: `${(w / STAGE_W) * 100}%`,
                height: `${(h / STAGE_H) * 100}%`,
                transform: `translate(-50%, -50%) rotate(${source.rotation}deg)`,
              }}
            >
              {selected ? (
                <span
                  onPointerDown={(e) => drag(e, source, "resize")}
                  className="absolute -bottom-2.5 -end-2.5 size-5 cursor-nwse-resize touch-none rounded-full border-2 border-rose-500 bg-white shadow"
                />
              ) : null}
            </div>
          );
        })}
    </div>
  );
}
