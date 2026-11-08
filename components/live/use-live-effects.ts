"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_LIVE_EFFECTS,
  LiveVideoProcessor,
  liveEffectsSupported,
  loadLiveEffectSettings,
  saveLiveEffectSettings,
  type LiveEffectSettings,
} from "@/lib/live/video-effects";

/**
 * The studio's camera with effects applied. Returns the stream to preview and
 * publish: the processed picture plus the camera's own sound. Its video track
 * stays the same when the camera is switched, so a live keeps going; when the
 * browser can't do WebGL the camera is passed through untouched.
 */
export function useLiveEffects(camera: MediaStream | null) {
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
    if (!liveEffectsSupported()) {
      setSupported(false);
      return;
    }
    try {
      setProcessor(new LiveVideoProcessor());
    } catch {
      setSupported(false);
    }
  }, [camera]);

  useEffect(() => () => processor?.destroy(), [processor]);

  useEffect(() => {
    processor?.setSource(camera);
  }, [processor, camera]);

  useEffect(() => {
    processor?.setSettings(settings);
    saveLiveEffectSettings(settings);
  }, [processor, settings]);

  const media = useMemo(() => {
    if (!camera) return null;
    if (!processor) return supported ? null : camera;
    return new MediaStream([processor.track, ...camera.getAudioTracks()]);
  }, [camera, processor, supported]);

  return {
    /** What to preview and publish; null while the effects are starting. */
    media,
    /** False when this browser can't draw effects (the camera goes out as is). */
    supported,
    active: Boolean(processor),
    settings,
    update: (patch: Partial<LiveEffectSettings>) => setSettings((s) => ({ ...s, ...patch })),
    reset: () =>
      setSettings((s) => ({ ...s, smooth: 0, brighten: 0, filter: "natural", effect: "none", frame: "none", banner: "" })),
  };
}

