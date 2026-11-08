"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowLeft,
  Camera,
  CameraOff,
  Copy,
  ExternalLink,
  Eye,
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
import { useLiveRoom } from "./use-live-room";
import { LiveChatList, LiveProductRow, useFloatingHearts } from "./live-ui";
import { LiveEditorDialog } from "./live-editor-dialog";
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

/** The store's control room for one live. */
export function LiveStudio({ liveId }: { liveId: string }) {
  const t = useTranslations("live");
  const locale = useLocale();
  const { confirm } = useConfirmation();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [cameraId, setCameraId] = useState<string>("");
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [publish, setPublish] = useState<Publish>("idle");
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const previewRef = useRef<HTMLVideoElement>(null);
  const sessionRef = useRef<WebRtcSession | null>(null);
  const hearts = useFloatingHearts();

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

  const { remoteHearts, consumeRemoteHearts } = room;
  useEffect(() => {
    if (remoteHearts > 0) {
      hearts.burst(remoteHearts);
      consumeRemoteHearts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteHearts]);

  /* Camera ------------------------------------------------------------ */

  const openCamera = useCallback(
    async (opts: { deviceId?: string; facingMode?: "user" | "environment" } = {}) => {
      setCameraError(null);
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setCameraError(t("secureContext"));
        return null;
      }
      try {
        const next = await navigator.mediaDevices.getUserMedia({
          video: {
            ...(opts.deviceId ? { deviceId: { exact: opts.deviceId } } : { facingMode: opts.facingMode ?? "user" }),
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 },
          },
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        const list = await navigator.mediaDevices.enumerateDevices();
        setDevices(list.filter((d) => d.kind === "videoinput"));
        const track = next.getVideoTracks()[0];
        setCameraId(track?.getSettings().deviceId ?? "");
        return next;
      } catch {
        setCameraError(t("cameraError"));
        return null;
      }
    },
    [t],
  );

  const replaceStream = useCallback(
    async (next: MediaStream) => {
      // Live: swap the tracks the server is receiving without renegotiating.
      const pc = sessionRef.current?.pc;
      if (pc) {
        for (const sender of pc.getSenders()) {
          const kind = sender.track?.kind;
          const track = kind ? next.getTracks().find((tr) => tr.kind === kind) : undefined;
          if (track) await sender.replaceTrack(track);
        }
      }
      setStream((old) => {
        old?.getTracks().forEach((tr) => {
          if (!next.getTracks().includes(tr)) tr.stop();
        });
        return next;
      });
      next.getAudioTracks().forEach((tr) => (tr.enabled = micOn));
      next.getVideoTracks().forEach((tr) => (tr.enabled = camOn));
    },
    [micOn, camOn],
  );

  const enableCamera = async () => {
    const next = await openCamera({ facingMode: facing });
    if (next) await replaceStream(next);
  };

  useEffect(() => {
    if (previewRef.current && stream) previewRef.current.srcObject = stream;
  }, [stream]);

  // Stop the camera when leaving the page.
  useEffect(
    () => () => {
      void sessionRef.current?.close();
      setStream((old) => {
        old?.getTracks().forEach((tr) => tr.stop());
        return null;
      });
    },
    [],
  );

  const chooseCamera = async (deviceId: string) => {
    const next = await openCamera({ deviceId });
    if (next) await replaceStream(next);
  };
  const flip = async () => {
    const nextFacing = facing === "user" ? "environment" : "user";
    setFacing(nextFacing);
    const next = await openCamera({ facingMode: nextFacing });
    if (next) await replaceStream(next);
  };
  const toggleMic = () => {
    const on = !micOn;
    setMicOn(on);
    stream?.getAudioTracks().forEach((tr) => (tr.enabled = on));
  };
  const toggleCam = () => {
    const on = !camOn;
    setCamOn(on);
    stream?.getVideoTracks().forEach((tr) => (tr.enabled = on));
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

  const goLive = async () => {
    if (!detail) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/vendor/live/${liveId}/start`, { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.message || t("actionFailed"));
      setDetail((d) => (d ? { ...d, ...(json.data as LiveDashboardItem) } : d));
      if (stream) await startPublishing(stream, detail.credentials);
      void room.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("actionFailed"));
    } finally {
      setBusy(false);
    }
  };

  // Back on the page of a live that is already on air: resume sending.
  useEffect(() => {
    if (detail?.status === "live" && stream && publish === "idle") {
      void startPublishing(stream, detail.credentials);
    }
  }, [detail?.status, detail?.credentials, stream, publish, startPublishing]);

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

  const status = room.status === "scheduled" && detail?.status ? detail.status : room.status;
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
        <section className="space-y-3 lg:row-span-2 2xl:row-span-1">
          <div className="relative mx-auto aspect-9/16 max-h-[72vh] w-full overflow-hidden rounded-3xl bg-slate-950 shadow-xl">
            {stream ? (
              <video
                ref={previewRef}
                autoPlay
                playsInline
                muted
                className={cn("size-full object-cover", facing === "user" && "-scale-x-100", !camOn && "opacity-0")}
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
            {stream ? (
              <div className="absolute inset-x-0 bottom-3 flex justify-center gap-2">
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

          {devices.length > 1 ? (
            <label className="flex items-center gap-2 text-sm">
              <Camera className="size-4 text-muted-foreground" />
              <select
                value={cameraId}
                onChange={(e) => void chooseCamera(e.target.value)}
                className="h-9 min-w-0 flex-1 rounded-lg border bg-background px-2 text-sm"
              >
                {devices.map((d, i) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `${t("camera")} ${i + 1}`}
                  </option>
                ))}
              </select>
            </label>
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
              onClick={() => void goLive()}
              disabled={busy}
              className="h-12 w-full rounded-2xl bg-linear-to-r from-red-500 to-pink-600 text-base font-bold text-white shadow-lg shadow-rose-500/30"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Radio className="size-5" />}
              {t("startLive")}
            </Button>
          ) : (
            <p className="rounded-2xl bg-muted p-3 text-center text-sm font-medium">{t("endedTitle")}</p>
          )}

          {publish === "failed" && stream && status === "live" ? (
            <Button variant="outline" className="w-full" onClick={() => void startPublishing(stream, detail.credentials)}>
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

        {/* Products */}
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

        {/* Chat */}
        <section className="flex h-[60vh] flex-col rounded-3xl border bg-card p-4 shadow-sm lg:col-start-2 lg:h-[420px] 2xl:col-start-auto 2xl:row-start-1 2xl:col-start-3 2xl:h-auto 2xl:max-h-[80vh]">
          <h2 className="mb-2 font-semibold">{t("chatTitle")}</h2>
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
