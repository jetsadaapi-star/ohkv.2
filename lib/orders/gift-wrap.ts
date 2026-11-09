/**
 * Gift wrapping at checkout (Settings → Orders → Gift wrapping): the shopper
 * ticks it, may add a message for the recipient, and each parcel is wrapped
 * by whoever packs it — so the fee, when the store charges one, is added to
 * each parcel's delivery charge. That keeps it inside the one delivery figure
 * every checkout path (web, app, card, cash on delivery) already prices,
 * books and refunds, and in a marketplace the seller who wraps is the seller
 * who is paid for it.
 *
 * Client-safe: the checkout reads the same rules.
 */

export const GIFT_MESSAGE_MAX = 200;

export interface GiftWrapConfig {
  enabled: boolean;
  /** Per parcel, in the store currency; 0 wraps for free. */
  fee: number;
  allowMessage: boolean;
}

export function giftWrapConfigOf(
  settings: { orders?: { giftWrap?: Partial<GiftWrapConfig> | null } | null } | null | undefined,
): GiftWrapConfig {
  const stored = settings?.orders?.giftWrap;
  const fee = Number(stored?.fee);
  return {
    enabled: stored?.enabled === true,
    fee: Number.isFinite(fee) && fee > 0 ? Math.min(100_000, Math.round(fee * 100) / 100) : 0,
    allowMessage: stored?.allowMessage !== false,
  };
}

/** What the shopper chose, as the cart holds it. */
export interface CartGiftWrap {
  enabled?: boolean;
  message?: string;
}

/**
 * The fee per parcel this cart is charged, or 0: wrapping is off for the
 * store, unticked, or free.
 */
export function cartGiftWrapFee(
  settings: Parameters<typeof giftWrapConfigOf>[0],
  cart: { giftWrap?: CartGiftWrap | null } | null | undefined,
): number {
  const config = giftWrapConfigOf(settings);
  return config.enabled && cart?.giftWrap?.enabled ? config.fee : 0;
}

/** The gift as the order records it, or undefined when there is none. */
export function orderGiftWrapOf(
  settings: Parameters<typeof giftWrapConfigOf>[0],
  cart: { giftWrap?: CartGiftWrap | null } | null | undefined,
): { enabled: true; message?: string; fee: number } | undefined {
  const config = giftWrapConfigOf(settings);
  if (!config.enabled || !cart?.giftWrap?.enabled) return undefined;
  const message = config.allowMessage ? cart.giftWrap.message?.trim().slice(0, GIFT_MESSAGE_MAX) : undefined;
  return { enabled: true, fee: config.fee, ...(message ? { message } : {}) };
}
