import { mongoose } from "@/lib/db";

const { Schema, models, model } = mongoose;

/**
 * One movement of a customer's loyalty points, for the history they and the
 * admins read. The balance itself lives on the CustomerProfile
 * (`loyaltyPoints`, `lifetimePoints`); this is the account of how it got
 * there, written beside every change the programme makes:
 *
 * - `earn`     a paid order's points (the order's `loyalty` record is the claim);
 * - `reverse`  points a refund took back;
 * - `redeem`   points turned into store credit (`storeCreditId`);
 * - `adjust`   an admin set the balance by hand.
 *
 * `points` is signed: what the balance moved by.
 */
export const LOYALTY_TRANSACTION_TYPES = ["earn", "reverse", "redeem", "adjust"] as const;
export type LoyaltyTransactionType = (typeof LOYALTY_TRANSACTION_TYPES)[number];

export interface ILoyaltyTransaction {
  _id: mongoose.Types.ObjectId;
  /** The account; absent for a guest checkout's email-keyed profile. */
  userId?: mongoose.Types.ObjectId;
  /** A guest checkout's email, when there is no account. */
  guestEmail?: string;
  type: LoyaltyTransactionType;
  points: number;
  orderId?: mongoose.Types.ObjectId;
  orderNumber?: string;
  /** The store credit lot a redemption gave. */
  storeCreditId?: mongoose.Types.ObjectId;
  /** The credit a redemption gave, in `currency`. */
  creditAmount?: number;
  currency?: string;
  /** The tier bonus an order earned at, in percent. */
  bonusPercent?: number;
  note?: string;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const LoyaltyTransactionSchema = new Schema<ILoyaltyTransaction>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    guestEmail: { type: String, trim: true, lowercase: true },
    type: { type: String, enum: LOYALTY_TRANSACTION_TYPES, required: true },
    points: { type: Number, required: true },
    orderId: { type: Schema.Types.ObjectId, ref: "Order" },
    orderNumber: { type: String, trim: true },
    storeCreditId: { type: Schema.Types.ObjectId, ref: "StoreCreditTransaction" },
    creditAmount: { type: Number, min: 0 },
    currency: { type: String, uppercase: true, trim: true },
    bonusPercent: { type: Number, min: 0 },
    note: { type: String, trim: true, maxlength: 500 },
    createdBy: { type: String, trim: true },
  },
  { timestamps: true },
);

LoyaltyTransactionSchema.index({ userId: 1, createdAt: -1 });
LoyaltyTransactionSchema.index({ guestEmail: 1, createdAt: -1 }, { sparse: true });
LoyaltyTransactionSchema.index({ orderId: 1, type: 1 }, { sparse: true });

export const LoyaltyTransaction =
  models.LoyaltyTransaction ||
  model<ILoyaltyTransaction>("LoyaltyTransaction", LoyaltyTransactionSchema);
