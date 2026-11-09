"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowLeft,
  Camera,
  CameraOff,
  CheckCircle2,
  Copy,
  ExternalLink,
  Eye,
  Gift,
  Heart,
  Loader2,
  Mic,
  MicOff,
  Pencil,
  Pin,
  PinOff,
  Radio,
  Send,
  SwitchCamera,
  Square,
  Timer,
  XCircle,
} from "lucide-react";
import Link from "@/components/language/link";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast-notification";
import { useConfirmation } from "@/components/ui/confirmation-dialog";
import { publishWhip, type WebRtcSession } from "@/lib/live/webrtc-client";
import {
  LIVE_LIMITS,
  type LiveChatItem,
  type LiveDashboardItem,
  type LiveStudioCredentials,
} from "@/lib/live/live-types";
import {
  DEFAULT_STUDIO_PREFS,
  LIVE_QUALITY_SPEC,
  applySendQuality,
  createStatsReader,
  loadStudioPrefs,
  saveStudioPrefs,
  type LiveSendStats,
  type LiveStudioPrefs,
} from "@/lib/live/studio-prefs";
import { useLiveRoom } from "./use-live-room";
import { LiveChatList, LiveProductRow, useFloatingHearts } from "./live-ui";
import { LiveEditorDialog } from "./live-editor-dialog";
import { LiveSupporters, useGiftShow } from "./live-gifts-ui";
import { LiveSourceOverlay } from "./live-source-overlay";
import { LiveStudioPanel, type StudioTab } from "./live-studio-panel";
import { canPickSpeaker, useLiveAudio } from "./use-live-audio";
import { useLiveEffects } from "./use-live-effects";
import { useLiveSources } from "./use-live-sources";
import { useMediaDevices } from "./use-media-devices";
import { cn } from "@/lib/utils";

type Detail = LiveDashboardItem & { credentials: LiveStudioCredentials };
type Publish = "idle" | "connecting" | "publishing" | "failed";

function useElapsed(since: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!since) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [since]);
  if (!since) return "00:00";
  const s = Math.max(0, Math.floor((now - new Date(since).getTime()) / 1000));
  const pad = (n: number) => String(n).padStart(2, "0");
  return s >= 3600 ? `${Math.floor(s / 3600)}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}` : `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
}

function stopAll(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

/** The store's control room for one live. */
export function LiveStudio({ liveId }: { liveId: string }) {
  const t = useTranslations("live");
  const ts = useTranslations("live.studio");
  const locale = useLocale();
  const { confirm } = useConfirmation();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [prefs, setPrefs] = useState<LiveStudioPrefs>(() =>
    typeof window === "undefined" ? { ...DEFAULT_STUDIO_PREFS } : loadStudioPrefs(),
  );
  const [camStream, setCamStream] = useState<MediaStream | null>(null);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [activeCameraId, setActiveCameraId] = useState("");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [monitor, setMonitor] = useState(false);
  const [publish, setPublish] = useState<Publish>("idle");
  const [busy, setBusy] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [stats, setStats] = useState<LiveSendStats | null>(null);
  const [micHeard, setMicHeard] = useState(false);
  const [studioTab, setStudioTab] = useState<StudioTab>("look");
  const [text, setText] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const previewRef = useRef<HTMLVideoElement>(null);
  const sessionRef = useRef<WebRtcSession | null>(null);
  const streamsRef = useRef<{ cam: MediaStream | null; mic: MediaStream | null }>({ cam: null, mic: null });
  const hearts = useFloatingHearts();

  const updatePrefs = useCallback((patch: Partial<LiveStudioPrefs>) => setPrefs((p) => ({ ...p, ...patch })), []);
  useEffect(() => saveStudioPrefs(prefs), [prefs]);

  // The picture viewers get: the camera with beauty, effects and sources…
  const quality = LIVE_QUALITY_SPEC[prefs.quality];
  const effects = useLiveEffects(camStream, {
    width: quality.width,
    height: quality.height,
    fps: prefs.fps,
    zoom: prefs.zoom,
  });
  const sources = useLiveSources(effects.processor);
  // …and the sound, through its level control.
  const audio = useLiveAudio(micStream, { gain: prefs.micGain, monitor, outputId: prefs.outputId });
  const devices = useMediaDevices();
  const media = useMemo(
    () => (effects.video ? new MediaStream([effects.video, ...(audio.track ? [audio.track] : [])]) : null),
    [effects.video, audio.track],
  );

  useEffect(() => {
    streamsRef.current = { cam: camStream, mic: micStream };
  }, [camStream, micStream]);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/vendor/live/${liveId}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error();
      setDetail(json.data as Detail);
    } catch {
      setLoadError(true);
    }
  }, [liveId]);
  useEffect(() => {
    void load();
  }, [load]);

  const room = useLiveRoom({
    endpoint: `/api/vendor/live/${liveId}/state`,
    initialStatus: detail?.status ?? "scheduled",
    countViewer: false,
  });

  const { chime } = audio;
  const giftSound = prefs.giftSound;
  const gifts = useGiftShow(
    room.messages,
    useCallback(() => {
      if (giftSound) chime();
    }, [giftSound, chime]),
  );
  const { remoteHearts, consumeRemoteHearts } = room;
  useEffect(() => {
    if (remoteHearts > 0) {
      hearts.burst(remoteHearts);
      consumeRemoteHearts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteHearts]);

  const status = room.status === "scheduled" && detail?.status ? detail.status : room.status;
  const isLive = status === "live";

  /* Camera & microphone ------------------------------------------------ */

  const videoConstraints = useCallback(
    (opts: { deviceId?: string; facingMode?: "user" | "environment" }): MediaTrackConstraints => ({
      ...(opts.deviceId ? { deviceId: { exact: opts.deviceId } } : { facingMode: opts.facingMode ?? "user" }),
      width: { ideal: quality.camera.width },
      height: { ideal: quality.camera.height },
      frameRate: { ideal: prefs.fps },
    }),
    [quality.camera.width, quality.camera.height, prefs.fps],
  );

  const audioConstraints = useCallback(
    (): MediaTrackConstraints => ({
      ...(prefs.micId ? { deviceId: { ideal: prefs.micId } } : {}),
      echoCancellation: prefs.echoCancellation,
      noiseSuppression: prefs.noiseSuppression,
      autoGainControl: prefs.autoGain,
    }),
    [prefs.micId, prefs.echoCancellation, prefs.noiseSuppression, prefs.autoGain],
  );

  const supported = () => {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setCameraError(t("secureContext"));
      return false;
    }
    return true;
  };

  const takeCamera = useCallback((next: MediaStream) => {
    const track = next.getVideoTracks()[0];
    setActiveCameraId(track?.getSettings().deviceId ?? "");
    setCamStream((old) => {
      if (old !== next) stopAll(old);
      return next;
    });
  }, []);

  const takeMic = useCallback((next: MediaStream | null) => {
    setMicStream((old) => {
      if (old !== next) stopAll(old);
      return next;
    });
  }, []);

  /** First start: one prompt for both, then each is handled on its own. */
  const enableCamera = async () => {
    setCameraError(null);
    if (!supported()) return;
    const video = videoConstraints(prefs.cameraId ? { deviceId: prefs.cameraId } : { facingMode: facing });
    // A remembered camera that is gone falls back to any camera.
    if (prefs.cameraId) video.deviceId = { ideal: prefs.cameraId };
    try {
      let both: MediaStream;
      try {
        both = await navigator.mediaDevices.getUserMedia({ video, audio: audioConstraints() });
      } catch {
        both = await navigator.mediaDevices.getUserMedia({ video });
        toast.error(ts("noMic"));
      }
      takeCamera(new MediaStream(both.getVideoTracks()));
      takeMic(both.getAudioTracks().length ? new MediaStream(both.getAudioTracks()) : null);
      audio.wake();
      void devices.refresh();
    } catch {
      setCameraError(t("cameraError"));
    }
  };

  const openVideo = useCallback(
    async (opts: { deviceId?: string; facingMode?: "user" | "environment" }) => {
      try {
        const next = await navigator.mediaDevices.getUserMedia({ video: videoConstraints(opts) });
        takeCamera(next);
        return true;
      } catch {
        toast.error(t("cameraError"));
        return false;
      }
    },
    [videoConstraints, takeCamera, t],
  );

  const pickCamera = async (deviceId: string) => {
    if (await openVideo({ deviceId })) updatePrefs({ cameraId: deviceId });
  };
  const flip = async () => {
    const nextFacing = facing === "user" ? "environment" : "user";
    setFacing(nextFacing);
    if (await openVideo({ facingMode: nextFacing })) updatePrefs({ cameraId: "" });
  };

  // A different microphone or clean-up setting: reopen the microphone.
  const micKey = `${prefs.micId}|${prefs.echoCancellation}|${prefs.noiseSuppression}|${prefs.autoGain}`;
  const appliedMicKey = useRef(micKey);
  useEffect(() => {
    if (!streamsRef.current.cam || appliedMicKey.current === micKey) return;
    appliedMicKey.current = micKey;
    let cancelled = false;
    void navigator.mediaDevices
      .getUserMedia({ audio: audioConstraints() })
      .then((next) => {
        if (cancelled) stopAll(next);
        else takeMic(next);
      })
      .catch(() => toast.error(ts("noMic")));
    return () => {
      cancelled = true;
    };
  }, [micKey, audioConstraints, takeMic, ts]);

  // A different quality before going live: ask the camera for the matching size.
  const camKey = `${prefs.quality}|${prefs.fps}`;
  const appliedCamKey = useRef(camKey);
  useEffect(() => {
    if (!streamsRef.current.cam || appliedCamKey.current === camKey || isLive) return;
    appliedCamKey.current = camKey;
    void openVideo(activeCameraId ? { deviceId: activeCameraId } : { facingMode: facing });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camKey]);

  useEffect(() => {
    if (previewRef.current && media) previewRef.current.srcObject = media;
  }, [media]);

  // Live: send the current picture and sound without renegotiating (a new
  // camera or microphone, or the effects starting up).
  useEffect(() => {
    if (!media) return;
    media.getVideoTracks().forEach((tr) => (tr.enabled = camOn));
    media.getAudioTracks().forEach((tr) => (tr.enabled = micOn));
    const pc = sessionRef.current?.pc;
    if (!pc) return;
    for (const sender of pc.getSenders()) {
      const kind = sender.track?.kind;
      const track = kind ? media.getTracks().find((tr) => tr.kind === kind) : undefined;
      if (track && sender.track !== track) void sender.replaceTrack(track).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [media]);

  // Has the microphone picked anything up yet (for the readiness check)?
  useEffect(() => {
    if (audio.level > 0.04 && !micHeard) setMicHeard(true);
  }, [audio.level, micHeard]);

  // Stop the camera and microphone when leaving the page.
  useEffect(
    () => () => {
      void sessionRef.current?.close();
      stopAll(streamsRef.current.cam);
      stopAll(streamsRef.current.mic);
    },
    [],
  );

  const toggleMic = () => {
    const on = !micOn;
    setMicOn(on);
    media?.getAudioTracks().forEach((tr) => (tr.enabled = on));
  };
  const toggleCam = () => {
    const on = !camOn;
    setCamOn(on);
    camStream?.getVideoTracks().forEach((tr) => (tr.enabled = on));
    media?.getVideoTracks().forEach((tr) => (tr.enabled = on));
  };

  /* Publishing --------------------------------------------------------- */

  const startPublishing = useCallback(
    async (media: MediaStream, credentials: LiveStudioCredentials) => {
      setPublish("connecting");
      try {
        await sessionRef.current?.close();
        const session = await publishWhip(credentials.whipUrl, credentials.streamKey, media);
        sessionRef.current = session;
        const update = () => {
          const state = session.pc.connectionState;
          if (state === "connected") setPublish("publishing");
          else if (state === "failed" || state === "closed") setPublish("failed");
        };
        session.pc.addEventListener("connectionstatechange", update);
        update();
      } catch {
        setPublish("failed");
        toast.error(t("publishFailed"));
      }
    },
    [t],
  );

  // Bitrate, frame rate and what to give up on a slow connection.
  useEffect(() => {
    const pc = sessionRef.current?.pc;
    if (publish !== "publishing" || !pc) return;
    void applySendQuality(pc, prefs);
  }, [publish, prefs.quality, prefs.fps, prefs.priority, media]); // eslint-disable-line react-hooks/exhaustive-deps

  // How the stream is getting out, every two seconds while on air.
  useEffect(() => {
    const pc = sessionRef.current?.pc;
    if (publish !== "publishing" || !pc) return;
    const read = createStatsReader(pc);
    const id = setInterval(() => {
      void read()
        .then(setStats)
        .catch(() => {});
    }, 2000);
    return () => {
      clearInterval(id);
      setStats(null);
    };
  }, [publish]);

  const goLive = async () => {
    if (!detail) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/vendor/live/${liveId}/start`, { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.message || t("actionFailed"));
      setDetail((d) => (d ? { ...d, ...(json.data as LiveDashboardItem) } : d));
      if (media) await startPublishing(media, detail.credentials);
      void room.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("actionFailed"));
    } finally {
      setBusy(false);
    }
  };

  const startClicked = () => {
    audio.wake();
    if (prefs.countdown) setCountdown(3);
    else void goLive();
  };

  // 3-2-1, then on air. Tapping the number cancels.
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      setCountdown(null);
      void goLive();
      return;
    }
    const id = setTimeout(() => setCountdown((n) => (n === null ? null : n - 1)), 1000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown]);

  // Back on the page of a live that is already on air: resume sending.
  useEffect(() => {
    if (detail?.status === "live" && media && publish === "idle") {
      void startPublishing(media, detail.credentials);
    }
  }, [detail?.status, detail?.credentials, media, publish, startPublishing]);

  const endLive = async () => {
    const ok = await confirm({
      title: t("endTitle"),
      description: t("endDescription"),
      confirmText: t("endLive"),
      variant: "destructive",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/vendor/live/${liveId}/end`, { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.message || t("actionFailed"));
      await sessionRef.current?.close();
      sessionRef.current = null;
      setPublish("idle");
      setDetail((d) => (d ? { ...d, ...(json.data as LiveDashboardItem) } : d));
      toast.success(t("ended"));
      void room.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("actionFailed"));
    } finally {
      setBusy(false);
    }
  };

  /* Products & chat ----------------------------------------------------- */

  const pin = async (productId: string | null) => {
    room.setPinned(productId);
    try {
      const res = await fetch(`/api/vendor/live/${liveId}/pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      });
      if (!res.ok) throw new Error();
      void room.refresh();
    } catch {
      toast.error(t("actionFailed"));
      void room.refresh();
    }
  };

  const send = async () => {
    const message = text.trim();
    if (!message) return;
    try {
      const res = await fetch(`/api/live/${liveId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: message }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.message || t("actionFailed"));
      room.addMessage(json.data as LiveChatItem);
      setText("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("actionFailed"));
    }
  };

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(t("copied"));
    } catch {
      // Clipboard refused; the value is on screen to select.
    }
  };

  const elapsed = useElapsed(status === "live" ? detail?.startedAt ?? null : null);

  if (loadError) {
    return (
      <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
        {t("loadFailed")}
      </div>
    );
  }
  if (!detail) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const onAirBadge =
    status === "live" && (publish === "publishing" || room.onAir) ? (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-2 py-1 text-xs font-bold text-white shadow">
        <span className="size-1.5 animate-pulse rounded-full bg-white" />
        {t("onAir")}
      </span>
    ) : status === "live" ? (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-400 px-2 py-1 text-xs font-bold text-slate-900">
        <Loader2 className="size-3 animate-spin" />
        {publish === "connecting" ? t("connecting") : t("waitingSignal")}
      </span>
    ) : (
      <span className="rounded-md bg-black/50 px-2 py-1 text-xs font-semibold text-white">{t("offAir")}</span>
    );

  return (
    <div className="space-y-4 pb-8">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/vendor/live">
            <ArrowLeft className="size-4" />
            {t("backToList")}
          </Link>
        </Button>
        <h1 className="min-w-0 flex-1 truncate text-xl font-bold">{detail.title}</h1>
        {status === "live" ? (
          <Button asChild variant="outline" size="sm">
            <Link href={`/live/${liveId}`} target="_blank">
              <ExternalLink className="size-4" />
              {t("watchPage")}
            </Link>
          </Button>
        ) : null}
        {status !== "ended" ? (
          <Button variant="outline" size="sm" onClick={() => setEditorOpen(true)}>
            <Pencil className="size-4" />
            {t("edit")}
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] 2xl:grid-cols-[400px_minmax(0,1fr)_380px]">
        {/* Camera */}
        {/* The preview stays in view while the settings beside it scroll. */}
        <section className="space-y-3 lg:sticky lg:top-20 lg:row-span-2 lg:self-start 2xl:row-span-1">
          <div className="relative mx-auto aspect-9/16 max-h-[72vh] w-full overflow-hidden rounded-3xl bg-slate-950 shadow-xl">
            {camStream ? (
              <video
                ref={previewRef}
                autoPlay
                playsInline
                muted
                className={cn(
                  "size-full object-cover",
                  // With effects the preview is exactly what viewers get; plain, it mirrors like a selfie.
                  !effects.active && facing === "user" && "-scale-x-100",
                  !camOn && "opacity-0",
                )}
              />
            ) : (
              <div className="flex size-full flex-col items-center justify-center gap-3 p-6 text-center text-white">
                <Camera className="size-10 text-white/70" />
                {cameraError ? <p className="text-sm text-amber-200">{cameraError}</p> : null}
                {status !== "ended" ? (
                  <Button onClick={() => void enableCamera()} className="bg-white text-slate-900 hover:bg-white/90">
                    <Camera className="size-4" />
                    {t("enableCamera")}
                  </Button>
                ) : null}
              </div>
            )}
            <div className="absolute inset-x-3 top-3 flex items-center justify-between">
              {onAirBadge}
              {status === "live" ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-black/50 px-2 py-1 font-mono text-xs text-white">
                  <Timer className="size-3.5" />
                  {elapsed}
                </span>
              ) : null}
            </div>
            {hearts.layer}
            {gifts.layer}
            {sources.sources.length && studioTab === "sources" && effects.active && status !== "ended" ? (
              <LiveSourceOverlay
                sources={sources.sources}
                selectedId={sources.selectedId}
                onSelect={sources.select}
                onChange={sources.update}
              />
            ) : null}
            {countdown !== null ? (
              <button
                type="button"
                onClick={() => setCountdown(null)}
                aria-label={ts("cancelCountdown")}
                className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/45 text-white backdrop-blur-[2px]"
              >
                <span key={countdown} className="live-countdown text-[7rem] font-black leading-none drop-shadow-xl">
                  {countdown}
                </span>
                <span className="mt-3 text-xs text-white/80">{ts("cancelCountdown")}</span>
              </button>
            ) : null}
            {camStream && !media ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="size-6 animate-spin text-white/70" />
              </div>
            ) : null}
            {camStream && !(studioTab === "sources" && sources.sources.length) ? (
              <div className="absolute inset-x-0 bottom-3 z-10 flex justify-center gap-2">
                <CircleButton label={micOn ? t("micOn") : t("micOff")} onClick={toggleMic} off={!micOn}>
                  {micOn ? <Mic className="size-5" /> : <MicOff className="size-5" />}
                </CircleButton>
                <CircleButton label={camOn ? t("camOn") : t("camOff")} onClick={toggleCam} off={!camOn}>
                  {camOn ? <Camera className="size-5" /> : <CameraOff className="size-5" />}
                </CircleButton>
                <CircleButton label={t("flip")} onClick={() => void flip()}>
                  <SwitchCamera className="size-5" />
                </CircleButton>
              </div>
            ) : null}
          </div>

          {camStream && status === "scheduled" ? (
            <div className="flex flex-wrap gap-1.5 text-[11px]" aria-label={ts("readiness")}>
              <Ready ok={camOn} label={camOn ? ts("readyCamera") : ts("cameraOff")} />
              <Ready ok={Boolean(micStream) && micOn && micHeard} label={!micStream ? ts("noMicShort") : !micOn ? ts("micMuted") : micHeard ? ts("readyMic") : ts("micSilent")} />
              <Ready ok label={`${prefs.quality}p · ${prefs.fps} fps`} />
              {sources.sources.length ? <Ready ok label={ts("readySources", { count: sources.sources.filter((x) => x.visible).length })} /> : null}
            </div>
          ) : null}

          {status === "live" ? (
            <Button
              onClick={() => void endLive()}
              disabled={busy}
              variant="outline"
              className="h-12 w-full rounded-2xl border-red-300 text-base font-semibold text-red-600 hover:bg-red-50"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Square className="size-4 fill-current" />}
              {t("endLive")}
            </Button>
          ) : status === "scheduled" ? (
            <Button
              onClick={startClicked}
              disabled={busy || countdown !== null}
              className="h-12 w-full rounded-2xl bg-linear-to-r from-red-500 to-pink-600 text-base font-bold text-white shadow-lg shadow-rose-500/30"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Radio className="size-5" />}
              {t("startLive")}
            </Button>
          ) : (
            <p className="rounded-2xl bg-muted p-3 text-center text-sm font-medium">{t("endedTitle")}</p>
          )}



          {publish === "failed" && media && status === "live" ? (
            <Button variant="outline" className="w-full" onClick={() => void startPublishing(media, detail.credentials)}>
              {t("publishFailed")} — {t("connecting")}
            </Button>
          ) : null}

          {status !== "ended" ? (
            <details className="rounded-2xl border bg-card p-4 text-sm">
              <summary className="cursor-pointer font-semibold">{t("obsTitle")}</summary>
              <p className="mt-2 text-xs text-muted-foreground">{t("obsHint")}</p>
              {[
                [t("obsServer"), detail.credentials.whipUrl],
                [t("obsKey"), detail.credentials.streamKey],
              ].map(([label, value]) => (
                <div key={label} className="mt-3">
                  <p className="text-xs font-medium text-muted-foreground">{label}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="min-w-0 flex-1 truncate rounded-lg bg-muted px-2 py-1.5 text-xs">{value}</code>
                    <Button size="icon" variant="outline" className="size-8 shrink-0" onClick={() => void copy(value)} aria-label={t("copy")}>
                      <Copy className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
              <p className="mt-2 text-[11px] text-amber-700">{t("keySecret")}</p>
            </details>
          ) : null}
        </section>

        {/* Studio settings, then products */}
        <div className="min-w-0 space-y-4">
          {camStream && status !== "ended" ? (
            <LiveStudioPanel
              tab={studioTab}
              onTab={setStudioTab}
              effects={effects}
              sources={sources}
              effectsSupported={effects.supported}
              devices={devices}
              prefs={prefs}
              onPrefs={updatePrefs}
              camera={{ activeId: activeCameraId, onPick: (id) => void pickCamera(id), onFlip: () => void flip() }}
              micLevel={audio.level}
              speakerSupported={canPickSpeaker()}
              monitor={monitor}
              onMonitor={setMonitor}
              onTestSpeaker={() => {
                audio.wake();
                audio.testSpeaker();
              }}
              live={isLive}
              stats={stats}
            />
          ) : null}
        <section className="rounded-3xl border bg-card p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <h2 className="font-semibold">{t("productsInLive")}</h2>
            <div className="ms-auto flex items-center gap-2 text-sm">
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1">
                <Eye className="size-4 text-sky-600" />
                {room.viewers.toLocaleString(locale)}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1">
                <Heart className="size-4 fill-rose-500 text-rose-500" />
                {room.likeCount.toLocaleString(locale)}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1" title={t("gifts.received")}>
                <Gift className="size-4 text-amber-500" />
                {room.giftCount.toLocaleString(locale)}
              </span>
            </div>
          </div>
          {room.products.length === 0 ? (
            <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              {t("noProductsAdded")}
            </p>
          ) : (
            <div className="space-y-2">
              {room.products.map((product, i) => {
                const isPinned = product.id === room.pinnedProductId;
                return (
                  <div key={product.id} className={cn("rounded-2xl", isPinned && "ring-2 ring-rose-500")}>
                    <LiveProductRow
                      product={product}
                      status={status}
                      index={i + 1}
                      action={
                        <Button
                          size="sm"
                          variant={isPinned ? "default" : "outline"}
                          className={cn("shrink-0", isPinned && "bg-rose-600 hover:bg-rose-700")}
                          onClick={() => void pin(isPinned ? null : product.id)}
                          disabled={status === "ended"}
                        >
                          {isPinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
                          {isPinned ? t("unpin") : t("pin")}
                        </Button>
                      }
                    />
                  </div>
                );
              })}
            </div>
          )}
        </section>
        </div>

        {/* Chat */}
        <section className="flex h-[60vh] flex-col rounded-3xl border bg-card p-4 shadow-sm lg:col-start-2 lg:h-[420px] 2xl:col-start-auto 2xl:row-start-1 2xl:col-start-3 2xl:h-auto 2xl:max-h-[80vh]">
          <h2 className="mb-2 font-semibold">{t("chatTitle")}</h2>
          <LiveSupporters supporters={room.supporters} variant="panel" className="mb-3" />
          <LiveChatList messages={room.messages} variant="panel" className="min-h-0 flex-1" />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
            className="mt-3 flex items-center gap-2"
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={LIVE_LIMITS.chatText}
              disabled={status !== "live"}
              placeholder={t("chatPlaceholder")}
              className="h-10 min-w-0 flex-1 rounded-full border bg-background px-4 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
            />
            <Button type="submit" size="icon" disabled={!text.trim() || status !== "live"} className="rounded-full bg-rose-600 hover:bg-rose-700" aria-label={t("send")}>
              <Send className="size-4" />
            </Button>
          </form>
        </section>
      </div>

      <LiveEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        live={detail}
        onSaved={(saved) => {
          setDetail((d) => (d ? { ...d, ...saved } : d));
          void room.refresh();
        }}
      />
    </div>
  );
}

function Ready({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-1 font-medium",
        ok ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300" : "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300",
      )}
    >
      {ok ? <CheckCircle2 className="size-3.5" /> : <XCircle className="size-3.5" />}
      {label}
    </span>
  );
}

function CircleButton({
  children,
  label,
  onClick,
  off = false,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  off?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "flex size-11 items-center justify-center rounded-full text-white backdrop-blur transition-transform active:scale-90",
        off ? "bg-red-600" : "bg-black/45 hover:bg-black/60",
      )}
    >
      {children}
    </button>
  );
}
