import { mongoose } from "@/lib/db";
import { LIVE_LIMITS, LIVE_STATUSES } from "@/lib/live/live-types";

const { Schema, models, model } = mongoose;

/**
 * A store's live selling session: the store streams its camera, adds its own
 * products to the live (each with an optional live-only discount), pins the
 * one it is talking about, and viewers chat, send hearts and buy.
 *
 * Live prices are real prices while the live is on air: starting the live
 * writes the discounted price onto the product (remembering the old one in
 * `priceSnapshot`), and ending it puts the old price back. That way the cart,
 * checkout and payment routes — which all price from the product — charge
 * exactly what the live shows, with no special case of their own.
 */
const LiveProductSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    discountPercent: { type: Number, min: 0, max: LIVE_LIMITS.maxDiscount, default: 0 },
  },
  { _id: false },
);

const PriceSnapshotSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, required: true },
    price: { type: Number },
    comparePrice: { type: Number, default: null },
    /** The price the live wrote, so a price the store changed meanwhile is left alone. */
    livePrice: { type: Number },
    variants: [
      {
        _id: false,
        variantId: { type: Schema.Types.ObjectId },
        price: { type: Number },
        comparePrice: { type: Number, default: null },
        livePrice: { type: Number },
      },
    ],
  },
  { _id: false },
);

const LiveSessionSchema = new Schema(
  {
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor", required: true },
    title: { type: String, trim: true, maxlength: LIVE_LIMITS.title, required: true },
    description: { type: String, trim: true, maxlength: LIVE_LIMITS.description, default: "" },
    coverUrl: { type: String, default: "" },
    status: { type: String, enum: LIVE_STATUSES, default: "scheduled" },
    scheduledAt: { type: Date, default: null },
    startedAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
    endedReason: { type: String, default: "" },
    /** Secret the store publishes with (browser or OBS). Never sent to viewers. */
    streamKey: { type: String, required: true, select: false },
    products: {
      type: [LiveProductSchema],
      default: [],
      validate: {
        validator: (rows: unknown[]) => rows.length <= LIVE_LIMITS.products,
        message: `A live holds at most ${LIVE_LIMITS.products} products`,
      },
    },
    pinnedProductId: { type: Schema.Types.ObjectId, default: null },
    /** Bumped whenever products or their prices change, so viewers refetch them. */
    productsVersion: { type: Number, default: 1 },
    priceSnapshot: { type: [PriceSnapshotSchema], default: [] },
    likeCount: { type: Number, default: 0 },
    peakViewers: { type: Number, default: 0 },
    /** Everyone who watched (one per player that joined), for the "most watched" ranking. */
    totalViews: { type: Number, default: 0 },
    /** Last time the store's studio checked in; a silent live is ended. */
    lastHeartbeatAt: { type: Date, default: null },
    createdBy: { type: String },
  },
  { timestamps: true },
);

LiveSessionSchema.index({ status: 1, startedAt: -1 });
LiveSessionSchema.index({ status: 1, scheduledAt: 1 });
LiveSessionSchema.index({ vendorId: 1, updatedAt: -1 });
// The storefront's most-watched lives.
LiveSessionSchema.index({ status: 1, totalViews: -1 });

if (models.LiveSession) delete models.LiveSession;
export const LiveSession = model("LiveSession", LiveSessionSchema);

/** One line of a live's chat (or a system line such as "pinned …"). */
const LiveChatMessageSchema = new Schema(
  {
    sessionId: { type: Schema.Types.ObjectId, ref: "LiveSession", required: true },
    userId: { type: String, default: null },
    name: { type: String, maxlength: 80, default: "" },
    text: { type: String, maxlength: LIVE_LIMITS.chatText, required: true },
    kind: { type: String, enum: ["chat", "system"], default: "chat" },
    host: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
LiveChatMessageSchema.index({ sessionId: 1, _id: 1 });
// Chat is only for the moment; a month later it is gone.
LiveChatMessageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

if (models.LiveChatMessage) delete models.LiveChatMessage;
export const LiveChatMessage = model("LiveChatMessage", LiveChatMessageSchema);

/** Who is watching: one row per open player, refreshed by its polls. */
const LivePresenceSchema = new Schema({
  sessionId: { type: Schema.Types.ObjectId, required: true },
  viewerId: { type: String, required: true },
  lastSeen: { type: Date, default: Date.now },
});
LivePresenceSchema.index({ sessionId: 1, viewerId: 1 }, { unique: true });
LivePresenceSchema.index({ sessionId: 1, lastSeen: -1 });
LivePresenceSchema.index({ lastSeen: 1 }, { expireAfterSeconds: 120 });

if (models.LivePresence) delete models.LivePresence;
export const LivePresence = model("LivePresence", LivePresenceSchema);
