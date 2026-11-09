"use client";

import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_LIVE_EFFECTS,
  LiveVideoProcessor,
  liveEffectsSupported,
  loadLiveEffectSettings,
  saveLiveEffectSettings,
  type LiveEffectSettings,
} from "@/lib/live/video-effects";

/**
 * The studio's camera with effects applied. Gives the video track to preview
 * and publish; it stays the same when the camera is switched, so a live keeps
 * going. When the browser can't do WebGL the camera's own track is passed
 * through untouched.
 */
export function useLiveEffects(
  camera: MediaStream | null,
  output: { width: number; height: number; fps: number; zoom: number },
) {
  const [settings, setSettings] = useState<LiveEffectSettings>(() =>
    typeof window === "undefined" ? { ...DEFAULT_LIVE_EFFECTS } : loadLiveEffectSettings(),
  );
  const [processor, setProcessor] = useState<LiveVideoProcessor | null>(null);
  const [supported, setSupported] = useState(true);
  const created = useRef(false);

  // Built the first time there is a camera, kept until the page closes.
  useEffect(() => {
    if (!camera || created.current) return;
    created.current = true;
    let next: LiveVideoProcessor | null = null;
    try {
      next = liveEffectsSupported() ? new LiveVideoProcessor() : null;
    } catch {
      next = null;
    }
    if (next) setProcessor(next);
    else setSupported(false);
  }, [camera]);

  useEffect(() => () => processor?.destroy(), [processor]);

  useEffect(() => {
    processor?.setSource(camera);
  }, [processor, camera]);

  useEffect(() => {
    processor?.setSettings(settings);
    saveLiveEffectSettings(settings);
  }, [processor, settings]);

  const { width, height, fps, zoom } = output;
  useEffect(() => {
    processor?.setOutput({ width, height, fps });
  }, [processor, width, height, fps]);

  useEffect(() => {
    processor?.setZoom(zoom / 100);
  }, [processor, zoom]);

  const video = camera
    ? processor
      ? processor.track
      : supported
        ? null
        : (camera.getVideoTracks()[0] ?? null)
    : null;

  return {
    processor,
    /** What to preview and publish; null while the effects are starting. */
    video,
    /** False when this browser can't draw effects (the camera goes out as is). */
    supported,
    active: Boolean(processor),
    settings,
    update: (patch: Partial<LiveEffectSettings>) => setSettings((s) => ({ ...s, ...patch })),
    reset: () =>
      setSettings((s) => ({ ...s, smooth: 0, brighten: 0, filter: "natural", effect: "none", frame: "none", banner: "" })),
  };
}
