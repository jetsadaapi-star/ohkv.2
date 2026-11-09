"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LiveVideoProcessor } from "@/lib/live/video-effects";
import {
  LIVE_SOURCE_LIMIT,
  addSourceImage,
  deleteSourceImage,
  loadSourceImage,
  loadSourceList,
  newSourceId,
  saveSourceList,
  type LiveSource,
  type LiveTextStyle,
} from "@/lib/live/studio-sources";

/**
 * The studio's sources: the list, the pictures ready to draw, and edits.
 * Every change reaches the processor (so the stream) at once and is
 * remembered on this device.
 */
export function useLiveSources(processor: LiveVideoProcessor | null) {
  const [sources, setSources] = useState<LiveSource[]>([]);
  const [bitmaps, setBitmaps] = useState<Map<string, ImageBitmap>>(() => new Map());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Saving starts once the saved list is back, so it is never overwritten by an empty one.
  const [ready, setReady] = useState(false);
  const current = useRef<LiveSource[]>([]);

  // The saved list and its pictures, once on arrival.
  useEffect(() => {
    const list = loadSourceList();
    let cancelled = false;
    void (async () => {
      const decoded = new Map<string, ImageBitmap>();
      const kept: LiveSource[] = [];
      for (const source of list) {
        if (source.kind !== "image") {
          kept.push(source);
          continue;
        }
        const blob = await loadSourceImage(source.imageKey);
        if (!blob) continue;
        try {
          decoded.set(source.imageKey, await createImageBitmap(blob));
          kept.push(source);
        } catch {
          // A picture that no longer decodes is dropped.
        }
      }
      if (cancelled) return;
      setBitmaps(decoded);
      setSources(kept);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    processor?.setSources(sources, bitmaps);
  }, [processor, sources, bitmaps]);

  useEffect(() => {
    current.current = sources;
    if (ready) saveSourceList(sources);
  }, [sources, ready]);

  const full = sources.length >= LIVE_SOURCE_LIMIT;

  const addImage = useCallback(
    async (file: File) => {
      if (full) return null;
      const { key, bitmap, aspect } = await addSourceImage(file);
      const source: LiveSource = {
        id: newSourceId(),
        kind: "image",
        name: file.name.replace(/\.[^.]+$/, "").slice(0, 60),
        imageKey: key,
        aspect,
        x: 0.5,
        y: 0.42,
        size: aspect >= 1 ? 40 : 28,
        rotation: 0,
        opacity: 100,
        visible: true,
      };
      setBitmaps((map) => new Map(map).set(key, bitmap));
      setSources((list) => [...list, source]);
      setSelectedId(source.id);
      return source;
    },
    [full],
  );

  const addText = useCallback(
    (text: string, style: LiveTextStyle) => {
      if (full) return null;
      const source: LiveSource = {
        id: newSourceId(),
        kind: "text",
        name: text.slice(0, 60),
        text,
        style,
        x: 0.5,
        y: 0.62,
        size: 32,
        rotation: 0,
        opacity: 100,
        visible: true,
      };
      setSources((list) => [...list, source]);
      setSelectedId(source.id);
      return source;
    },
    [full],
  );

  const update = useCallback((id: string, patch: Partial<LiveSource>) => {
    setSources((list) => list.map((s) => (s.id === id ? ({ ...s, ...patch } as LiveSource) : s)));
  }, []);

  const remove = useCallback((id: string) => {
    const gone = current.current.find((s) => s.id === id);
    if (gone?.kind === "image") {
      void deleteSourceImage(gone.imageKey);
      setBitmaps((map) => {
        const next = new Map(map);
        next.delete(gone.imageKey);
        return next;
      });
    }
    setSources((list) => list.filter((s) => s.id !== id));
    setSelectedId((selected) => (selected === id ? null : selected));
  }, []);

  /** Toward the front (+1) or the back (-1). */
  const move = useCallback((id: string, step: 1 | -1) => {
    setSources((list) => {
      const i = list.findIndex((s) => s.id === id);
      const j = i + step;
      if (i < 0 || j < 0 || j >= list.length) return list;
      const next = [...list];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }, []);

  return { sources, bitmaps, selectedId, select: setSelectedId, addImage, addText, update, remove, move, full };
}
