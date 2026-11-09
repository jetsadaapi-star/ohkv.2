import type { LoyaltyTier } from "@/types";

/**
 * The loyalty rules, with no database in sight.
 *
 * Deliberately free of `server-only` and of any import beyond the shared types,
 * exactly as `lib/order-payment-status.ts` is: the same thresholds decide what
 * the write path stores (`lib/customer.ts`), what the backfill reconstructs,
 * and what the admin customer form previews in the browser. A client component
 * cannot import `lib/customer.ts` — it pulls in Mongoose — so the rules live
 * here and that module re-exports them.
 */

/**
 * Whether the loyalty programme is on: Settings → Loyalty points
 * (`settings.loyalty.enabled`). `NEXT_PUBLIC_LOYALTY_ENABLED=true`, the old
 * build-time switch, still turns it on.
 *
 * Off, paid orders earn nothing and every loyalty screen stays out of sight;
 * points already earned keep following refunds (`reverseOrderLoyaltyPoints`
 * is never gated). Client components read the same answer through
 * `useAppSettings().loyaltyEnabled`.
 */
export function loyaltyEnabledIn(
  settings: { loyalty?: { enabled?: boolean | null } | null } | null | undefined,
): boolean {
  return (
    settings?.loyalty?.enabled === true ||
    process.env.NEXT_PUBLIC_LOYALTY_ENABLED === "true"
  );
}

export const LOYALTY_TIERS_ORDER: readonly LoyaltyTier[] = [
  "bronze",
  "silver",
  "gold",
  "platinum",
];

/** The programme's rules, every value usable — see `loyaltyRulesOf`. */
export interface LoyaltyRules {
  enabled: boolean;
  /** Store-currency spend for one point. */
  spendPerPoint: number;
  /** `redeemPoints` points become `redeemValue` of store credit. */
  redeemPoints: number;
  redeemValue: number;
  /** The fewest points one redemption takes. */
  minRedeemPoints: number;
  /** Days a redemption's credit lasts; 0 never expires. */
  creditExpiryDays: number;
  /** Extra points, in percent, per tier (bronze earns the base rate). */
  tierBonus: Record<Exclude<LoyaltyTier, "bronze">, number>;
}

export const DEFAULT_LOYALTY_RULES: LoyaltyRules = {
  enabled: false,
  spendPerPoint: 25,
  redeemPoints: 100,
  redeemValue: 25,
  minRedeemPoints: 100,
  creditExpiryDays: 365,
  tierBonus: { silver: 10, gold: 25, platinum: 50 },
};

function positive(value: unknown, fallback: number, max = 1_000_000): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.min(max, n) : fallback;
}

function nonNegative(value: unknown, fallback: number, max: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.min(max, n) : fallback;
}

/** The rules as stored, each value checked, defaults where one is missing. */
export function loyaltyRulesOf(
  settings:
    | {
        loyalty?: {
          enabled?: boolean | null;
          spendPerPoint?: number | null;
          redeemPoints?: number | null;
          redeemValue?: number | null;
          minRedeemPoints?: number | null;
          creditExpiryDays?: number | null;
          tierBonus?: { silver?: number | null; gold?: number | null; platinum?: number | null } | null;
        } | null;
      }
    | null
    | undefined,
): LoyaltyRules {
  const stored = settings?.loyalty;
  const d = DEFAULT_LOYALTY_RULES;
  const redeemPoints = Math.floor(positive(stored?.redeemPoints, d.redeemPoints));
  return {
    enabled: loyaltyEnabledIn(settings),
    spendPerPoint: positive(stored?.spendPerPoint, d.spendPerPoint),
    redeemPoints,
    redeemValue: positive(stored?.redeemValue, d.redeemValue),
    minRedeemPoints: Math.max(
      redeemPoints,
      Math.floor(positive(stored?.minRedeemPoints, d.minRedeemPoints)),
    ),
    creditExpiryDays: Math.floor(nonNegative(stored?.creditExpiryDays, d.creditExpiryDays, 3650)),
    tierBonus: {
      silver: nonNegative(stored?.tierBonus?.silver, d.tierBonus.silver, 1000),
      gold: nonNegative(stored?.tierBonus?.gold, d.tierBonus.gold, 1000),
      platinum: nonNegative(stored?.tierBonus?.platinum, d.tierBonus.platinum, 1000),
    },
  };
}

/** How many times the base rate a tier earns: 1 for bronze, 1.25 for +25%. */
export function tierEarnMultiplier(tier: LoyaltyTier | string | null | undefined, rules: LoyaltyRules): number {
  if (tier === "silver" || tier === "gold" || tier === "platinum") {
    return 1 + rules.tierBonus[tier] / 100;
  }
  return 1;
}

/**
 * The spend per point a customer of `tier` earns at. Stamped on the order as
 * its `loyalty.spendPerPoint`, so a refund takes back exactly what the order
 * earned, bonus included (`orderSpendPerPoint`).
 */
export function tierSpendPerPoint(tier: LoyaltyTier | string | null | undefined, rules: LoyaltyRules): number {
  return Number((rules.spendPerPoint / tierEarnMultiplier(tier, rules)).toPrecision(12));
}

/** The store credit `points` turn into, to two decimals. */
export function pointsToCredit(points: number, rules: LoyaltyRules): number {
  const blocks = Math.floor(Math.max(0, points) / rules.redeemPoints);
  return Math.round(blocks * rules.redeemValue * 100) / 100;
}

/** The most of a balance one redemption can take: whole blocks, or 0 below the minimum. */
export function redeemableOf(balance: number, rules: LoyaltyRules): number {
  const most = Math.floor(Math.max(0, balance) / rules.redeemPoints) * rules.redeemPoints;
  return most >= rules.minRedeemPoints ? most : 0;
}

/** The next tier up and the lifetime points it takes, or null at the top. */
export function nextLoyaltyTier(
  lifetimePoints: number,
): { tier: LoyaltyTier; at: number; remaining: number } | null {
  const current = computeLoyaltyTier(lifetimePoints);
  const index = LOYALTY_TIERS_ORDER.indexOf(current);
  const next = LOYALTY_TIERS_ORDER[index + 1];
  if (!next) return null;
  const at = LOYALTY_THRESHOLDS[next];
  return { tier: next, at, remaining: Math.max(0, at - lifetimePoints) };
}

/**
 * Loyalty tier thresholds based on lifetime points
 */
export const LOYALTY_THRESHOLDS = {
  bronze: 0,
  silver: 500,
  gold: 2000,
  platinum: 5000,
} as const;

/**
 * Compute the loyalty tier based on lifetime points earned
 */
export function computeLoyaltyTier(lifetimePoints: number): LoyaltyTier {
  if (lifetimePoints >= LOYALTY_THRESHOLDS.platinum) return "platinum";
  if (lifetimePoints >= LOYALTY_THRESHOLDS.gold) return "gold";
  if (lifetimePoints >= LOYALTY_THRESHOLDS.silver) return "silver";
  return "bronze";
}

/**
 * {@link computeLoyaltyTier} expressed for MongoDB, so a balance change and the
 * tier it implies land in a single write.
 *
 * The write path uses THIS, never the function above — so the function being
 * green in a unit test proves nothing about what customers are actually
 * assigned. `tests/customer-loyalty.test.ts` evaluates this expression against
 * the function at every threshold boundary to keep the pair honest.
 */
export const LOYALTY_TIER_SWITCH = {
  $switch: {
    branches: [
      {
        case: { $gte: ["$lifetimePoints", LOYALTY_THRESHOLDS.platinum] },
        then: "platinum",
      },
      {
        case: { $gte: ["$lifetimePoints", LOYALTY_THRESHOLDS.gold] },
        then: "gold",
      },
      {
        case: { $gte: ["$lifetimePoints", LOYALTY_THRESHOLDS.silver] },
        then: "silver",
      },
    ],
    default: "bronze",
  },
} as const;

/**
 * How much a customer spends, in the store currency, for each point — the
 * store's `orders.loyaltySpendPerPoint`.
 *
 * Points used to be one per whole currency unit, which is a dollar in one
 * store and a taka in another. The tiers above are counted in points, so a
 * single 5,000৳ order made a taka store's customer Platinum. The default keeps
 * that rule for the stores it suits; a taka store sets 100 and its customers
 * climb the tiers at the pace a dollar store's do.
 */
export const DEFAULT_LOYALTY_SPEND_PER_POINT = 1;
export const MIN_LOYALTY_SPEND_PER_POINT = 0.01;
export const MAX_LOYALTY_SPEND_PER_POINT = 1_000_000;

/** A usable rate: a positive, finite amount, or the default. */
export function normalizeSpendPerPoint(value: unknown): number {
  const rate = Number(value);
  return Number.isFinite(rate) && rate > 0 ? rate : DEFAULT_LOYALTY_SPEND_PER_POINT;
}

/**
 * The whole points in an amount. Trimmed the way `roundMoney` trims, so 0.3 at
 * 0.1 per point is 3 points rather than the 2 that binary floating point would
 * floor it to.
 */
function wholePoints(amount: number, spendPerPoint: number): number {
  const points = Number((amount / normalizeSpendPerPoint(spendPerPoint)).toPrecision(12));
  return Math.max(0, Math.floor(points));
}

/**
 * The rate an order earns at: the one stamped on it when its points were
 * awarded, one point per unit for an order awarded before stores had a rate,
 * and today's rate for an order not awarded yet.
 *
 * Reversals and the backfill read it, so a rate changed later never re-prices
 * points already given: a refund takes back what the order earned, not what it
 * would earn today.
 */
export function orderSpendPerPoint(
  loyalty:
    | { pointsAwarded?: number | null; spendPerPoint?: number | null }
    | null
    | undefined,
  storeSpendPerPoint: unknown,
): number {
  if (loyalty?.spendPerPoint != null) {
    return normalizeSpendPerPoint(loyalty.spendPerPoint);
  }
  if (loyalty?.pointsAwarded != null) return DEFAULT_LOYALTY_SPEND_PER_POINT;
  return normalizeSpendPerPoint(storeSpendPerPoint);
}

/**
 * Compute loyalty points earned from an order total: one for every
 * `spendPerPoint` spent, whole points only.
 */
export function computePointsFromOrder(
  orderTotal: number,
  spendPerPoint: number = DEFAULT_LOYALTY_SPEND_PER_POINT,
): number {
  return wholePoints(orderTotal, spendPerPoint);
}

/**
 * Return the additional points that must be reversed after cumulative refunds.
 * The whole-point calculation ensures several fractional refunds never exceed
 * the immutable point credit earned by the order.
 */
export function computeRefundPointDelta(
  pointsAwarded: number,
  pointsReversed: number,
  refundedTotal: number,
  /** The rate the order earned at — see `orderSpendPerPoint`. */
  spendPerPoint: number = DEFAULT_LOYALTY_SPEND_PER_POINT,
): number {
  const refundedPoints = wholePoints(Math.max(0, refundedTotal), spendPerPoint);
  // SIGNED, deliberately. What this answers is "how far is `pointsReversed`
  // from what the refunded total implies", and that gap can point either way:
  // a refund the gateway later rejected takes the order's refunded total back
  // down, and the points it took off the shopper have to follow it.
  //
  // Clamping at zero meant they never did. The refund failed, the shopper was
  // never paid, and they were still short the points — silently, because
  // nothing reports a balance that only ever moves one way.
  return (
    Math.min(Math.max(0, pointsAwarded), refundedPoints) -
    Math.max(0, pointsReversed)
  );
}

/**
 * The profile fields an admin's hand-set balance writes, or null when the
 * balance did not change (the customer forms send the loaded balance back
 * with every save).
 *
 * Lifetime points move by the same difference, so a bonus counts toward the
 * tier and a correction takes it back — and a customer who has redeemed
 * points (balance below lifetime) keeps their tier when the admin saves
 * something else on the page.
 */
export function balanceEditFields(
  before: { loyaltyPoints?: number | null; lifetimePoints?: number | null } | null | undefined,
  nextBalance: number,
): { loyaltyPoints: number; lifetimePoints: number; loyaltyTier: LoyaltyTier } | null {
  const balance = Math.max(0, Math.floor(nextBalance));
  const previous = Math.max(0, Math.floor(before?.loyaltyPoints ?? 0));
  if (balance === previous) return null;
  const lifetime = Math.max(
    balance,
    Math.max(0, Math.floor(before?.lifetimePoints ?? 0)) + (balance - previous),
  );
  return { loyaltyPoints: balance, lifetimePoints: lifetime, loyaltyTier: computeLoyaltyTier(lifetime) };
}
