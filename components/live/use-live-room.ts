"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  LIVE_POLL_MS,
  type LiveChatItem,
  type LiveRoomState,
  type LiveShopProduct,
  type LiveStatus,
  type LiveSupporter,
} from "@/lib/live/live-types";

const MAX_MESSAGES = 120;

/** A per-tab viewer id, so one shopper counts once however often they poll. */
function viewerId() {
  if (typeof window === "undefined") return "";
  const key = "ohk-live-viewer";
  let id = window.sessionStorage.getItem(key);
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    window.sessionStorage.setItem(key, id);
  }
  return id;
}

/**
 * Polls a live's room every couple of seconds: status, counts, pin, new chat
 * and (when they changed) products. `endpoint` is the viewer's or the studio's
 * state route; `countViewer` is false for the studio so the host does not
 * count as a viewer.
 */
export function useLiveRoom(options: {
  endpoint: string;
  initialStatus: LiveStatus;
  initialProducts?: LiveShopProduct[];
  initialPinned?: string | null;
  initialLikes?: number;
  initialViewers?: number;
  countViewer?: boolean;
}) {
  const [status, setStatus] = useState<LiveStatus>(options.initialStatus);
  const [onAir, setOnAir] = useState(false);
  const [viewers, setViewers] = useState(options.initialViewers ?? 0);
  const [likeCount, setLikeCount] = useState(options.initialLikes ?? 0);
  const [pinnedProductId, setPinned] = useState<string | null>(options.initialPinned ?? null);
  const [products, setProducts] = useState<LiveShopProduct[]>(options.initialProducts ?? []);
  const [messages, setMessages] = useState<LiveChatItem[]>([]);
  const [giftCount, setGiftCount] = useState(0);
  const [supporters, setSupporters] = useState<LiveSupporter[]>([]);
  /** Hearts other people sent since the last poll, for the floating animation. */
  const [remoteHearts, setRemoteHearts] = useState(0);
  const lastId = useRef<string | null>(null);
  const version = useRef<string | null>(options.initialProducts ? "initial" : null);
  const lastLikes = useRef<number | null>(null);
  const ownLikes = useRef(0);

  const poll = useCallback(async () => {
    const params = new URLSearchParams();
    if (lastId.current) params.set("after", lastId.current);
    if (version.current && version.current !== "initial") params.set("v", version.current);
    if (options.countViewer !== false) params.set("viewer", viewerId());
    try {
      const res = await fetch(`${options.endpoint}?${params.toString()}`, { cache: "no-store" });
      const json = await res.json();
      if (!json?.success) return;
      const state = json.data as LiveRoomState;
      setStatus(state.status);
      setOnAir(state.onAir);
      setViewers(state.viewers);
      setPinned(state.pinnedProductId);
      if (lastLikes.current !== null) {
        const others = state.likeCount - lastLikes.current - ownLikes.current;
        if (others > 0) setRemoteHearts((n) => n + Math.min(others, 12));
      }
      ownLikes.current = 0;
      lastLikes.current = state.likeCount;
      setLikeCount(state.likeCount);
      setGiftCount(state.giftCount ?? 0);
      setSupporters(state.supporters ?? []);
      if (state.products) setProducts(state.products);
      version.current = state.productsVersion;
      if (state.messages.length) {
        lastId.current = state.messages[state.messages.length - 1].id;
        setMessages((current) => {
          const seen = new Set(current.map((m) => m.id));
          const next = [...current, ...state.messages.filter((m) => !seen.has(m.id))];
          return next.slice(-MAX_MESSAGES);
        });
      }
    } catch {
      // The next tick tries again.
    }
  }, [options.endpoint, options.countViewer]);

  useEffect(() => {
    void poll();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void poll();
    }, LIVE_POLL_MS);
    return () => clearInterval(timer);
  }, [poll]);

  const addMessage = useCallback((message: LiveChatItem) => {
    setMessages((current) =>
      current.some((m) => m.id === message.id) ? current : [...current, message].slice(-MAX_MESSAGES),
    );
  }, []);

  /** Count the viewer's own hearts so they are not replayed as someone else's. */
  const noteOwnLikes = useCallback((n: number) => {
    ownLikes.current += n;
    setLikeCount((c) => c + n);
  }, []);

  const consumeRemoteHearts = useCallback(() => setRemoteHearts(0), []);

  return {
    status,
    onAir,
    viewers,
    likeCount,
    giftCount,
    supporters,
    pinnedProductId,
    products,
    messages,
    remoteHearts,
    consumeRemoteHearts,
    addMessage,
    noteOwnLikes,
    refresh: poll,
    setPinned,
  };
}
