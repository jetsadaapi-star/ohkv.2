"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  BadgeCheck,
  CalendarClock,
  Eye,
  Gift,
  Heart,
  Loader2,
  MapPin,
  Radio,
  Send,
  Share2,
  ShoppingBag,
  Store,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import Link from "@/components/language/link";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "@/components/ui/toast-notification";
import { useSession } from "@/lib/auth/auth-client";
import { kalasinDistrictLabel } from "@/config/kalasin-districts";
import { playWhep, type WebRtcSession } from "@/lib/live/webrtc-client";
import { LIVE_LIMITS, type LiveChatItem, type LiveRoom } from "@/lib/live/live-types";
import { useLiveRoom } from "./use-live-room";
import { EMBEDDED_CHECKOUT_OPEN, EmbeddedCheckoutProvider } from "@/components/checkout/embedded-checkout";
import { LiveChatList, LiveProductRow, useFloatingHearts } from "./live-ui";
import { LiveGiftSheet, LiveSupporters, useGiftShow } from "./live-gifts-ui";
import { cn } from "@/lib/utils";

/** The shopper's live room: the stream, chat, hearts, the pinned product and the bag. */
export function LiveRoomView({ room }: { room: LiveRoom }) {
  // Buying opens checkout over the room, so the stream keeps playing.
  return (
    <EmbeddedCheckoutProvider>
      <LiveRoom room={room} />
    </EmbeddedCheckoutProvider>
  );
}

function LiveRoom({ room }: { room: LiveRoom }) {
  const t = useTranslations("live");
  const locale = useLocale();
  const { data: session } = useSession();
  const live = useLiveRoom({
    endpoint: `/api/live/${room.id}/state`,
    initialStatus: room.status,
    initialProducts: room.products,
    initialPinned: room.pinnedProductId,
    initialLikes: room.likeCount,
    initialViewers: room.viewers,
  });
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [bagOpen, setBagOpen] = useState(false);
  const [giftOpen, setGiftOpen] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const hearts = useFloatingHearts();
  const gifts = useGiftShow(live.messages);
  const pendingLikes = useRef(0);

  // Checkout opening over the room closes the product bag.
  useEffect(() => {
    const closeBag = () => {
      setBagOpen(false);
      setGiftOpen(false);
    };
    window.addEventListener(EMBEDDED_CHECKOUT_OPEN, closeBag);
    return () => window.removeEventListener(EMBEDDED_CHECKOUT_OPEN, closeBag);
  }, []);

  // Play while the store is on air; reconnect if the stream drops.
  const shouldPlay = live.status === "live" && live.onAir;
  useEffect(() => {
    if (!shouldPlay) return;
    let session: WebRtcSession | null = null;
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | null = null;
    const connect = async () => {
      const video = videoRef.current;
      if (!video || cancelled) return;
      try {
        session = await playWhep(room.whepUrl, video);
        session.pc.addEventListener("connectionstatechange", () => {
          const state = session?.pc.connectionState;
          if (state === "failed" || state === "disconnected" || state === "closed") {
            setPlaying(false);
            if (!cancelled) retry = setTimeout(() => void reconnect(), 2000);
          }
        });
        video.muted = muted;
        await video.play().catch(() => {});
        setPlaying(true);
      } catch {
        setPlaying(false);
        if (!cancelled) retry = setTimeout(() => void reconnect(), 3000);
      }
    };
    const reconnect = async () => {
      await session?.close();
      session = null;
      await connect();
    };
    void connect();
    return () => {
      cancelled = true;
      if (retry) clearTimeout(retry);
      void session?.close();
      setPlaying(false);
    };
    // `muted` is applied directly below; reconnecting for it would drop the stream.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldPlay, room.whepUrl]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  // Hearts other viewers sent float up too.
  const { remoteHearts, consumeRemoteHearts } = live;
  useEffect(() => {
    if (remoteHearts > 0) {
      hearts.burst(remoteHearts);
      consumeRemoteHearts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteHearts]);

  // Taps are sent in batches.
  useEffect(() => {
    const timer = setInterval(() => {
      const n = pendingLikes.current;
      if (n <= 0) return;
      pendingLikes.current = 0;
      void fetch(`/api/live/${room.id}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: Math.min(n, LIVE_LIMITS.likeBatch) }),
      }).catch(() => {});
    }, 1200);
    return () => clearInterval(timer);
  }, [room.id]);

  const like = () => {
    if (live.status !== "live") return;
    pendingLikes.current += 1;
    live.noteOwnLikes(1);
    hearts.burst(1);
  };

  const send = async () => {
    const message = text.trim();
    if (!message || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/live/${room.id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: message }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.message || t("actionFailed"));
      live.addMessage(json.data as LiveChatItem);
      setText("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("actionFailed"));
    } finally {
      setSending(false);
    }
  };

  const share = async () => {
    const url = `${window.location.origin}/${locale}/live/${room.id}`;
    try {
      if (navigator.share) await navigator.share({ title: room.title, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success(t("linkCopied"));
      }
    } catch {
      // Closed the share sheet.
    }
  };

  const pinned = live.products.find((p) => p.id === live.pinnedProductId) ?? null;
  const district = room.store.district ? kalasinDistrictLabel(room.store.district, locale) : "";
  const formatTime = (value: string | null) =>
    value
      ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
      : "";

  return (
    <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[440px_minmax(0,1fr)] lg:items-start">
      {/* The player */}
      {/* Full screen on phones (like the clip feed apps); a tall card on desktop. */}
      <div className="fixed inset-0 z-[60] h-dvh w-full overflow-hidden bg-black lg:relative lg:inset-auto lg:z-auto lg:mx-auto lg:h-[calc(100dvh-12.5rem)] lg:max-h-[860px] lg:min-h-[560px] lg:max-w-[440px] lg:rounded-3xl lg:shadow-2xl">
        {/* Backdrop when there is no picture */}
        <div className="absolute inset-0">
          {room.coverUrl || room.productImages[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={room.coverUrl || room.productImages[0]}
              alt=""
              className="size-full scale-110 object-cover opacity-50 blur-2xl"
            />
          ) : null}
        </div>
        <video
          ref={videoRef}
          playsInline
          autoPlay
          muted={muted}
          className={cn("absolute inset-0 size-full object-cover transition-opacity", playing ? "opacity-100" : "opacity-0")}
        />

        {!playing ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-8 text-center text-white">
            {live.status === "live" ? (
              <>
                <Loader2 className="size-8 animate-spin text-white/80" />
                <p className="text-sm text-white/85">{live.onAir ? t("playerRetry") : t("waitingHost")}</p>
              </>
            ) : live.status === "scheduled" ? (
              <>
                <CalendarClock className="size-10 text-amber-300" />
                <p className="text-lg font-semibold">{t("notStarted")}</p>
                {room.scheduledAt ? (
                  <p className="text-sm text-white/80">{t("startsAt", { time: formatTime(room.scheduledAt) })}</p>
                ) : null}
              </>
            ) : (
              <>
                <Radio className="size-10 text-white/70" />
                <p className="text-lg font-semibold">{t("endedTitle")}</p>
                <p className="max-w-xs text-sm text-white/80">{t("endedHint")}</p>
                <Link
                  href="/live"
                  className="mt-2 rounded-full bg-white px-5 py-2 text-sm font-semibold text-slate-900"
                >
                  {t("moreLives")}
                </Link>
              </>
            )}
          </div>
        ) : null}

        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-linear-to-b from-black/60 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-linear-to-t from-black/80 via-black/30 to-transparent" />

        {/* Top bar */}
        <div className="absolute inset-x-3 top-3 flex items-start gap-2 text-white">
          <div className="flex min-w-0 items-center gap-2 rounded-full bg-black/35 p-1 pe-3 backdrop-blur">
            <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-linear-to-br from-rose-500 to-red-600 text-sm font-bold">
              {room.store.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={room.store.logo} alt="" className="size-full object-cover" />
              ) : (
                room.store.name.trim().charAt(0)
              )}
            </span>
            <span className="min-w-0">
              {room.store.hasPage ? (
                <Link
                  href={`/vendors/${room.store.slug}`}
                  className="pointer-events-auto flex items-center gap-1 truncate text-sm font-semibold"
                >
                  <span className="truncate">{room.store.name}</span>
                  <BadgeCheck className="size-3.5 shrink-0 text-sky-300" />
                </Link>
              ) : (
                <span className="flex items-center gap-1 truncate text-sm font-semibold">
                  <Store className="size-3.5" />
                  {room.store.name}
                </span>
              )}
              {district ? (
                <span className="flex items-center gap-0.5 text-[11px] text-white/75">
                  <MapPin className="size-3" />
                  {district}
                </span>
              ) : null}
            </span>
          </div>
          <div className="ms-auto flex items-center gap-1.5">
            {live.status === "live" ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-red-600 px-2 py-1 text-xs font-bold tracking-wide shadow">
                <span className="size-1.5 animate-pulse rounded-full bg-white" />
                {t("badgeLive")}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1 rounded-md bg-black/40 px-2 py-1 text-xs font-semibold backdrop-blur">
              <Eye className="size-3.5" />
              {live.viewers.toLocaleString(locale)}
            </span>
            <Link
              href="/live"
              aria-label={t("close")}
              className="flex size-8 items-center justify-center rounded-full bg-black/35 backdrop-blur"
            >
              <X className="size-4" />
            </Link>
          </div>
        </div>

        <div className="absolute inset-x-4 top-[4.25rem] flex items-center gap-2">
          <p className="line-clamp-1 min-w-0 flex-1 text-sm font-semibold text-white drop-shadow">{room.title}</p>
          <LiveSupporters supporters={live.supporters} variant="overlay" className="shrink-0" />
        </div>

        {playing && muted ? (
          <button
            type="button"
            onClick={() => setMuted(false)}
            className="absolute start-1/2 top-24 inline-flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-900 shadow"
          >
            <VolumeX className="size-4" />
            {t("tapToUnmute")}
          </button>
        ) : null}

        {hearts.layer}
        {gifts.layer}

        {/* Right rail */}
        <div className="absolute bottom-24 end-3 flex flex-col items-center gap-3 text-white">
          <RailButton label={muted ? t("tapToUnmute") : t("tapToUnmute")} onClick={() => setMuted((m) => !m)}>
            {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
          </RailButton>
          <RailButton label={t("share")} onClick={() => void share()}>
            <Share2 className="size-5" />
          </RailButton>
          {live.status === "live" ? (
            <div className="flex flex-col items-center">
              <RailButton label={t("gifts.title")} onClick={() => setGiftOpen(true)} tone="gift">
                <Gift className="size-6" />
              </RailButton>
              <span className="mt-0.5 text-[11px] font-semibold drop-shadow">
                {live.giftCount > 0 ? live.giftCount.toLocaleString(locale) : t("gifts.button")}
              </span>
            </div>
          ) : null}
          <div className="flex flex-col items-center">
            <RailButton label={t("like")} onClick={like} tone="heart">
              <Heart className="size-6 fill-current" />
            </RailButton>
            <span className="mt-0.5 text-[11px] font-semibold drop-shadow">
              {live.likeCount.toLocaleString(locale)}
            </span>
          </div>
        </div>

        {/* Bottom: chat, pinned product, input */}
        <div className="absolute inset-x-0 bottom-0 space-y-2 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <LiveChatList messages={live.messages} variant="overlay" className="max-h-44 pe-16" />

          {pinned ? (
            <div className="me-14 overflow-hidden rounded-2xl bg-white/95 shadow-xl ring-2 ring-rose-500/70">
              <LiveProductRow product={pinned} status={live.status} compact />
            </div>
          ) : null}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setBagOpen(true)}
              aria-label={t("productsInLive")}
              className="relative flex size-11 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-amber-400 to-orange-500 text-white shadow-lg"
            >
              <ShoppingBag className="size-5" />
              <span className="absolute -end-1 -top-1 flex size-5 items-center justify-center rounded-full bg-rose-600 text-[11px] font-bold">
                {live.products.length}
              </span>
            </button>
            {session?.user ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void send();
                }}
                className="flex min-w-0 flex-1 items-center gap-1 rounded-full bg-white/15 p-1 ps-4 backdrop-blur"
              >
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  maxLength={LIVE_LIMITS.chatText}
                  disabled={live.status !== "live"}
                  placeholder={t("chatPlaceholder")}
                  className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-white/60 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!text.trim() || sending}
                  aria-label={t("send")}
                  className="flex size-8 items-center justify-center rounded-full bg-rose-500 text-white disabled:opacity-40"
                >
                  {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                </button>
              </form>
            ) : (
              <Link
                href={`/login?redirect=${encodeURIComponent(`/live/${room.id}`)}`}
                className="flex h-10 flex-1 items-center rounded-full bg-white/15 px-4 text-sm text-white/80 backdrop-blur"
              >
                {t("loginToChat")}
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Desktop side panel: about + products */}
      <aside className="hidden space-y-4 lg:block">
        <div className="rounded-3xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-rose-600">
            <Radio className="size-4" />
            {live.status === "live" ? t("statusLive") : live.status === "scheduled" ? t("statusScheduled") : t("statusEnded")}
          </div>
          <h1 className="mt-2 text-2xl font-bold leading-tight">{room.title}</h1>
          {room.description ? (
            <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{room.description}</p>
          ) : null}
          {room.store.hasPage ? (
            <Link
              href={`/vendors/${room.store.slug}`}
              className="mt-4 inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-semibold hover:bg-muted"
            >
              <Store className="size-4" />
              {t("visitStore")}
            </Link>
          ) : null}
        </div>
        <div className="rounded-3xl border bg-card p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            <ShoppingBag className="size-5 text-rose-500" />
            {t("productsInLive")}
          </h2>
          <div className="space-y-2">
            {live.products.map((product, i) => (
              <div key={product.id} className={cn(product.id === live.pinnedProductId && "rounded-2xl ring-2 ring-rose-500")}>
                <LiveProductRow product={product} status={live.status} index={i + 1} />
              </div>
            ))}
          </div>
        </div>
      </aside>

      <LiveGiftSheet
        open={giftOpen}
        onOpenChange={setGiftOpen}
        liveId={room.id}
        signedIn={Boolean(session?.user)}
        canSend={live.status === "live"}
        storeName={room.store.name}
        onSent={live.addMessage}
      />

      <Sheet open={bagOpen} onOpenChange={setBagOpen}>
        <SheetContent side="bottom" className="max-h-[75vh] overflow-y-auto rounded-t-3xl">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <ShoppingBag className="size-5 text-rose-500" />
              {t("productsInLive")}
            </SheetTitle>
            <SheetDescription>{room.store.name}</SheetDescription>
          </SheetHeader>
          <div className="space-y-2 px-4 pb-6">
            {live.products.map((product, i) => (
              <LiveProductRow key={product.id} product={product} status={live.status} index={i + 1} />
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function RailButton({
  children,
  label,
  onClick,
  tone,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  tone?: "heart" | "gift";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "flex size-11 items-center justify-center rounded-full backdrop-blur transition-transform active:scale-90",
        tone === "heart"
          ? "bg-rose-500/90 text-white shadow-lg shadow-rose-500/40"
          : tone === "gift"
            ? "bg-linear-to-br from-amber-400 to-rose-500 text-white shadow-lg shadow-amber-500/40"
            : "bg-black/35 hover:bg-black/50",
      )}
    >
      {children}
    </button>
  );
}
