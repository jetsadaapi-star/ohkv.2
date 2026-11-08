import { mongoose } from "@/lib/db";
import { SHORT_CLIP_STATUSES, SHORT_CLIP_LIMITS } from "@/lib/clips/clip-types";

const { Schema, models, model } = mongoose;

/**
 * A short video clip with products pinned to it ("ปักตะกร้า"): a store films
 * its OTOP goods, pins the ones in the clip, and shoppers add them to the cart
 * straight from the storefront's clip feed (/clips).
 *
 * Every clip belongs to one store. A store pins only its own products; the
 * marketplace's admins can make a clip for any store and take any clip down
 * (`hidden`), which a store cannot undo.
 */
const ShortClipSchema = new Schema(
  {
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
    },
    title: {
      type: String,
      trim: true,
      maxlength: SHORT_CLIP_LIMITS.title,
      default: "",
    },
    caption: {
      type: String,
      trim: true,
      maxlength: SHORT_CLIP_LIMITS.caption,
      default: "",
    },
    video: {
      url: { type: String, required: true },
      mimeType: { type: String, default: "video/mp4" },
      size: { type: Number },
      width: { type: Number },
      height: { type: Number },
    },
    /** A still shown before the video loads; the video's first frame otherwise. */
    posterUrl: { type: String, default: "" },
    /** Pinned products, in the order the store put them. */
    productIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "Product" }],
      default: [],
      validate: {
        validator: (ids: unknown[]) => ids.length <= SHORT_CLIP_LIMITS.products,
        message: `A clip pins at most ${SHORT_CLIP_LIMITS.products} products`,
      },
    },
    status: { type: String, enum: SHORT_CLIP_STATUSES, default: "draft" },
    /** First time it went live; the feed's order. */
    publishedAt: { type: Date, default: null },
    viewCount: { type: Number, default: 0 },
    /** Shopper engagement, kept as counters so the feed never counts rows. */
    likeCount: { type: Number, default: 0 },
    commentCount: { type: Number, default: 0 },
    saveCount: { type: Number, default: 0 },
    shareCount: { type: Number, default: 0 },
    /** Who made or last edited it, and from where. */
    createdBy: { type: String },
    updatedBy: { type: String },
    /** Set when an admin hides it, so the store sees why it went down. */
    hiddenReason: { type: String, default: "" },
  },
  { timestamps: true },
);

// The storefront feed: published clips, newest first.
ShortClipSchema.index({ status: 1, publishedAt: -1, _id: -1 });
// A store's own list in its dashboard.
ShortClipSchema.index({ vendorId: 1, updatedAt: -1 });
// "Clips that pin this product".
ShortClipSchema.index({ productIds: 1, status: 1 });

if (models.ShortClip) {
  delete models.ShortClip;
}

export const ShortClip = model("ShortClip", ShortClipSchema);

/** A shopper's heart or bookmark on a clip — one of each per shopper. */
const ClipReactionSchema = new Schema(
  {
    clipId: { type: Schema.Types.ObjectId, ref: "ShortClip", required: true },
    userId: { type: String, required: true },
    kind: { type: String, enum: ["like", "save"], required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
ClipReactionSchema.index({ clipId: 1, userId: 1, kind: 1 }, { unique: true });
// "My saved clips", newest first.
ClipReactionSchema.index({ userId: 1, kind: 1, _id: -1 });

if (models.ClipReaction) delete models.ClipReaction;
export const ClipReaction = model("ClipReaction", ClipReactionSchema);

/** A comment under a clip. */
const ClipCommentSchema = new Schema(
  {
    clipId: { type: Schema.Types.ObjectId, ref: "ShortClip", required: true },
    userId: { type: String, required: true },
    name: { type: String, maxlength: 80, default: "" },
    text: { type: String, maxlength: 300, required: true },
    /** Written by the store that made the clip. */
    creator: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
ClipCommentSchema.index({ clipId: 1, _id: -1 });

if (models.ClipComment) delete models.ClipComment;
export const ClipComment = model("ClipComment", ClipCommentSchema);
