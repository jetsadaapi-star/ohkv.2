import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";

/**
 * A Flash Sale: chosen products at a percentage off for a set window, each
 * optionally limited to a number of units (lib/catalog/flash-sales.ts).
 *
 * The sale price is written onto the product for the window, the way a live
 * selling deal is, so every price the store shows and charges — cards, the
 * product page, the cart, checkout — is the sale price without any of them
 * knowing about sales. `priceSnapshot` keeps what to put back.
 *
 * A sale is the marketplace's own (no `vendorId`: Admin → Flash Sale, any
 * product) or one store's (`vendorId`: Vendor → Flash Sale, that store's
 * products alone, inside the limits Admin → Flash Sale sets).
 */

export const FLASH_SALE_STATES = ["scheduled", "live", "ended", "cancelled"] as const;
export type FlashSaleState = (typeof FLASH_SALE_STATES)[number];

export interface IFlashSaleItem {
  productId: Types.ObjectId;
  /** 1–90 percent off every variant's regular price. */
  discountPercent: number;
  /** Units sold at the sale price before it ends for this product; null = no cap. */
  quantityLimit?: number | null;
  /** Units ordered since the sale started (refreshed every minute). */
  soldCount: number;
  /** The cap was reached (or the product was already on a live deal) and its price went back. */
  endedEarly: boolean;
  /** Why it was not, or is no longer, on sale. */
  skippedReason?: "live_deal" | "sold_out" | "missing";
}

export interface IFlashSaleSnapshot {
  productId: Types.ObjectId;
  price?: number;
  comparePrice?: number | null;
  salePrice?: number;
  variants?: Array<{
    variantId: Types.ObjectId;
    price?: number;
    comparePrice?: number | null;
    salePrice?: number;
  }>;
}

export interface IFlashSale extends Document {
  name: string;
  startsAt: Date;
  endsAt: Date;
  state: FlashSaleState;
  items: IFlashSaleItem[];
  priceSnapshot: IFlashSaleSnapshot[];
  /** The store running it; absent for the marketplace's own sales. */
  vendorId?: Types.ObjectId | null;
  createdByUserId?: Types.ObjectId;
  startedAt?: Date;
  endedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const FlashSaleItemSchema = new Schema<IFlashSaleItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    discountPercent: { type: Number, required: true, min: 1, max: 90 },
    quantityLimit: { type: Number, min: 1, default: null },
    soldCount: { type: Number, min: 0, default: 0 },
    endedEarly: { type: Boolean, default: false },
    skippedReason: { type: String, enum: ["live_deal", "sold_out", "missing"] },
  },
  { _id: false },
);

const SnapshotVariantSchema = new Schema(
  {
    variantId: { type: Schema.Types.ObjectId, required: true },
    price: Number,
    comparePrice: { type: Number, default: null },
    salePrice: Number,
  },
  { _id: false },
);

const SnapshotSchema = new Schema<IFlashSaleSnapshot>(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    price: Number,
    comparePrice: { type: Number, default: null },
    salePrice: Number,
    variants: { type: [SnapshotVariantSchema], default: undefined },
  },
  { _id: false },
);

const FlashSaleSchema = new Schema<IFlashSale>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    state: { type: String, enum: FLASH_SALE_STATES, default: "scheduled", required: true },
    items: { type: [FlashSaleItemSchema], default: [] },
    priceSnapshot: { type: [SnapshotSchema], default: [] },
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor", default: null },
    createdByUserId: { type: Schema.Types.ObjectId, ref: "User" },
    startedAt: Date,
    endedAt: Date,
  },
  { timestamps: true },
);

// The sweep's two questions: what should start, what should end.
FlashSaleSchema.index({ state: 1, startsAt: 1 });
FlashSaleSchema.index({ state: 1, endsAt: 1 });
FlashSaleSchema.index({ "items.productId": 1, state: 1 });
FlashSaleSchema.index({ vendorId: 1, startsAt: -1 });

export const FlashSale: Model<IFlashSale> =
  mongoose.models.FlashSale || mongoose.model<IFlashSale>("FlashSale", FlashSaleSchema);
