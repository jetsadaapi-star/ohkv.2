"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SinkAudio = HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> };

/** Whether this browser can send sound to a chosen speaker. */
export function canPickSpeaker() {
  return typeof window !== "undefined" && typeof (HTMLAudioElement.prototype as SinkAudio).setSinkId === "function";
}

/**
 * The studio's sound. The microphone goes through a level control and a
 * meter before it is sent; the host can listen to themself (monitor), test
 * the speaker, and hear a chime for gifts, all on the speaker they picked.
 *
 * The track it gives stays the same when the microphone changes, so a live
 * keeps its sound. Without Web Audio the microphone goes out as it is.
 */
export function useLiveAudio(
  mic: MediaStream | null,
  options: { gain: number; monitor: boolean; outputId: string },
) {
  const ctxRef = useRef<AudioContext | null>(null);
  const graph = useRef<{
    gain: GainNode;
    analyser: AnalyserNode;
    dest: MediaStreamAudioDestinationNode;
    fx: MediaStreamAudioDestinationNode;
    source: MediaStreamAudioSourceNode | null;
  } | null>(null);
  const monitorEl = useRef<SinkAudio | null>(null);
  const fxEl = useRef<SinkAudio | null>(null);
  const [track, setTrack] = useState<MediaStreamTrack | null>(null);
  const [failed, setFailed] = useState(false);
  const [level, setLevel] = useState(0);

  // Build the graph the first time there is a microphone.
  useEffect(() => {
    if (!mic || ctxRef.current || failed) return;
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      const gain = ctx.createGain();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      const dest = ctx.createMediaStreamDestination();
      gain.connect(analyser);
      gain.connect(dest);
      // The studio's own sounds (speaker test, gift chime) — never sent.
      const fx = ctx.createMediaStreamDestination();
      ctxRef.current = ctx;
      graph.current = { gain, analyser, dest, fx, source: null };
      const monitor = new Audio() as SinkAudio;
      monitor.srcObject = dest.stream;
      monitorEl.current = monitor;
      const fxAudio = new Audio() as SinkAudio;
      fxAudio.srcObject = fx.stream;
      void fxAudio.play().catch(() => {});
      fxEl.current = fxAudio;
      setTrack(dest.stream.getAudioTracks()[0] ?? null);
    } catch {
      setFailed(true);
    }
  }, [mic, failed]);

  // A new microphone feeds the same graph.
  useEffect(() => {
    const ctx = ctxRef.current;
    const g = graph.current;
    if (!ctx || !g) return;
    g.source?.disconnect();
    g.source = null;
    if (mic && mic.getAudioTracks().length) {
      g.source = ctx.createMediaStreamSource(mic);
      g.source.connect(g.gain);
      void ctx.resume().catch(() => {});
    }
  }, [mic, track]);

  useEffect(() => {
    const g = graph.current;
    if (g && ctxRef.current) g.gain.gain.setTargetAtTime(options.gain / 100, ctxRef.current.currentTime, 0.05);
  }, [options.gain, track]);

  // Speaker for monitoring and the studio's sounds.
  useEffect(() => {
    for (const el of [monitorEl.current, fxEl.current]) {
      if (el?.setSinkId) void el.setSinkId(options.outputId || "").catch(() => {});
    }
  }, [options.outputId, track]);

  useEffect(() => {
    const el = monitorEl.current;
    if (!el) return;
    if (options.monitor) void el.play().catch(() => {});
    else el.pause();
  }, [options.monitor, track]);

  // The meter, ten times a second.
  useEffect(() => {
    const g = graph.current;
    if (!g || !mic) return;
    const data = new Float32Array(g.analyser.fftSize);
    let last = 0;
    const id = setInterval(() => {
      g.analyser.getFloatTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
      const value = Math.min(1, Math.sqrt(sum / data.length) * 4);
      if (Math.abs(value - last) > 0.02) {
        last = value;
        setLevel(value);
      }
    }, 100);
    return () => clearInterval(id);
  }, [mic, track]);

  useEffect(
    () => () => {
      monitorEl.current?.pause();
      fxEl.current?.pause();
      void ctxRef.current?.close().catch(() => {});
    },
    [],
  );

  const tone = useCallback((notes: Array<{ freq: number; at: number; dur: number }>, volume = 0.18) => {
    const ctx = ctxRef.current;
    const g = graph.current;
    if (!ctx || !g) return;
    void ctx.resume().catch(() => {});
    void fxEl.current?.play().catch(() => {});
    const start = ctx.currentTime + 0.02;
    for (const note of notes) {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = note.freq;
      env.gain.setValueAtTime(0, start + note.at);
      env.gain.linearRampToValueAtTime(volume, start + note.at + 0.02);
      env.gain.exponentialRampToValueAtTime(0.0001, start + note.at + note.dur);
      osc.connect(env);
      env.connect(g.fx);
      osc.start(start + note.at);
      osc.stop(start + note.at + note.dur + 0.05);
    }
  }, []);

  /** Three beeps on the chosen speaker. */
  const testSpeaker = useCallback(
    () =>
      tone([
        { freq: 660, at: 0, dur: 0.18 },
        { freq: 880, at: 0.25, dur: 0.18 },
        { freq: 1100, at: 0.5, dur: 0.3 },
      ]),
    [tone],
  );

  /** A soft two-note chime for a gift. */
  const chime = useCallback(
    () =>
      tone(
        [
          { freq: 1046.5, at: 0, dur: 0.35 },
          { freq: 1568, at: 0.12, dur: 0.5 },
        ],
        0.12,
      ),
    [tone],
  );

  /** Call from a click: browsers start sound only after the user does something. */
  const wake = useCallback(() => {
    void ctxRef.current?.resume().catch(() => {});
  }, []);

  return {
    /** What to send; falls back to the microphone itself without Web Audio. */
    track: failed ? (mic?.getAudioTracks()[0] ?? null) : track,
    level,
    processing: !failed && Boolean(track),
    testSpeaker,
    chime,
    wake,
  };
}
