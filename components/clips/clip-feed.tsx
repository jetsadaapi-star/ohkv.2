"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  BadgeCheck,
  Bookmark,
  ChevronDown,
  ChevronUp,
  Clapperboard,
  Eye,
  Heart,
  Keyboard,
  Loader2,
  MapPin,
  MessageCircle,
  Package,
  Play,
  Plus,
  Radio,
  Send,
  Share2,
  ShoppingBag,
  Sparkles,
  Store,
  Trash2,
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
import { useCartActions } from "@/hooks/use-cart";
import {
  EMBEDDED_CHECKOUT_OPEN,
  EmbeddedCheckoutProvider,
  useEmbeddedCheckout,
} from "@/components/checkout/embedded-checkout";
import { ProductLink } from "@/components/live/live-ui";
import { refusalMessage } from "@/lib/api/client";
import { useCurrency } from "@/providers/currency-provider";
import { kalasinDistrictLabel } from "@/config/kalasin-districts";
import { useSession } from "@/lib/auth/auth-client";
import {
  SHORT_CLIP_LIMITS,
  type ClipComment,
  type ClipFeedItem,
  type ClipFeedProduct,
  type ClipViewerState,
} from "@/lib/clips/clip-types";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Seconds a clip must play before it counts as a view. */
const VIEW_AFTER_SECONDS = 2;
const HINT_KEY = "ohk-clips-swipe-hint";

/** 1.2K-style counts, as the clip apps show them. */
function compact(n: number, locale: string) {
  return new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

function timeAgo(iso: string, locale: string) {
  const seconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const abs = Math.abs(seconds);
  if (abs < 60) return rtf.format(seconds, "second");
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(seconds / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(seconds / 86400), "day");
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(iso));
}

type Counts = Pick<ClipFeedItem, "likeCount" | "commentCount" | "saveCount" | "shareCount">;
type Mode = "feed" | "saved";

/* ------------------------------------------------------------------ */
/* The experience                                                      */
/* ------------------------------------------------------------------ */

/**
 * The storefront's review clips, mobile first.
 *
 * Phones: one clip per screen, full screen and immersive — tabs over the top,
 * the actions rail on the right, the store, caption and the reviewed product
 * at the bottom, a seekable progress line under it all.
 *
 * Desktop: three columns — navigation and "up next" on the left, the 9:16
 * player in the middle (↑ ↓ to move), and the clip's store, products and
 * comments on the right, always open.
 *
 * Buying opens checkout over the page (EmbeddedCheckoutProvider), so the clip
 * is still there afterwards.
 */
export function ClipFeed(props: {
  initialItems: ClipFeedItem[];
  initialCursor: string | null;
  mode?: Mode;
}) {
  return (
    <EmbeddedCheckoutProvider>
      <ClipsExperience {...props} />
    </EmbeddedCheckoutProvider>
  );
}

function ClipsExperience({
  initialItems,
  initialCursor,
  mode = "feed",
}: {
  initialItems: ClipFeedItem[];
  initialCursor: string | null;
  mode?: Mode;
}) {
  const t = useTranslations("clips");
  const locale = useLocale();
  const { data: session, isPending } = useSession();
  const signedIn = Boolean(session?.user);
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingSaved, setLoadingSaved] = useState(mode === "saved");
  const [muted, setMuted] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(initialItems[0]?.id ?? null);
  const [productsClip, setProductsClip] = useState<ClipFeedItem | null>(null);
  const [commentsClip, setCommentsClip] = useState<ClipFeedItem | null>(null);
  const [states, setStates] = useState<Record<string, ClipViewerState>>({});
  const [counts, setCounts] = useState<Record<string, Counts>>({});
  const [following, setFollowing] = useState<Record<string, boolean>>({});
  const [playSignal, setPlaySignal] = useState(0);
  const [hint, setHint] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const activeIndex = Math.max(0, items.findIndex((c) => c.id === activeId));
  const active = items[activeIndex] ?? null;
  const countsOf = useCallback((clip: ClipFeedItem): Counts => counts[clip.id] ?? clip, [counts]);
  const patchCounts = useCallback(
    (id: string, patch: Partial<Counts>) =>
      setCounts((current) => {
        const base = current[id] ?? items.find((c) => c.id === id);
        if (!base) return current;
        const { likeCount, commentCount, saveCount, shareCount } = base;
        return { ...current, [id]: { likeCount, commentCount, saveCount, shareCount, ...patch } };
      }),
    [items],
  );

  // Checkout opening over the feed closes the product and comment sheets.
  useEffect(() => {
    const closeSheets = () => {
      setProductsClip(null);
      setCommentsClip(null);
    };
    window.addEventListener(EMBEDDED_CHECKOUT_OPEN, closeSheets);
    return () => window.removeEventListener(EMBEDDED_CHECKOUT_OPEN, closeSheets);
  }, []);

  // First visit: show how to move between clips, once.
  useEffect(() => {
    if (items.length < 2) return;
    try {
      if (window.localStorage.getItem(HINT_KEY)) return;
      window.localStorage.setItem(HINT_KEY, "1");
    } catch {
      return;
    }
    setHint(true);
    const timer = setTimeout(() => setHint(false), 3800);
    return () => clearTimeout(timer);
  }, [items.length]);

  // Saved tab: the shopper's own list.
  useEffect(() => {
    if (mode !== "saved" || isPending) return;
    if (!signedIn) {
      setLoadingSaved(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/clips/me?saved=1", { cache: "no-store" });
        const json = await res.json();
        if (!cancelled && json?.success) {
          const saved = (json.data?.items ?? []) as ClipFeedItem[];
          setItems(saved);
          setActiveId(saved[0]?.id ?? null);
        }
      } finally {
        if (!cancelled) setLoadingSaved(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, signedIn, isPending]);

  // Which clips this shopper has hearted / saved, and which stores they follow.
  const idsKey = items.map((c) => c.id).join(",");
  useEffect(() => {
    if (!signedIn || !idsKey) return;
    const missing = items.filter((c) => !(c.id in states));
    if (missing.length === 0) return;
    const stores = [...new Set(missing.filter((c) => c.store.hasPage).map((c) => c.store.slug))];
    void fetch(
      `/api/clips/me?ids=${missing.map((c) => c.id).join(",")}&stores=${encodeURIComponent(stores.join(","))}`,
      { cache: "no-store" },
    )
      .then((res) => res.json())
      .then((json) => {
        if (!json?.success) return;
        setStates((current) => ({ ...current, ...json.data.states }));
        setFollowing((current) => ({ ...current, ...json.data.following }));
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, idsKey]);

  const requireLogin = (clip: ClipFeedItem) => {
    if (signedIn) return true;
    toast.info(t("loginRequired"));
    window.location.href = `/${locale}/login?redirect=${encodeURIComponent(`/clips?start=${clip.id}`)}`;
    return false;
  };

  const react = async (clip: ClipFeedItem, kind: "like" | "save", on: boolean) => {
    if (!requireLogin(clip)) return;
    const key = kind === "like" ? "liked" : "saved";
    const field = kind === "like" ? "likeCount" : "saveCount";
    const before = states[clip.id] ?? { liked: false, saved: false };
    if (before[key] === on) return;
    setStates((current) => ({ ...current, [clip.id]: { ...before, [key]: on } }));
    patchCounts(clip.id, { [field]: Math.max(0, countsOf(clip)[field] + (on ? 1 : -1)) });
    try {
      const res = await fetch(`/api/clips/${clip.id}/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ on }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error();
      patchCounts(clip.id, { [field]: json.data.count });
      if (kind === "save") toast.success(on ? t("savedToast") : t("unsavedToast"));
    } catch {
      setStates((current) => ({ ...current, [clip.id]: before }));
      toast.error(t("actionFailed"));
    }
  };

  const follow = async (clip: ClipFeedItem) => {
    if (!requireLogin(clip) || !clip.store.hasPage) return;
    const slug = clip.store.slug;
    const on = !following[slug];
    setFollowing((current) => ({ ...current, [slug]: on }));
    try {
      const res = await fetch(`/api/vendors/${encodeURIComponent(slug)}/follow`, { method: on ? "POST" : "DELETE" });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.message);
      if (on) toast.success(t("followedToast", { store: clip.store.name }));
    } catch (error) {
      setFollowing((current) => ({ ...current, [slug]: !on }));
      toast.error(error instanceof Error && error.message ? error.message : t("followFailed"));
    }
  };

  const share = async (clip: ClipFeedItem) => {
    const url = `${window.location.origin}/${locale}/clips?start=${clip.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: clip.title || clip.store.name, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success(t("linkCopied"));
      }
    } catch {
      return; // Closed the share sheet: nothing was shared.
    }
    try {
      const res = await fetch(`/api/clips/${clip.id}/share`, { method: "POST" });
      const json = await res.json();
      if (json?.success) patchCounts(clip.id, { shareCount: json.data.shareCount });
    } catch {
      // The count is only a count.
    }
  };

  const loadMore = useCallback(async () => {
    if (mode !== "feed" || !cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/clips?cursor=${encodeURIComponent(cursor)}`);
      const json = await res.json();
      if (json?.success) {
        const next = (json.data?.items ?? []) as ClipFeedItem[];
        setItems((current) => {
          const seen = new Set(current.map((c) => c.id));
          return [...current, ...next.filter((c) => !seen.has(c.id))];
        });
        setCursor(json.data?.nextCursor ?? null);
      }
    } catch {
      // Scrolling back down retries.
    } finally {
      setLoadingMore(false);
    }
  }, [mode, cursor, loadingMore]);

  // Which clip is on screen: the one most of the viewport shows.
  useEffect(() => {
    const root = scrollerRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            setActiveId((entry.target as HTMLElement).dataset.clipId ?? null);
            setHint(false);
          }
        }
      },
      { root, threshold: [0.6] },
    );
    root.querySelectorAll<HTMLElement>("[data-clip-id]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [items]);

  // Near the end: fetch the next page.
  useEffect(() => {
    if (activeIndex >= items.length - 2) void loadMore();
  }, [activeIndex, items.length, loadMore]);

  const goTo = useCallback((index: number) => {
    const root = scrollerRef.current;
    if (!root) return;
    const target = root.querySelectorAll<HTMLElement>("[data-clip-id]")[index];
    if (target) root.scrollTo({ top: target.offsetTop, behavior: "smooth" });
  }, []);

  // Keyboard: ↑ ↓ / J K move, Space plays, M mutes, L hearts.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const el = event.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (productsClip || commentsClip) return;
      const key = event.key.toLowerCase();
      if (key === "arrowdown" || key === "j") {
        event.preventDefault();
        goTo(Math.min(items.length - 1, activeIndex + 1));
      } else if (key === "arrowup" || key === "k") {
        event.preventDefault();
        goTo(Math.max(0, activeIndex - 1));
      } else if (key === " ") {
        event.preventDefault();
        setPlaySignal((n) => n + 1);
      } else if (key === "m") {
        setMuted((m) => !m);
      } else if (key === "l" && active) {
        void react(active, "like", !(states[active.id]?.liked ?? false));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, items.length, goTo, productsClip, commentsClip, active, states]);

  /* ---------------- empty / loading ---------------- */

  if (loadingSaved) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black lg:static lg:z-auto lg:h-[60vh] lg:bg-transparent">
        <Loader2 className="size-7 animate-spin text-white/70 lg:text-muted-foreground" />
      </div>
    );
  }

  const shell = (children: React.ReactNode) => (
    <div className="fixed inset-0 z-[60] flex bg-black lg:static lg:z-auto lg:mx-auto lg:h-[calc(100dvh-var(--store-chrome-h,9rem)-2.5rem)] lg:min-h-[620px] lg:max-w-[1280px] lg:gap-6 lg:bg-transparent lg:px-4 lg:py-5">
      <DesktopNav mode={mode} items={items} activeIndex={activeIndex} onPick={goTo} />
      {children}
    </div>
  );

  if (items.length === 0) {
    const savedNeedsLogin = mode === "saved" && !signedIn;
    return shell(
      <div className="relative flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center text-white lg:rounded-3xl lg:border lg:border-dashed lg:bg-card lg:text-foreground">
        <MobileTopBar mode={mode} muted={muted} onToggleMute={() => setMuted((m) => !m)} />
        <span className="flex size-16 items-center justify-center rounded-3xl bg-linear-to-br from-rose-500 to-violet-600 text-white shadow-xl shadow-rose-500/30">
          {mode === "saved" ? <Bookmark className="size-8" /> : <Clapperboard className="size-8" />}
        </span>
        <p className="text-lg font-bold">
          {mode === "saved" ? (savedNeedsLogin ? t("loginToSave") : t("savedEmptyTitle")) : t("feedEmptyTitle")}
        </p>
        <p className="max-w-xs text-sm opacity-75">
          {mode === "saved" ? t("savedEmptyDescription") : t("feedEmptyDescription")}
        </p>
        {savedNeedsLogin ? (
          <Link
            href={`/login?redirect=${encodeURIComponent("/clips?saved=1")}`}
            className="mt-2 rounded-full bg-white px-6 py-2.5 text-sm font-bold text-slate-900 lg:bg-slate-900 lg:text-white"
          >
            {t("login")}
          </Link>
        ) : mode === "saved" ? (
          <Link
            href="/clips"
            className="mt-2 rounded-full bg-white px-6 py-2.5 text-sm font-bold text-slate-900 lg:bg-slate-900 lg:text-white"
          >
            {t("forYou")}
          </Link>
        ) : null}
      </div>,
    );
  }

  /* ---------------- the feed ---------------- */

  return shell(
    <>
      {/* Player column */}
      <div className="relative flex min-w-0 flex-1 justify-center">
        <MobileTopBar mode={mode} muted={muted} onToggleMute={() => setMuted((m) => !m)} />
        <div
          ref={scrollerRef}
          className="h-full w-full snap-y snap-mandatory overflow-y-auto overscroll-contain [scrollbar-width:none] lg:w-auto lg:aspect-9/16 lg:rounded-[28px] lg:bg-black lg:shadow-2xl lg:shadow-slate-900/20 [&::-webkit-scrollbar]:hidden"
        >
          {items.map((clip, index) => (
            <ClipSlide
              key={clip.id}
              clip={clip}
              counts={countsOf(clip)}
              state={states[clip.id] ?? { liked: false, saved: false }}
              following={Boolean(following[clip.store.slug])}
              active={clip.id === activeId}
              near={Math.abs(index - activeIndex) <= 1}
              muted={muted}
              playSignal={clip.id === activeId ? playSignal : 0}
              onUnmute={() => setMuted(false)}
              onOpenProducts={() => setProductsClip(clip)}
              onOpenComments={() => setCommentsClip(clip)}
              onLike={(on) => void react(clip, "like", on)}
              onSave={(on) => void react(clip, "save", on)}
              onShare={() => void share(clip)}
              onFollow={() => void follow(clip)}
            />
          ))}
          {loadingMore ? (
            <div className="flex h-24 snap-end items-center justify-center text-white/70">
              <Loader2 className="size-6 animate-spin" />
            </div>
          ) : null}
        </div>

        {/* Desktop: up / down */}
        <div className="absolute end-0 top-1/2 hidden -translate-y-1/2 flex-col gap-3 lg:flex">
          <NavArrow label={t("previous")} disabled={activeIndex === 0} onClick={() => goTo(activeIndex - 1)}>
            <ChevronUp className="size-6" />
          </NavArrow>
          <NavArrow
            label={t("next")}
            disabled={activeIndex >= items.length - 1}
            onClick={() => goTo(activeIndex + 1)}
          >
            <ChevronDown className="size-6" />
          </NavArrow>
        </div>

        {/* First visit: how to move on */}
        {hint ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-36 z-30 flex justify-center lg:bottom-10">
            <div className="flex flex-col items-center gap-1 rounded-3xl bg-black/55 px-5 py-3 text-white backdrop-blur-md">
              <ChevronUp className="size-7 animate-bounce" />
              <span className="text-sm font-semibold lg:hidden">{t("swipeHint")}</span>
              <span className="hidden text-sm font-semibold lg:block">{t("keysHint")}</span>
            </div>
          </div>
        ) : null}
      </div>

      {/* Desktop: the clip's details */}
      {active ? (
        <DetailsPanel
          key={active.id}
          clip={active}
          counts={countsOf(active)}
          following={Boolean(following[active.store.slug])}
          signedIn={signedIn}
          onFollow={() => void follow(active)}
          onCount={(id, commentCount) => patchCounts(id, { commentCount })}
        />
      ) : null}

      {/* Phones: products and comments as sheets */}
      <Sheet open={Boolean(productsClip)} onOpenChange={(open) => !open && setProductsClip(null)}>
        <SheetContent side="bottom" className="z-[70] mx-auto max-h-[78vh] max-w-xl overflow-y-auto rounded-t-[28px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <ShoppingBag className="size-5 text-rose-500" />
              {t("productsInClip")}
            </SheetTitle>
            <SheetDescription>{productsClip?.store.name}</SheetDescription>
          </SheetHeader>
          <div className="space-y-2 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            {productsClip?.products.map((product, index) => (
              <ProductRow key={product.id} product={product} index={index + 1} />
            ))}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={Boolean(commentsClip)} onOpenChange={(open) => !open && setCommentsClip(null)}>
        <SheetContent side="bottom" className="z-[70] mx-auto flex h-[72vh] max-w-xl flex-col rounded-t-[28px] p-0">
          <SheetHeader className="border-b px-4 py-3">
            <SheetTitle className="text-center text-base">
              {t("commentsTitle", { count: commentsClip ? countsOf(commentsClip).commentCount : 0 })}
            </SheetTitle>
            <SheetDescription className="sr-only">{commentsClip?.title}</SheetDescription>
          </SheetHeader>
          {commentsClip ? (
            <CommentsPanel
              clip={commentsClip}
              signedIn={signedIn}
              onCount={(id, commentCount) => patchCounts(id, { commentCount })}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </>,
  );
}

/* ------------------------------------------------------------------ */
/* Chrome                                                              */
/* ------------------------------------------------------------------ */

function MobileTopBar({ mode, muted, onToggleMute }: { mode: Mode; muted: boolean; onToggleMute: () => void }) {
  const t = useTranslations("clips");
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between px-3 pt-[max(0.6rem,env(safe-area-inset-top))] lg:hidden">
      <Link
        href="/"
        aria-label={t("close")}
        className="pointer-events-auto flex size-10 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-md"
      >
        <X className="size-5" />
      </Link>
      <nav className="pointer-events-auto flex items-center gap-1 rounded-full bg-black/30 p-1 backdrop-blur-md">
        {(["feed", "saved"] as const).map((tab) => (
          <Link
            key={tab}
            href={tab === "saved" ? "/clips?saved=1" : "/clips"}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-bold transition-colors",
              mode === tab ? "bg-white text-slate-900" : "text-white/80",
            )}
          >
            {tab === "saved" ? t("savedTab") : t("forYou")}
          </Link>
        ))}
      </nav>
      <button
        type="button"
        onClick={onToggleMute}
        aria-label={muted ? t("unmute") : t("mute")}
        className="pointer-events-auto flex size-10 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-md"
      >
        {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
      </button>
    </div>
  );
}

function DesktopNav({
  mode,
  items,
  activeIndex,
  onPick,
}: {
  mode: Mode;
  items: ClipFeedItem[];
  activeIndex: number;
  onPick: (index: number) => void;
}) {
  const t = useTranslations("clips");
  const upNext = items.slice(activeIndex + 1, activeIndex + 4);
  const links = [
    { href: "/clips", label: t("forYou"), icon: Sparkles, on: mode === "feed" },
    { href: "/clips?saved=1", label: t("savedTab"), icon: Bookmark, on: mode === "saved" },
    { href: "/live", label: t("navLive"), icon: Radio, on: false },
    { href: "/vendors", label: t("navStores"), icon: Store, on: false },
  ];
  return (
    <aside className="hidden w-56 shrink-0 flex-col gap-4 overflow-y-auto [scrollbar-width:none] lg:flex xl:w-60 [&::-webkit-scrollbar]:hidden">
      <div className="flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-2xl bg-linear-to-br from-rose-500 to-violet-600 text-white shadow-lg shadow-rose-500/30">
          <Clapperboard className="size-5" />
        </span>
        <div className="min-w-0">
          <h1 className="text-lg font-bold leading-tight">{t("feedTitle")}</h1>
          <p className="text-xs text-muted-foreground">{t("feedTagline")}</p>
        </div>
      </div>

      <nav className="space-y-1">
        {links.map(({ href, label, icon: Icon, on }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-2xl px-3 py-2 text-[15px] font-semibold transition-colors",
              on ? "bg-rose-50 text-rose-600" : "text-foreground/80 hover:bg-muted",
            )}
          >
            <Icon className="size-5" />
            {label}
          </Link>
        ))}
      </nav>

      {upNext.length ? (
        <div>
          <p className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">{t("upNext")}</p>
          <div className="space-y-1">
            {upNext.map((clip, i) => (
              <button
                key={clip.id}
                type="button"
                onClick={() => onPick(activeIndex + 1 + i)}
                className="flex w-full items-center gap-3 rounded-2xl p-1.5 text-start transition-colors hover:bg-muted"
              >
                <span className="relative block aspect-9/16 w-10 shrink-0 overflow-hidden rounded-lg bg-slate-900">
                  {clip.posterUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={clip.posterUrl} alt="" className="size-full object-cover" />
                  ) : null}
                </span>
                <span className="min-w-0">
                  <span className="line-clamp-2 text-sm font-semibold leading-snug">{clip.title || clip.caption}</span>
                  <span className="block truncate text-xs text-muted-foreground">{clip.store.name}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-auto shrink-0 rounded-2xl bg-muted/60 p-3 text-xs text-muted-foreground">
        <p className="mb-1.5 flex items-center gap-1.5 font-semibold text-foreground/80">
          <Keyboard className="size-4" />
          {t("shortcuts")}
        </p>
        <p>
          <Kbd>↑</Kbd> <Kbd>↓</Kbd> {t("shortcutMove")}
        </p>
        <p className="mt-1">
          <Kbd>Space</Kbd> {t("shortcutPlay")} · <Kbd>M</Kbd> {t("shortcutMute")} · <Kbd>L</Kbd> {t("like")}
        </p>
      </div>
    </aside>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded-md border bg-background px-1.5 py-0.5 font-sans text-[11px] font-semibold text-foreground">
      {children}
    </kbd>
  );
}

function NavArrow({
  children,
  label,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex size-12 items-center justify-center rounded-full border bg-card text-foreground shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* One clip                                                            */
/* ------------------------------------------------------------------ */

function ClipSlide({
  clip,
  counts,
  state,
  following,
  active,
  near,
  muted,
  playSignal,
  onUnmute,
  onOpenProducts,
  onOpenComments,
  onLike,
  onSave,
  onShare,
  onFollow,
}: {
  clip: ClipFeedItem;
  counts: Counts;
  state: ClipViewerState;
  following: boolean;
  active: boolean;
  near: boolean;
  muted: boolean;
  playSignal: number;
  onUnmute: () => void;
  onOpenProducts: () => void;
  onOpenComments: () => void;
  onLike: (on: boolean) => void;
  onSave: (on: boolean) => void;
  onShare: () => void;
  onFollow: () => void;
}) {
  const t = useTranslations("clips");
  const locale = useLocale();
  const videoRef = useRef<HTMLVideoElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [burst, setBurst] = useState<{ id: number; x: number; y: number } | null>(null);
  const viewSent = useRef(false);
  const lastTap = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Play the clip in view, pause the rest (and rewind them for next time).
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (active) {
      video.muted = muted;
      void video.play().then(() => setPaused(false)).catch(() => setPaused(true));
    } else {
      video.pause();
      video.currentTime = 0;
      setExpanded(false);
    }
  }, [active, muted]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play().then(() => setPaused(false)).catch(() => {});
    } else {
      video.pause();
      setPaused(true);
    }
  }, []);

  // Space on the keyboard.
  useEffect(() => {
    if (playSignal > 0) togglePlay();
  }, [playSignal, togglePlay]);

  // The progress line, smooth (timeupdate alone is ~4 times a second).
  useEffect(() => {
    if (!active) return;
    let frame = 0;
    const tick = () => {
      const video = videoRef.current;
      const bar = barRef.current;
      if (video && bar && video.duration) bar.style.width = `${(video.currentTime / video.duration) * 100}%`;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active]);

  const seek = (event: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    if (!video || !video.duration) return;
    const rect = event.currentTarget.getBoundingClientRect();
    video.currentTime = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) * video.duration;
  };

  // One tap pauses; a double tap hearts (and never un-hearts).
  const handleTap = (event: React.MouseEvent<HTMLElement>) => {
    const now = Date.now();
    const rect = event.currentTarget.getBoundingClientRect();
    if (now - lastTap.current < 280) {
      if (tapTimer.current) clearTimeout(tapTimer.current);
      lastTap.current = 0;
      setBurst({ id: now, x: event.clientX - rect.left, y: event.clientY - rect.top });
      if (!state.liked) onLike(true);
      return;
    }
    lastTap.current = now;
    tapTimer.current = setTimeout(togglePlay, 280);
  };

  const handleTime = () => {
    const video = videoRef.current;
    if (!video || viewSent.current || video.currentTime < VIEW_AFTER_SECONDS) return;
    viewSent.current = true;
    void fetch(`/api/clips/${clip.id}/view`, { method: "POST" }).catch(() => {});
  };

  const district = clip.store.district ? kalasinDistrictLabel(clip.store.district, locale) : "";
  const lead = clip.products[0];

  return (
    <section
      data-clip-id={clip.id}
      className="relative h-full w-full snap-start snap-always overflow-hidden bg-black text-white"
    >
      <video
        ref={videoRef}
        src={near ? clip.videoUrl : undefined}
        poster={clip.posterUrl || undefined}
        playsInline
        loop
        muted={muted}
        preload={active ? "auto" : "metadata"}
        onTimeUpdate={handleTime}
        className="absolute inset-0 size-full object-cover"
      />
      <button
        type="button"
        aria-label={paused ? t("play") : t("pause")}
        onClick={handleTap}
        className="absolute inset-0 cursor-pointer"
      />

      {paused ? (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="flex size-20 items-center justify-center rounded-full bg-black/35 backdrop-blur-sm">
            <Play className="ms-1 size-9 fill-current" />
          </span>
        </span>
      ) : null}

      {burst ? (
        <Heart
          key={burst.id}
          className="clip-heart-burst pointer-events-none absolute size-24 fill-rose-500 text-rose-500 drop-shadow-xl"
          style={{ left: burst.x - 48, top: burst.y - 48 }}
          onAnimationEnd={() => setBurst(null)}
        />
      ) : null}

      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-linear-to-b from-black/55 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-linear-to-t from-black/90 via-black/40 to-transparent" />

      {active && muted ? (
        <button
          type="button"
          onClick={onUnmute}
          className="absolute start-1/2 top-[calc(max(0.6rem,env(safe-area-inset-top))+3.25rem)] z-10 inline-flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-white/90 px-3.5 py-1.5 text-xs font-bold text-slate-900 shadow-lg lg:top-4"
        >
          <VolumeX className="size-4" />
          {t("tapToUnmute")}
        </button>
      ) : null}

      {/* Right rail */}
      <div className="absolute bottom-[calc(8.5rem+env(safe-area-inset-bottom))] end-2.5 z-10 flex flex-col items-center gap-4 lg:bottom-28">
        {clip.store.hasPage ? (
          <div className="relative mb-2">
            <Link
              href={`/vendors/${clip.store.slug}`}
              aria-label={clip.store.name}
              className="flex size-12 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-linear-to-br from-rose-500 to-violet-600 text-sm font-bold shadow-lg"
            >
              {clip.store.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={clip.store.logo} alt="" className="size-full bg-white object-cover" />
              ) : (
                clip.store.name.trim().charAt(0)
              )}
            </Link>
            {!following ? (
              <button
                type="button"
                onClick={onFollow}
                aria-label={t("follow")}
                className="absolute -bottom-2 start-1/2 flex size-6 -translate-x-1/2 items-center justify-center rounded-full bg-rose-500 shadow-md ring-2 ring-black/20 transition-transform active:scale-90"
              >
                <Plus className="size-4" strokeWidth={3} />
              </button>
            ) : null}
          </div>
        ) : null}
        <RailAction label={t("like")} count={compact(counts.likeCount, locale)} onClick={() => onLike(!state.liked)} pressed={state.liked}>
          <Heart className={cn("size-8 transition-transform", state.liked ? "scale-110 fill-rose-500 text-rose-500" : "fill-white/10")} />
        </RailAction>
        <RailAction label={t("comments")} count={compact(counts.commentCount, locale)} onClick={onOpenComments} mobileOnly>
          <MessageCircle className="size-8 fill-white/10" />
        </RailAction>
        <RailAction
          label={state.saved ? t("unsave") : t("save")}
          count={compact(counts.saveCount, locale)}
          onClick={() => onSave(!state.saved)}
          pressed={state.saved}
        >
          <Bookmark className={cn("size-8", state.saved ? "fill-amber-400 text-amber-400" : "fill-white/10")} />
        </RailAction>
        <RailAction label={t("share")} count={compact(counts.shareCount, locale)} onClick={onShare}>
          <Share2 className="size-8" />
        </RailAction>
      </div>

      {/* Bottom: who, what, and the reviewed product */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 space-y-2.5 px-3.5 pb-[calc(1.1rem+env(safe-area-inset-bottom))] lg:px-4 lg:pb-5">
        <div className="pointer-events-auto pe-16">
          {clip.store.hasPage ? (
            <Link href={`/vendors/${clip.store.slug}`} className="inline-flex max-w-full items-center gap-1 text-base font-bold drop-shadow">
              <span className="truncate">@{clip.store.name}</span>
              <BadgeCheck className="size-4 shrink-0 text-sky-300" aria-hidden />
            </Link>
          ) : (
            <span className="inline-flex items-center gap-1 text-base font-bold">
              <Store className="size-4" />
              {clip.store.name}
            </span>
          )}
          {clip.title || clip.caption ? (
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              className={cn(
                "mt-1 block w-full text-start text-sm leading-relaxed text-white/95 drop-shadow",
                expanded ? "max-h-40 overflow-y-auto" : "line-clamp-2",
              )}
            >
              {clip.title ? <span className="font-semibold">{clip.title} </span> : null}
              {clip.caption}
            </button>
          ) : null}
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-white/75">
            {district ? (
              <Link href={`/zones/${clip.store.district}`} className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 font-medium text-white backdrop-blur">
                <MapPin className="size-3" />
                {district}
              </Link>
            ) : null}
            <span className="inline-flex items-center gap-1">
              <Eye className="size-3.5" />
              {t("viewsCount", { count: clip.viewCount })}
            </span>
            {clip.publishedAt ? <span>{timeAgo(clip.publishedAt, locale)}</span> : null}
          </p>
        </div>

        {/* Phones: the lead product, and the rest behind "+N" */}
        {lead ? (
          <div className="pointer-events-auto flex items-stretch gap-2 lg:hidden">
            <ProductPill product={lead} />
            {clip.products.length > 1 ? (
              <button
                type="button"
                onClick={onOpenProducts}
                className="flex w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-white/15 text-xs font-bold backdrop-blur-md"
              >
                <ShoppingBag className="size-5" />+{clip.products.length - 1}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Seekable progress line */}
      <div
        onClick={seek}
        className="group/bar absolute inset-x-0 bottom-0 z-20 flex h-3 cursor-pointer items-end"
        role="presentation"
      >
        <div className="h-[3px] w-full bg-white/20 transition-all group-hover/bar:h-1.5">
          <div ref={barRef} className="h-full w-0 bg-white" />
        </div>
      </div>
    </section>
  );
}

function RailAction({
  children,
  label,
  count,
  onClick,
  pressed,
  mobileOnly,
}: {
  children: React.ReactNode;
  label: string;
  count: string;
  onClick: () => void;
  pressed?: boolean;
  mobileOnly?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      className={cn(
        "flex flex-col items-center gap-0.5 drop-shadow-[0_1px_4px_rgba(0,0,0,0.6)] transition-transform active:scale-90",
        mobileOnly && "lg:hidden",
      )}
    >
      {children}
      <span className="text-xs font-bold">{count}</span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Desktop details                                                     */
/* ------------------------------------------------------------------ */

function DetailsPanel({
  clip,
  counts,
  following,
  signedIn,
  onFollow,
  onCount,
}: {
  clip: ClipFeedItem;
  counts: Counts;
  following: boolean;
  signedIn: boolean;
  onFollow: () => void;
  onCount: (id: string, count: number) => void;
}) {
  const t = useTranslations("clips");
  const locale = useLocale();
  const [tab, setTab] = useState<"products" | "comments">("products");
  const district = clip.store.district ? kalasinDistrictLabel(clip.store.district, locale) : "";

  return (
    <aside className="hidden w-[380px] shrink-0 flex-col overflow-hidden rounded-[28px] border bg-card shadow-sm lg:flex xl:w-[410px]">
      <div className="space-y-3 border-b p-5">
        <div className="flex items-center gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-linear-to-br from-rose-500 to-violet-600 text-base font-bold text-white">
            {clip.store.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={clip.store.logo} alt="" className="size-full bg-white object-cover" />
            ) : (
              clip.store.name.trim().charAt(0)
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 font-bold">
              <span className="truncate">{clip.store.name}</span>
              <BadgeCheck className="size-4 shrink-0 text-sky-500" />
            </p>
            {district ? (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="size-3" />
                {district}
              </p>
            ) : null}
          </div>
          {clip.store.hasPage ? (
            <button
              type="button"
              onClick={onFollow}
              className={cn(
                "h-9 shrink-0 rounded-full px-4 text-sm font-bold transition-colors",
                following ? "border bg-background text-foreground hover:bg-muted" : "bg-rose-500 text-white hover:bg-rose-600",
              )}
            >
              {following ? t("following") : t("follow")}
            </button>
          ) : null}
        </div>
        <div>
          {clip.title ? <h2 className="text-lg font-bold leading-snug">{clip.title}</h2> : null}
          {clip.caption ? (
            <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{clip.caption}</p>
          ) : null}
          <p className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Eye className="size-3.5" />
              {t("viewsCount", { count: clip.viewCount })}
            </span>
            <span className="inline-flex items-center gap-1">
              <Heart className="size-3.5" />
              {compact(counts.likeCount, locale)}
            </span>
            {clip.publishedAt ? <span>{timeAgo(clip.publishedAt, locale)}</span> : null}
          </p>
        </div>
        {clip.store.hasPage ? (
          <Link
            href={`/vendors/${clip.store.slug}`}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-rose-600 hover:underline"
          >
            <Store className="size-4" />
            {t("visitStore")}
          </Link>
        ) : null}
      </div>

      <div className="flex shrink-0 border-b px-2">
        {(
          [
            ["products", `${t("productsTab")} (${clip.products.length})`],
            ["comments", `${t("comments")} (${counts.commentCount})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "relative flex-1 py-3 text-sm font-bold transition-colors",
              tab === id ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
            {tab === id ? <span className="absolute inset-x-6 bottom-0 h-0.5 rounded-full bg-rose-500" /> : null}
          </button>
        ))}
      </div>

      {tab === "products" ? (
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
          {clip.products.map((product, index) => (
            <ProductRow key={product.id} product={product} index={index + 1} />
          ))}
        </div>
      ) : (
        <CommentsPanel clip={clip} signedIn={signedIn} onCount={onCount} />
      )}
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* Comments                                                            */
/* ------------------------------------------------------------------ */

/** Newest first, more on demand, and the box to write one. */
function CommentsPanel({
  clip,
  signedIn,
  onCount,
}: {
  clip: ClipFeedItem;
  signedIn: boolean;
  onCount: (id: string, count: number) => void;
}) {
  const t = useTranslations("clips");
  const locale = useLocale();
  const [comments, setComments] = useState<ClipComment[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const clipId = clip.id;
  const onCountRef = useRef(onCount);
  useEffect(() => {
    onCountRef.current = onCount;
  }, [onCount]);

  const load = useCallback(
    async (after: string | null) => {
      setLoading(true);
      try {
        const res = await fetch(`/api/clips/${clipId}/comments${after ? `?cursor=${after}` : ""}`, { cache: "no-store" });
        const json = await res.json();
        if (!json?.success) throw new Error();
        const page = json.data.items as ClipComment[];
        setComments((current) => (after ? [...current, ...page] : page));
        setCursor(json.data.nextCursor);
        onCountRef.current(clipId, json.data.total);
      } catch {
        toast.error(t("actionFailed"));
      } finally {
        setLoading(false);
      }
    },
    [clipId, t],
  );

  useEffect(() => {
    void load(null);
  }, [load]);

  const send = async () => {
    const message = text.trim();
    if (!message || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/clips/${clipId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: message }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.message);
      setComments((current) => [json.data.comment as ClipComment, ...current]);
      onCountRef.current(clipId, json.data.commentCount);
      setText("");
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : t("actionFailed"));
    } finally {
      setSending(false);
    }
  };

  const remove = async (comment: ClipComment) => {
    try {
      const res = await fetch(`/api/clips/${clipId}/comments/${comment.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error();
      setComments((current) => current.filter((c) => c.id !== comment.id));
      onCountRef.current(clipId, json.data.commentCount);
    } catch {
      toast.error(t("actionFailed"));
    }
  };

  return (
    <>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3">
        {comments.length === 0 && !loading ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
            <MessageCircle className="size-9 opacity-40" />
            <p className="text-sm">{t("commentsEmpty")}</p>
          </div>
        ) : null}
        {comments.map((comment) => (
          <div key={comment.id} className="flex gap-3">
            <span
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white",
                comment.creator ? "bg-linear-to-br from-rose-500 to-violet-600" : "bg-slate-400",
              )}
            >
              {comment.name.trim().charAt(0) || "?"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground/80">{comment.name || t("someone")}</span>
                {comment.creator ? (
                  <span className="rounded bg-rose-500 px-1.5 py-px text-[10px] font-bold text-white">{t("creator")}</span>
                ) : null}
              </p>
              <p className="mt-0.5 whitespace-pre-line break-words text-sm">{comment.text}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{comment.at ? timeAgo(comment.at, locale) : ""}</p>
            </div>
            {comment.mine ? (
              <button
                type="button"
                onClick={() => void remove(comment)}
                aria-label={t("deleteComment")}
                className="self-start rounded-full p-1.5 text-muted-foreground opacity-60 hover:bg-muted hover:text-red-600 hover:opacity-100"
              >
                <Trash2 className="size-4" />
              </button>
            ) : null}
          </div>
        ))}
        {loading ? (
          <div className="flex justify-center py-3">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : cursor ? (
          <button
            type="button"
            onClick={() => void load(cursor)}
            className="mx-auto block rounded-full px-4 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted"
          >
            {t("moreComments")}
          </button>
        ) : null}
      </div>
      <div className="shrink-0 border-t p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {signedIn ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
            className="flex items-center gap-2"
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={SHORT_CLIP_LIMITS.comment}
              placeholder={t("commentPlaceholder")}
              className="h-11 min-w-0 flex-1 rounded-full bg-muted px-4 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
            />
            <button
              type="submit"
              disabled={!text.trim() || sending}
              aria-label={t("send")}
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-rose-500 text-white disabled:opacity-40"
            >
              {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </button>
          </form>
        ) : (
          <Link
            href={`/login?redirect=${encodeURIComponent(`/clips?start=${clipId}`)}`}
            className="flex h-11 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground"
          >
            {t("loginToComment")}
          </Link>
        )}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Products                                                            */
/* ------------------------------------------------------------------ */

/**
 * Add a reviewed product to the cart, or buy it now in the checkout modal —
 * the clip stays where it was behind it.
 */
function useAddPinned(product: ClipFeedProduct) {
  const t = useTranslations();
  const { addItem } = useCartActions();
  const checkout = useEmbeddedCheckout();
  const [adding, setAdding] = useState<false | "cart" | "buy">(false);
  const put = () =>
    addItem({
      productId: product.id,
      variantId: product.variantId,
      name: product.variantName ? `${product.name} - ${product.variantName}` : product.name,
      price: product.price,
      image: product.image,
      quantity: 1,
    });
  const add = async () => {
    if (!product.quickAdd || adding) return;
    setAdding("cart");
    try {
      await put();
      toast.success(t("cart.itemAdded"));
    } catch (error) {
      toast.error(refusalMessage(error) ?? t("common.error"));
    } finally {
      setAdding(false);
    }
  };
  const buy = async () => {
    if (adding) return;
    if (!product.quickAdd) {
      if (checkout) checkout.open(`/products/${product.slug}`, "options");
      else window.location.href = `/products/${product.slug}`;
      return;
    }
    setAdding("buy");
    try {
      await put();
      if (checkout) checkout.open("/checkout");
      else window.location.href = "/checkout";
    } catch (error) {
      toast.error(refusalMessage(error) ?? t("common.error"));
    } finally {
      setAdding(false);
    }
  };
  return { add, buy, adding };
}

/** Phones: the clip's lead product over the video, with "buy now". */
function ProductPill({ product }: { product: ClipFeedProduct }) {
  const t = useTranslations("embeddedCheckout");
  const tc = useTranslations("clips");
  const { formatPrice } = useCurrency();
  const { buy, adding } = useAddPinned(product);
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2.5 rounded-2xl bg-white/95 p-1.5 pe-1.5 text-slate-900 shadow-xl backdrop-blur">
      <ProductLink slug={product.slug} className="flex min-w-0 flex-1 items-center gap-2.5 text-start">
        <span className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100">
          {product.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.image} alt="" className="size-full object-cover" />
          ) : (
            <Package className="size-5 text-slate-400" />
          )}
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-rose-500">
            <ShoppingBag className="size-3" />
            {tc("reviewedProduct")}
          </span>
          <span className="block truncate text-[13px] font-semibold leading-tight">{product.name}</span>
          <span className="flex items-baseline gap-1">
            <span className="text-sm font-bold text-rose-600">{formatPrice(product.price)}</span>
            {product.comparePrice ? (
              <span className="text-[11px] text-slate-400 line-through">{formatPrice(product.comparePrice)}</span>
            ) : null}
          </span>
        </span>
      </ProductLink>
      {product.available ? (
        <button
          type="button"
          onClick={() => void buy()}
          disabled={Boolean(adding)}
          className="flex h-10 shrink-0 items-center gap-1 rounded-xl bg-linear-to-br from-rose-500 to-red-600 px-3.5 text-sm font-bold text-white shadow-md transition-transform active:scale-95 disabled:opacity-60"
        >
          {adding === "buy" ? <Loader2 className="size-4 animate-spin" /> : null}
          {product.quickAdd ? t("buyNow") : tc("chooseOptions")}
        </button>
      ) : (
        <span className="shrink-0 rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-500">
          {tc("soldOut")}
        </span>
      )}
    </div>
  );
}

function ProductRow({ product, index }: { product: ClipFeedProduct; index: number }) {
  const t = useTranslations("embeddedCheckout");
  const tc = useTranslations("clips");
  const { formatPrice } = useCurrency();
  const { add, buy, adding } = useAddPinned(product);
  return (
    <div className="flex items-center gap-3 rounded-2xl border bg-card p-2">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-rose-500 text-xs font-bold text-white">
        {index}
      </span>
      <ProductLink slug={product.slug} className="flex min-w-0 flex-1 items-center gap-3 text-start">
        <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted">
          {product.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.image} alt="" className="size-full object-cover" />
          ) : (
            <Package className="size-5 text-muted-foreground" />
          )}
        </span>
        <span className="min-w-0">
          <span className="line-clamp-2 text-sm font-semibold leading-snug">{product.name}</span>
          <span className="flex items-baseline gap-1">
            <span className="text-sm font-bold text-rose-600">{formatPrice(product.price)}</span>
            {product.comparePrice ? (
              <span className="text-[11px] text-muted-foreground line-through">{formatPrice(product.comparePrice)}</span>
            ) : null}
          </span>
          {!product.available ? <span className="text-xs text-muted-foreground">{tc("soldOut")}</span> : null}
        </span>
      </ProductLink>
      {product.available ? (
        <span className="flex shrink-0 items-center gap-1.5">
          {product.quickAdd ? (
            <button
              type="button"
              onClick={() => void add()}
              disabled={Boolean(adding)}
              aria-label={t("addToCart")}
              title={t("addToCart")}
              className="flex size-10 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-600 disabled:opacity-60"
            >
              {adding === "cart" ? <Loader2 className="size-4 animate-spin" /> : <ShoppingBag className="size-4" />}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void buy()}
            disabled={Boolean(adding)}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-linear-to-r from-rose-500 to-red-600 px-3.5 text-sm font-bold text-white shadow-md disabled:opacity-60"
          >
            {adding === "buy" ? <Loader2 className="size-4 animate-spin" /> : null}
            {product.quickAdd ? t("buyNow") : tc("chooseOptions")}
          </button>
        </span>
      ) : null}
    </div>
  );
}
