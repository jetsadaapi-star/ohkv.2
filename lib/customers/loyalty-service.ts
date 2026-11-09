import "server-only";

import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { ValidationError } from "@/lib/api/errors";
import { CustomerProfile } from "@/models";
import { getSettingsLean } from "@/models/settings.model";
import { LoyaltyTransaction, type ILoyaltyTransaction } from "@/models/loyalty-transaction.model";
import { issueStoreCredit } from "@/lib/store-credit/store-credit";
import {
  LOYALTY_THRESHOLDS,
  computeLoyaltyTier,
  loyaltyRulesOf,
  nextLoyaltyTier,
  pointsToCredit,
  redeemableOf,
  tierEarnMultiplier,
  type LoyaltyRules,
} from "@/lib/customers/loyalty";
import type { LoyaltyTier } from "@/types";

/**
 * The customer's side of the loyalty programme: what they hold, what it is
 * worth, how they got it, and turning it into store credit.
 *
 * A redemption takes the points off the balance with one conditional write
 * (never below what is there, so two clicks cannot spend the same points)
 * and then gives the credit, keyed on the history row so a retry gives it
 * once. Should the credit fail, the points go back. Lifetime points — which
 * decide the tier — never move: spending points does not cost a tier.
 */

export interface LoyaltyHistoryRow {
  id: string;
  type: ILoyaltyTransaction["type"];
  points: number;
  orderId?: string;
  orderNumber?: string;
  creditAmount?: number;
  currency?: string;
  bonusPercent?: number;
  note?: string;
  createdAt: string;
}

export interface LoyaltyOverview {
  enabled: boolean;
  rules: LoyaltyRules;
  currency: string;
  balance: number;
  lifetimePoints: number;
  tier: LoyaltyTier;
  /** Percent extra this tier earns. */
  tierBonusPercent: number;
  next: { tier: LoyaltyTier; at: number; remaining: number } | null;
  thresholds: typeof LOYALTY_THRESHOLDS;
  /** The most one redemption can take now, and the credit it gives. */
  redeemable: number;
  redeemableCredit: number;
  history: LoyaltyHistoryRow[];
}

function storeCurrency(settings: { general?: { defaultCurrency?: string } } | null | undefined) {
  return String(settings?.general?.defaultCurrency || "USD").toUpperCase();
}

function historyRow(row: ILoyaltyTransaction): LoyaltyHistoryRow {
  return {
    id: String(row._id),
    type: row.type,
    points: row.points,
    orderId: row.orderId ? String(row.orderId) : undefined,
    orderNumber: row.orderNumber || undefined,
    creditAmount: row.creditAmount ?? undefined,
    currency: row.currency || undefined,
    bonusPercent: row.bonusPercent ?? undefined,
    note: row.note || undefined,
    createdAt: new Date(row.createdAt).toISOString(),
  };
}

export async function loyaltyHistory(
  filter: { userId?: string; guestEmail?: string },
  limit = 50,
): Promise<LoyaltyHistoryRow[]> {
  await connectDB();
  const query: Record<string, unknown> = {};
  if (filter.userId && Types.ObjectId.isValid(filter.userId)) {
    query.userId = new Types.ObjectId(filter.userId);
  } else if (filter.guestEmail) {
    query.guestEmail = filter.guestEmail.trim().toLowerCase();
    query.userId = { $exists: false };
  } else {
    return [];
  }
  const rows = await LoyaltyTransaction.find(query)
    .sort({ createdAt: -1, _id: -1 })
    .limit(Math.min(200, Math.max(1, limit)))
    .lean<ILoyaltyTransaction[]>();
  return rows.map(historyRow);
}

export async function getLoyaltyOverview(userId: string): Promise<LoyaltyOverview> {
  await connectDB();
  const settings = await getSettingsLean();
  const rules = loyaltyRulesOf(settings);
  const profile = Types.ObjectId.isValid(userId)
    ? await CustomerProfile.findOne({ userId: new Types.ObjectId(userId) })
        .select("loyaltyPoints lifetimePoints loyaltyTier")
        .lean<{ loyaltyPoints?: number; lifetimePoints?: number; loyaltyTier?: LoyaltyTier } | null>()
    : null;
  const balance = Math.max(0, Math.floor(profile?.loyaltyPoints ?? 0));
  const lifetimePoints = Math.max(0, Math.floor(profile?.lifetimePoints ?? 0));
  const tier = profile?.loyaltyTier || computeLoyaltyTier(lifetimePoints);
  const redeemable = redeemableOf(balance, rules);
  return {
    enabled: rules.enabled,
    rules,
    currency: storeCurrency(settings),
    balance,
    lifetimePoints,
    tier,
    tierBonusPercent: Math.round((tierEarnMultiplier(tier, rules) - 1) * 100),
    next: nextLoyaltyTier(lifetimePoints),
    thresholds: LOYALTY_THRESHOLDS,
    redeemable,
    redeemableCredit: pointsToCredit(redeemable, rules),
    history: rules.enabled ? await loyaltyHistory({ userId }) : [],
  };
}

/** Turn `points` of a customer's balance into store credit. */
export async function redeemLoyaltyPoints(params: {
  userId: string;
  points: number;
}): Promise<{ points: number; credit: number; currency: string; balance: number }> {
  await connectDB();
  const settings = await getSettingsLean();
  const rules = loyaltyRulesOf(settings);
  if (!rules.enabled) {
    throw new ValidationError({ points: ["The loyalty programme is not running"] });
  }
  if (!Types.ObjectId.isValid(params.userId)) {
    throw new ValidationError({ points: ["Sign in to redeem points"] });
  }
  const points = Math.floor(Number(params.points));
  if (!Number.isFinite(points) || points < rules.minRedeemPoints) {
    throw new ValidationError({
      points: [`Redeem at least ${rules.minRedeemPoints} points`],
    });
  }
  if (points % rules.redeemPoints !== 0) {
    throw new ValidationError({
      points: [`Redeem points in steps of ${rules.redeemPoints}`],
    });
  }
  const credit = pointsToCredit(points, rules);
  if (!(credit > 0)) throw new ValidationError({ points: ["Those points are worth nothing yet"] });
  const currency = storeCurrency(settings);
  const userId = new Types.ObjectId(params.userId);

  // Taken first, and only while the balance covers it.
  const taken = await CustomerProfile.findOneAndUpdate(
    { userId, loyaltyPoints: { $gte: points } },
    { $inc: { loyaltyPoints: -points }, $set: { lastActiveAt: new Date() } },
    { new: true, projection: { loyaltyPoints: 1 } },
  ).lean<{ loyaltyPoints?: number } | null>();
  if (!taken) {
    throw new ValidationError({ points: ["You don't have that many points"] });
  }

  const row = await LoyaltyTransaction.create({
    userId,
    type: "redeem",
    points: -points,
    creditAmount: credit,
    currency,
  });
  try {
    const expiresAt =
      rules.creditExpiryDays > 0
        ? new Date(Date.now() + rules.creditExpiryDays * 24 * 60 * 60 * 1000)
        : null;
    const lot = await issueStoreCredit({
      customerId: userId,
      currency,
      amount: credit,
      expiresAt,
      source: "loyalty",
      note: `${points} points`,
      idempotencyKey: `loyalty:${String(row._id)}`,
    });
    await LoyaltyTransaction.updateOne({ _id: row._id }, { $set: { storeCreditId: lot._id } });
    // A cost of the store's own promotion, owed to the shopper until spent.
    const { postStoreCreditEventSafely } = await import("@/lib/finance/post-events");
    postStoreCreditEventSafely(lot);
  } catch (error) {
    // No credit, so the points go back and the history forgets the try.
    await CustomerProfile.updateOne({ userId }, { $inc: { loyaltyPoints: points } });
    await LoyaltyTransaction.deleteOne({ _id: row._id });
    throw error;
  }

  return { points, credit, currency, balance: Math.max(0, taken.loyaltyPoints ?? 0) };
}

/**
 * An admin set a customer's balance by hand: the difference goes into the
 * history. Lifetime points and the tier follow the change the way the admin
 * screens always have.
 */
export async function recordLoyaltyAdjustment(params: {
  userId?: string | null;
  guestEmail?: string | null;
  before: number;
  after: number;
  createdBy?: string;
}) {
  const delta = Math.floor(params.after) - Math.floor(params.before);
  if (!delta) return;
  const owner =
    params.userId && Types.ObjectId.isValid(params.userId)
      ? { userId: new Types.ObjectId(params.userId) }
      : params.guestEmail
        ? { guestEmail: params.guestEmail.trim().toLowerCase() }
        : null;
  if (!owner) return;
  try {
    await connectDB();
    await LoyaltyTransaction.create({
      ...owner,
      type: "adjust",
      points: delta,
      createdBy: params.createdBy,
    });
  } catch (error) {
    console.error("Failed to record a loyalty adjustment:", error);
  }
}
