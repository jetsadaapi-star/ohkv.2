"use client";

/**
 * The studio's device and output settings, remembered on the store's device:
 * which camera, microphone and speaker, the microphone's clean-up and level,
 * the quality the live is sent at, and the studio's own conveniences.
 */

export const LIVE_QUALITIES = ["540", "720", "1080"] as const;
export type LiveQuality = (typeof LIVE_QUALITIES)[number];

/** Portrait output size, what to ask the camera for, and the bitrate ceiling. */
export const LIVE_QUALITY_SPEC: Record<
  LiveQuality,
  { width: number; height: number; camera: { width: number; height: number }; maxBitrate: number }
> = {
  "540": { width: 540, height: 960, camera: { width: 1280, height: 720 }, maxBitrate: 1_200_000 },
  "720": { width: 720, height: 1280, camera: { width: 1280, height: 720 }, maxBitrate: 2_500_000 },
  "1080": { width: 1080, height: 1920, camera: { width: 1920, height: 1080 }, maxBitrate: 4_500_000 },
};

export const LIVE_FPS = [24, 30] as const;
export type LiveFps = (typeof LIVE_FPS)[number];

/** On a slow connection: keep the motion smooth, or keep the picture sharp. */
export type LivePriority = "smooth" | "sharp";

export interface LiveStudioPrefs {
  cameraId: string;
  micId: string;
  /** Speaker / headphones for monitoring and the studio's sounds ("" = default). */
  outputId: string;
  quality: LiveQuality;
  fps: LiveFps;
  priority: LivePriority;
  /** Microphone level, 0–200 %. */
  micGain: number;
  noiseSuppression: boolean;
  echoCancellation: boolean;
  autoGain: boolean;
  /** Digital zoom, 100–200 %. */
  zoom: number;
  /** 3-2-1 before going on air. */
  countdown: boolean;
  /** A chime in the studio when a gift arrives. */
  giftSound: boolean;
}

export const DEFAULT_STUDIO_PREFS: LiveStudioPrefs = {
  cameraId: "",
  micId: "",
  outputId: "",
  quality: "720",
  fps: 30,
  priority: "smooth",
  micGain: 100,
  noiseSuppression: true,
  echoCancellation: true,
  autoGain: true,
  zoom: 100,
  countdown: true,
  giftSound: true,
};

const KEY = "ohk-live-studio-prefs";
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export function loadStudioPrefs(): LiveStudioPrefs {
  try {
    const saved = JSON.parse(window.localStorage.getItem(KEY) || "{}") as Partial<LiveStudioPrefs>;
    const d = DEFAULT_STUDIO_PREFS;
    const str = (v: unknown) => (typeof v === "string" ? v.slice(0, 200) : "");
    const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);
    return {
      cameraId: str(saved.cameraId),
      micId: str(saved.micId),
      outputId: str(saved.outputId),
      quality: LIVE_QUALITIES.includes(saved.quality as LiveQuality) ? (saved.quality as LiveQuality) : d.quality,
      fps: LIVE_FPS.includes(saved.fps as LiveFps) ? (saved.fps as LiveFps) : d.fps,
      priority: saved.priority === "sharp" ? "sharp" : "smooth",
      micGain: typeof saved.micGain === "number" ? clamp(saved.micGain, 0, 200) : d.micGain,
      noiseSuppression: bool(saved.noiseSuppression, d.noiseSuppression),
      echoCancellation: bool(saved.echoCancellation, d.echoCancellation),
      autoGain: bool(saved.autoGain, d.autoGain),
      zoom: typeof saved.zoom === "number" ? clamp(saved.zoom, 100, 200) : d.zoom,
      countdown: bool(saved.countdown, d.countdown),
      giftSound: bool(saved.giftSound, d.giftSound),
    };
  } catch {
    return { ...DEFAULT_STUDIO_PREFS };
  }
}

export function saveStudioPrefs(prefs: LiveStudioPrefs) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // Storage blocked: the settings last for this visit.
  }
}

/**
 * Cap what the browser sends: bitrate and frame rate for the chosen quality,
 * and what to give up first when the connection is slow.
 */
export async function applySendQuality(pc: RTCPeerConnection, prefs: Pick<LiveStudioPrefs, "quality" | "fps" | "priority">) {
  const sender = pc.getSenders().find((s) => s.track?.kind === "video");
  if (!sender) return;
  try {
    const params = sender.getParameters();
    if (!params.encodings?.length) params.encodings = [{}];
    params.encodings[0].maxBitrate = LIVE_QUALITY_SPEC[prefs.quality].maxBitrate;
    params.encodings[0].maxFramerate = prefs.fps;
    (params as RTCRtpSendParameters & { degradationPreference?: string }).degradationPreference =
      prefs.priority === "sharp" ? "maintain-resolution" : "maintain-framerate";
    await sender.setParameters(params);
  } catch {
    // Older browsers refuse some fields; their defaults apply.
  }
  if (sender.track) sender.track.contentHint = prefs.priority === "sharp" ? "detail" : "motion";
}

export interface LiveSendStats {
  kbps: number;
  fps: number;
  width: number;
  height: number;
  /** Round trip to the media server, ms; null until known. */
  rttMs: number | null;
  /** Share of packets lost lately, 0–1. */
  loss: number;
  /** Why the browser is sending less than asked: "bandwidth", "cpu" or "none". */
  limitedBy: string;
}

/** Reads the outgoing video's stats; call every couple of seconds. */
export function createStatsReader(pc: RTCPeerConnection) {
  let lastBytes = 0;
  let lastAt = 0;
  return async (): Promise<LiveSendStats | null> => {
    const report = await pc.getStats();
    let out: Record<string, unknown> | null = null;
    let remote: Record<string, unknown> | null = null;
    report.forEach((entry) => {
      const e = entry as Record<string, unknown>;
      if (e.type === "outbound-rtp" && e.kind === "video") out = e;
      if (e.type === "remote-inbound-rtp" && e.kind === "video") remote = e;
    });
    if (!out) return null;
    const o = out as Record<string, number | string | undefined>;
    const r = remote as Record<string, number | undefined> | null;
    const bytes = Number(o.bytesSent) || 0;
    const at = Number(o.timestamp) || Date.now();
    const kbps = lastAt && at > lastAt ? Math.max(0, ((bytes - lastBytes) * 8) / (at - lastAt)) : 0;
    lastBytes = bytes;
    lastAt = at;
    return {
      kbps: Math.round(kbps),
      fps: Math.round(Number(o.framesPerSecond) || 0),
      width: Number(o.frameWidth) || 0,
      height: Number(o.frameHeight) || 0,
      rttMs: r && typeof r.roundTripTime === "number" ? Math.round(r.roundTripTime * 1000) : null,
      loss: r && typeof r.fractionLost === "number" ? r.fractionLost : 0,
      limitedBy: String(o.qualityLimitationReason || "none"),
    };
  };
}
