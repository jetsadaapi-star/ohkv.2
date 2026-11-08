/**
 * Gifts a viewer can send a store during its live. Client-safe.
 *
 * Gifts are free for now, with limits (see LIVE_GIFT_LIMITS). Each carries a
 * `coins` price so paid gifts can come later without changing the shape:
 * every gift sent is already recorded (LiveGift) with the coins it cost.
 *
 * Tier sets how loud it is: 1 slides in beside the chat, 2 also pops in the
 * middle of the picture, 3 takes the whole screen for a moment.
 */

export type LiveGiftTier = 1 | 2 | 3;

export interface LiveGiftDef {
  id: string;
  emoji: string;
  tier: LiveGiftTier;
  /** Price in coins; 0 while gifts are free. */
  coins: number;
  /** Tailwind gradient for its tile and banner. */
  tone: string;
}

export const LIVE_GIFTS: readonly LiveGiftDef[] = [
  { id: "rose", emoji: "🌹", tier: 1, coins: 0, tone: "from-rose-500 to-red-600" },
  { id: "heart", emoji: "💖", tier: 1, coins: 0, tone: "from-pink-500 to-rose-500" },
  { id: "lotus", emoji: "🪷", tier: 1, coins: 0, tone: "from-fuchsia-400 to-pink-500" },
  { id: "silk", emoji: "🧣", tier: 2, coins: 0, tone: "from-[#8a2c1d] to-[#c0662b]" },
  { id: "dino", emoji: "🦕", tier: 2, coins: 0, tone: "from-emerald-500 to-teal-600" },
  { id: "elephant", emoji: "🐘", tier: 2, coins: 0, tone: "from-slate-500 to-indigo-600" },
  { id: "crown", emoji: "👑", tier: 3, coins: 0, tone: "from-amber-400 to-orange-500" },
  { id: "bangfai", emoji: "🚀", tier: 3, coins: 0, tone: "from-orange-500 to-red-600" },
] as const;

export const LIVE_GIFT_IDS = LIVE_GIFTS.map((gift) => gift.id);

export function liveGift(id: string | undefined | null): LiveGiftDef | undefined {
  return id ? LIVE_GIFTS.find((gift) => gift.id === id) : undefined;
}

export const LIVE_GIFT_LIMITS = {
  /** Gifts one request may carry (taps of the same gift are batched). */
  batch: 10,
  /** Gifts one viewer may send to one live per minute, all kinds together. */
  perMinute: 30,
  /** Seconds between two gifts of the same tier from one viewer. */
  cooldownSeconds: { 1: 0, 2: 15, 3: 60 } as Record<LiveGiftTier, number>,
  /** How many supporters the room shows. */
  topSupporters: 3,
} as const;
