"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Crown, Gift, Loader2 } from "lucide-react";
import Link from "@/components/language/link";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "@/components/ui/toast-notification";
import { LIVE_GIFTS, LIVE_GIFT_LIMITS, liveGift, type LiveGiftDef } from "@/lib/live/live-gifts";
import type { LiveChatItem, LiveSupporter } from "@/lib/live/live-types";
import { cn } from "@/lib/utils";

/** A gift's name in the viewer's language. */
export function useGiftName() {
  const t = useTranslations("live.gifts.items");
  return (id: string) => {
    try {
      return t(id as never);
    } catch {
      return id;
    }
  };
}

/** A gift as a line of the chat. */
export function GiftChatLine({ message, variant }: { message: LiveChatItem; variant: "overlay" | "panel" }) {
  const t = useTranslations("live.gifts");
  const giftName = useGiftName();
  const gift = liveGift(message.gift?.id);
  if (!gift || !message.gift) return null;
  return (
    <p
      className={cn(
        "flex w-fit max-w-full items-center gap-1.5 rounded-2xl py-1 pe-2.5 ps-1 text-[13px] leading-snug",
        variant === "overlay"
          ? "bg-linear-to-r from-amber-400/35 to-rose-500/30 text-white ring-1 ring-amber-300/40 backdrop-blur-sm"
          : "bg-linear-to-r from-amber-100 to-rose-100 text-slate-900",
      )}
    >
      <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full bg-linear-to-br text-sm", gift.tone)}>
        {gift.emoji}
      </span>
      <span className="min-w-0">
        <span className={cn("me-1 font-semibold", variant === "overlay" ? "text-amber-200" : "text-amber-800")}>
          {message.name}
        </span>
        {t("sent", { gift: giftName(gift.id) })}
        {message.gift.count > 1 ? (
          <b className={cn("ms-1", variant === "overlay" ? "text-amber-300" : "text-rose-600")}>×{message.gift.count}</b>
        ) : null}
      </span>
    </p>
  );
}

type Show = { id: string; name: string; gift: LiveGiftDef; count: number };

/**
 * Gifts arriving in the chat, played over the picture: each slides in as a
 * banner beside the chat; bigger ones also pop in the middle; the biggest
 * take the whole screen for a moment, one at a time. Gifts already in the
 * chat when the room opened are not replayed.
 */
export function useGiftShow(messages: LiveChatItem[]) {
  const t = useTranslations("live.gifts");
  const giftName = useGiftName();
  const seen = useRef(new Set<string>());
  const [banners, setBanners] = useState<Show[]>([]);
  const [pops, setPops] = useState<Show[]>([]);
  const [mega, setMega] = useState<Show | null>(null);
  const megaQueue = useRef<Show[]>([]);
  const megaBusy = useRef(false);

  const nextMega = useCallback(function playNext() {
    const next = megaQueue.current.shift() ?? null;
    megaBusy.current = Boolean(next);
    setMega(next);
    if (next) setTimeout(playNext, 3200);
  }, []);

  useEffect(() => {
    const now = Date.now();
    for (const message of messages) {
      if (message.kind !== "gift" || seen.current.has(message.id)) continue;
      seen.current.add(message.id);
      const gift = liveGift(message.gift?.id);
      const at = message.at ? new Date(message.at).getTime() : now;
      if (!gift || now - at > 30_000) continue;
      const show: Show = { id: message.id, name: message.name, gift, count: message.gift?.count ?? 1 };
      setBanners((list) => [...list, show].slice(-3));
      setTimeout(() => setBanners((list) => list.filter((b) => b.id !== show.id)), 4200);
      if (gift.tier === 2) {
        setPops((list) => [...list, show].slice(-2));
        setTimeout(() => setPops((list) => list.filter((p) => p.id !== show.id)), 1800);
      }
      if (gift.tier === 3) {
        megaQueue.current.push(show);
        if (megaQueue.current.length > 5) megaQueue.current.shift();
        if (!megaBusy.current) nextMega();
      }
    }
  }, [messages, nextMega]);

  const layer = (
    <>
      {/* Banners, above the chat on the left */}
      <div className="pointer-events-none absolute start-3 top-[38%] z-10 flex w-[70%] flex-col gap-2">
        {banners.map((b) => (
          <div
            key={b.id}
            className={cn(
              "live-gift-banner flex w-fit max-w-full items-center gap-2 rounded-full bg-linear-to-r py-1 pe-3 ps-1 text-white shadow-lg",
              b.gift.tone,
            )}
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/20 text-xl">
              {b.gift.emoji}
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-xs font-bold">{b.name}</span>
              <span className="block truncate text-[11px] text-white/85">{t("sent", { gift: giftName(b.gift.id) })}</span>
            </span>
            {b.count > 1 ? (
              <span className="live-gift-combo ms-1 text-xl font-black italic text-amber-200 drop-shadow">×{b.count}</span>
            ) : null}
          </div>
        ))}
      </div>

      {/* Middle pops */}
      {pops.map((p, i) => (
        <span
          key={p.id}
          className="live-gift-pop pointer-events-none absolute start-1/2 top-[34%] z-10 text-7xl drop-shadow-xl"
          style={{ marginInlineStart: `${(i % 2 ? 1 : -1) * 40}px` }}
        >
          {p.gift.emoji}
        </span>
      ))}

      {/* Whole screen, one at a time */}
      {mega ? (
        <div key={mega.id} className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center">
          <div className="live-gift-glow absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(251,191,36,0.55),rgba(190,24,93,0.25)_40%,transparent_70%)]" />
          <div className="relative">
            {Array.from({ length: 12 }, (_, i) => (
              <span
                key={i}
                className="live-gift-ray absolute start-1/2 top-1/2 text-2xl"
                style={{ "--ray": `${i * 30}deg` } as React.CSSProperties}
              >
                {i % 2 ? "✨" : mega.gift.emoji}
              </span>
            ))}
            <span className="live-gift-mega relative block text-[8rem] leading-none drop-shadow-[0_10px_30px_rgba(0,0,0,0.45)]">
              {mega.gift.emoji}
            </span>
          </div>
          <div className="live-gift-mega-label relative mt-6 rounded-full bg-black/45 px-5 py-2 text-center text-white backdrop-blur">
            <p className="text-sm font-bold text-amber-200">{mega.name}</p>
            <p className="text-xs">
              {t("sent", { gift: giftName(mega.gift.id) })}
              {mega.count > 1 ? ` ×${mega.count}` : ""}
            </p>
          </div>
        </div>
      ) : null}
    </>
  );

  return { layer };
}

/** The viewers who sent the most. */
export function LiveSupporters({
  supporters,
  variant,
  className,
}: {
  supporters: LiveSupporter[];
  variant: "overlay" | "panel";
  className?: string;
}) {
  const t = useTranslations("live.gifts");
  if (!supporters.length) return null;
  const medal = ["bg-amber-400 text-amber-950", "bg-slate-300 text-slate-800", "bg-orange-300 text-orange-900"];
  if (variant === "overlay") {
    return (
      <div className={cn("flex items-center gap-1", className)} title={t("supporters")}>
        <Crown className="size-3.5 text-amber-300" />
        {supporters.map((s, i) => (
          <span
            key={`${s.name}-${i}`}
            className={cn("flex size-6 items-center justify-center rounded-full text-[10px] font-bold ring-2 ring-black/20", medal[i])}
            title={`${s.name} · ${s.count}`}
          >
            {s.name.trim().charAt(0).toUpperCase() || "?"}
          </span>
        ))}
      </div>
    );
  }
  return (
    <div className={cn("rounded-2xl bg-linear-to-br from-amber-50 to-rose-50 p-3 ring-1 ring-amber-200/60", className)}>
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-amber-800">
        <Crown className="size-4" />
        {t("supporters")}
      </p>
      <ol className="space-y-1.5">
        {supporters.map((s, i) => (
          <li key={`${s.name}-${i}`} className="flex items-center gap-2 text-sm">
            <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold", medal[i])}>
              {i + 1}
            </span>
            <span className="min-w-0 flex-1 truncate font-medium">{s.name}</span>
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Gift className="size-3.5 text-rose-500" />
              {s.count}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * The viewer's gift box. Taps on the same gift within a moment go as one
 * request (×n), so a burst of roses is one line in the chat.
 */
export function LiveGiftSheet({
  open,
  onOpenChange,
  liveId,
  signedIn,
  canSend,
  storeName,
  onSent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  liveId: string;
  signedIn: boolean;
  canSend: boolean;
  storeName: string;
  onSent: (message: LiveChatItem) => void;
}) {
  const t = useTranslations("live.gifts");
  const giftName = useGiftName();
  const [combo, setCombo] = useState<{ id: string; count: number } | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState<Record<number, number>>({});
  // The clock the cool-down countdowns are drawn from.
  const [now, setNow] = useState(() => Date.now());
  const pending = useRef<{ id: string; count: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Redraw the cool-down countdowns.
  useEffect(() => {
    // Ticks while a countdown is running, stops once they have all ended.
    if (!Object.values(cooldown).some((until) => until > now)) return;
    const id = setTimeout(() => setNow(Date.now()), 500);
    return () => clearTimeout(id);
  }, [cooldown, now]);

  const flush = useCallback(async () => {
    const batch = pending.current;
    pending.current = null;
    timer.current = null;
    if (!batch) return;
    const gift = liveGift(batch.id);
    if (!gift) return;
    setSending(batch.id);
    try {
      const res = await fetch(`/api/live/${liveId}/gift`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ giftId: batch.id, count: batch.count }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        const details = json?.details as { reason?: string; retryAfter?: number } | undefined;
        const seconds = details?.retryAfter ?? 0;
        if (details?.reason === "gift_cooldown") {
          setNow(Date.now());
          setCooldown((c) => ({ ...c, [gift.tier]: Date.now() + seconds * 1000 }));
          toast.error(t("cooldown", { seconds }));
        } else if (details?.reason === "gift_own") {
          toast.error(t("ownLive"));
        } else if (details?.reason === "gift_minute") {
          toast.error(t("limitMinute", { seconds }));
        } else {
          toast.error(json?.message || t("failed"));
        }
        return;
      }
      onSent(json.data as LiveChatItem);
      const wait = LIVE_GIFT_LIMITS.cooldownSeconds[gift.tier];
      if (wait > 0) {
        setNow(Date.now());
        setCooldown((c) => ({ ...c, [gift.tier]: Date.now() + wait * 1000 }));
      }
    } catch {
      toast.error(t("failed"));
    } finally {
      setSending(null);
      setCombo(null);
    }
  }, [liveId, onSent, t]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const tap = (gift: LiveGiftDef) => {
    if (!canSend) return;
    const waitUntil = cooldown[gift.tier] ?? 0;
    if (waitUntil > now) return;
    // A different gift sends what was gathered first.
    if (pending.current && pending.current.id !== gift.id) {
      if (timer.current) clearTimeout(timer.current);
      void flush();
    }
    const count = Math.min(LIVE_GIFT_LIMITS.batch, (pending.current?.count ?? 0) + 1);
    pending.current = { id: gift.id, count };
    setCombo({ id: gift.id, count });
    if (timer.current) clearTimeout(timer.current);
    // Big gifts go at once; small ones wait a moment for more taps.
    if (gift.tier > 1 || count >= LIVE_GIFT_LIMITS.batch) void flush();
    else timer.current = setTimeout(() => void flush(), 700);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Gift className="size-5 text-rose-500" />
            {t("title")}
          </SheetTitle>
          <SheetDescription>{t("hint", { store: storeName })}</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          {!signedIn ? (
            <Link
              href={`/login?redirect=${encodeURIComponent(`/live/${liveId}`)}`}
              className="mb-3 block rounded-2xl bg-rose-50 p-3 text-center text-sm font-semibold text-rose-700"
            >
              {t("signIn")}
            </Link>
          ) : !canSend ? (
            <p className="mb-3 rounded-2xl bg-muted p-3 text-center text-sm text-muted-foreground">{t("notLive")}</p>
          ) : null}
          <div className="grid grid-cols-4 gap-2.5">
            {LIVE_GIFTS.map((gift) => {
              const waitUntil = cooldown[gift.tier] ?? 0;
              const wait = Math.max(0, Math.ceil((waitUntil - now) / 1000));
              const disabled = !signedIn || !canSend || wait > 0;
              const active = combo?.id === gift.id;
              return (
                <button
                  key={gift.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => tap(gift)}
                  className={cn(
                    "group relative flex flex-col items-center gap-1 rounded-2xl border p-2 pt-3 transition active:scale-95 disabled:opacity-45",
                    active ? "border-rose-400 bg-rose-50 ring-2 ring-rose-300" : "hover:bg-muted",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-14 items-center justify-center rounded-full bg-linear-to-br text-3xl shadow-md transition-transform group-active:scale-110",
                      gift.tone,
                    )}
                  >
                    {gift.emoji}
                  </span>
                  <span className="w-full truncate text-center text-xs font-semibold">{giftName(gift.id)}</span>
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-[10px] font-bold",
                      wait > 0 ? "bg-slate-200 text-slate-600" : "bg-emerald-100 text-emerald-700",
                    )}
                  >
                    {wait > 0 ? `${wait}s` : t("free")}
                  </span>
                  {gift.tier > 1 ? (
                    <span className="absolute end-1.5 top-1.5 text-[10px] font-bold text-amber-500">
                      {gift.tier === 3 ? "★★" : "★"}
                    </span>
                  ) : null}
                  {active && combo.count > 1 ? (
                    <span className="live-gift-combo absolute -top-2 end-0 rounded-full bg-rose-600 px-1.5 text-xs font-black text-white">
                      ×{combo.count}
                    </span>
                  ) : null}
                  {sending === gift.id ? (
                    <Loader2 className="absolute start-1.5 top-1.5 size-3.5 animate-spin text-rose-500" />
                  ) : null}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-center text-[11px] text-muted-foreground">{t("freeNote")}</p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
