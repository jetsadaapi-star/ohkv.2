import "server-only";
import * as z from "zod";
import { Types } from "mongoose";
import { PRODUCT_STATUS, VENDOR_STATUS } from "@/config/app.config";
import { ValidationError, NotFoundError, AuthorizationError } from "@/lib/api/errors";
import { connectDB } from "@/lib/db";
import { getStorageConfig } from "@/lib/storage";
import { getStorefrontProductConstraint } from "@/lib/catalog/product-visibility";
import { getProductPriceRange } from "@/lib/products/price-display";
import {
  productOnlyVariant,
  productRequiresVariantSelection,
} from "@/lib/products/variant-selection";
import { isProductAvailable } from "@/lib/products/stock-policy";
import { isQuoteOnlyProduct } from "@/lib/products/quote-pricing";
import { getPrimaryProductMedia } from "@/lib/products/card-media";
import { PRODUCT_CARD_SELECT } from "@/lib/products/storefront-product-cards";
import type { ModernProduct } from "@/lib/products/modern-product";
import { ClipComment, ClipReaction, Product, ShortClip, Vendor, VendorFollow } from "@/models";
import {
  SHORT_CLIP_LIMITS,
  type ClipComment as ClipCommentItem,
  type ClipDashboardItem,
  type ClipViewerState,
  type ClipFeedItem,
  type ClipFeedProduct,
  type ClipProductSummary,
  type ShortClipStatus,
} from "@/lib/clips/clip-types";

/**
 * Short clips with pinned products — the dashboards' writes and the
 * storefront feed's read. Every rule about who may do what lives here, so the
 * store's and the admin's routes cannot drift apart.
 */

const objectId = z
  .string()
  .refine((value) => Types.ObjectId.isValid(value), { message: "Invalid id" });

export const ClipInputSchema = z.object({
  title: z.string().trim().max(SHORT_CLIP_LIMITS.title).optional(),
  caption: z.string().trim().max(SHORT_CLIP_LIMITS.caption).optional(),
  videoUrl: z.string().trim().min(1, "Upload a video for the clip").max(2048),
  videoMimeType: z.string().max(80).optional(),
  videoSize: z.number().nonnegative().optional(),
  videoWidth: z.number().nonnegative().optional(),
  videoHeight: z.number().nonnegative().optional(),
  posterUrl: z.string().trim().max(2048).optional(),
  productIds: z
    .array(objectId)
    .max(SHORT_CLIP_LIMITS.products, `Pin at most ${SHORT_CLIP_LIMITS.products} products`)
    .default([]),
  status: z.enum(["draft", "published"]).default("draft"),
});
export type ClipInput = z.infer<typeof ClipInputSchema>;

/** The admin's form also names the store, and may take a clip down. */
export const AdminClipInputSchema = ClipInputSchema.extend({
  vendorId: objectId,
  status: z.enum(["draft", "published", "hidden"]).default("draft"),
  hiddenReason: z.string().trim().max(300).optional(),
});
export type AdminClipInput = z.infer<typeof AdminClipInputSchema>;

/** What a write takes from either form: the store's (no take-down) or the admin's. */
type ClipWriteInput = Omit<ClipInput, "status"> & {
  status: ShortClipStatus;
  vendorId?: string;
  hiddenReason?: string;
};

/**
 * Media must be a file in this store's own storage. Anything else would let a
 * clip play — and the feed hotlink — whatever URL someone typed.
 */
async function assertOwnMediaUrl(url: string, label: string) {
  const config = await getStorageConfig();
  const base = (config.publicUrl || "").replace(/\/+$/, "");
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ValidationError(`${label} is not a valid link`);
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new ValidationError(`${label} is not a valid link`);
  }
  if (base && !url.startsWith(`${base}/`)) {
    throw new ValidationError(`${label} must be uploaded to the store's media storage`);
  }
}

type ProductLean = {
  _id: Types.ObjectId;
  vendorId?: Types.ObjectId;
  name?: string;
  title?: string;
  slug?: string;
  status?: string;
  images?: string[];
  media?: Array<{ type?: string; url?: string; thumbnailUrl?: string }>;
  price?: number;
  priceRange?: { min?: number; max?: number };
};

function productImage(product: ProductLean): string | undefined {
  const media = getPrimaryProductMedia(product as unknown as ModernProduct);
  if (media?.type === "image" && media.url) return media.url;
  return media?.thumbnailUrl || product.images?.[0] || undefined;
}

function productSummary(product: ProductLean): ClipProductSummary {
  return {
    id: String(product._id),
    name: product.name || product.title || "",
    slug: product.slug || "",
    image: productImage(product),
    price: getProductPriceRange(product as unknown as ModernProduct).min,
    status: product.status,
  };
}

/** The pinned products, which must all be the store's own; their order is kept. */
async function resolveOwnProducts(
  vendorId: Types.ObjectId,
  productIds: string[],
): Promise<Types.ObjectId[]> {
  const unique = [...new Set(productIds)];
  if (unique.length === 0) return [];
  const found = await Product.find({
    _id: { $in: unique.map((id) => new Types.ObjectId(id)) },
    vendorId,
  })
    .select("_id")
    .lean<Array<{ _id: Types.ObjectId }>>();
  if (found.length !== unique.length) {
    throw new ValidationError("A clip can only pin products from its own store");
  }
  return unique.map((id) => new Types.ObjectId(id));
}

type ClipLean = {
  _id: Types.ObjectId;
  vendorId: Types.ObjectId;
  title?: string;
  caption?: string;
  video?: { url?: string; mimeType?: string };
  posterUrl?: string;
  productIds?: Types.ObjectId[];
  status: ShortClipStatus;
  hiddenReason?: string;
  viewCount?: number;
  likeCount?: number;
  commentCount?: number;
  saveCount?: number;
  shareCount?: number;
  publishedAt?: Date | null;
  updatedAt?: Date;
};

async function toDashboardItems(clips: ClipLean[]): Promise<ClipDashboardItem[]> {
  const vendorIds = [...new Set(clips.map((clip) => String(clip.vendorId)))];
  const productIds = [
    ...new Set(clips.flatMap((clip) => (clip.productIds ?? []).map(String))),
  ];
  const [vendors, products] = await Promise.all([
    Vendor.find({ _id: { $in: vendorIds } })
      .select("storeName district")
      .lean<Array<{ _id: Types.ObjectId; storeName: string; district?: string }>>(),
    productIds.length
      ? Product.find({ _id: { $in: productIds } })
          .select("name title slug status images media price priceRange variants options")
          .lean<ProductLean[]>()
      : Promise.resolve([] as ProductLean[]),
  ]);
  const vendorById = new Map(vendors.map((v) => [String(v._id), v]));
  const productById = new Map(products.map((p) => [String(p._id), productSummary(p)]));

  return clips.map((clip) => {
    const vendor = vendorById.get(String(clip.vendorId));
    return {
      id: String(clip._id),
      vendorId: String(clip.vendorId),
      vendorName: vendor?.storeName ?? "",
      vendorDistrict: vendor?.district,
      title: clip.title ?? "",
      caption: clip.caption ?? "",
      videoUrl: clip.video?.url ?? "",
      videoMimeType: clip.video?.mimeType ?? "video/mp4",
      posterUrl: clip.posterUrl ?? "",
      products: (clip.productIds ?? [])
        .map((id) => productById.get(String(id)))
        .filter((p): p is ClipProductSummary => Boolean(p)),
      status: clip.status,
      hiddenReason: clip.hiddenReason ?? "",
      viewCount: clip.viewCount ?? 0,
      publishedAt: clip.publishedAt ? new Date(clip.publishedAt).toISOString() : null,
      updatedAt: clip.updatedAt ? new Date(clip.updatedAt).toISOString() : "",
    };
  });
}

export async function listClips(options: {
  vendorId?: string;
  status?: ShortClipStatus;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<{ items: ClipDashboardItem[]; total: number; page: number; limit: number }> {
  await connectDB();
  const page = Math.max(1, Math.floor(options.page ?? 1));
  const limit = Math.min(60, Math.max(1, Math.floor(options.limit ?? 24)));
  const query: Record<string, unknown> = {};
  if (options.vendorId) query.vendorId = new Types.ObjectId(options.vendorId);
  if (options.status) query.status = options.status;
  if (options.search?.trim()) {
    const escaped = options.search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    query.$or = [
      { title: { $regex: escaped, $options: "i" } },
      { caption: { $regex: escaped, $options: "i" } },
    ];
  }
  const [clips, total] = await Promise.all([
    ShortClip.find(query)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean<ClipLean[]>(),
    ShortClip.countDocuments(query),
  ]);
  return { items: await toDashboardItems(clips), total, page, limit };
}

export async function getClip(id: string, scope: { vendorId?: string } = {}) {
  await connectDB();
  if (!Types.ObjectId.isValid(id)) throw new NotFoundError("Clip");
  const clip = await ShortClip.findById(id).lean<ClipLean | null>();
  if (!clip || (scope.vendorId && String(clip.vendorId) !== scope.vendorId)) {
    throw new NotFoundError("Clip");
  }
  const [item] = await toDashboardItems([clip]);
  return item;
}

async function buildFields(vendorId: Types.ObjectId, input: Omit<ClipInput, "status"> & { status: "draft" | "published" }) {
  await assertOwnMediaUrl(input.videoUrl, "The video");
  if (input.posterUrl) await assertOwnMediaUrl(input.posterUrl, "The cover image");
  const productIds = await resolveOwnProducts(vendorId, input.productIds);
  if (input.status === "published" && productIds.length === 0) {
    throw new ValidationError("Pin at least one product before publishing the clip");
  }
  return {
    title: input.title ?? "",
    caption: input.caption ?? "",
    video: {
      url: input.videoUrl,
      mimeType: input.videoMimeType || "video/mp4",
      ...(input.videoSize ? { size: input.videoSize } : {}),
      ...(input.videoWidth ? { width: input.videoWidth } : {}),
      ...(input.videoHeight ? { height: input.videoHeight } : {}),
    },
    posterUrl: input.posterUrl ?? "",
    productIds,
  };
}

async function requireVendor(vendorId: string) {
  const vendor = await Vendor.findById(vendorId).select("_id status").lean<{
    _id: Types.ObjectId;
    status?: string;
  } | null>();
  if (!vendor) throw new NotFoundError("Store");
  return vendor;
}

export async function createClip(
  input: ClipWriteInput & { vendorId: string },
  actorId: string,
) {
  await connectDB();
  const vendor = await requireVendor(input.vendorId);
  const fields = await buildFields(vendor._id, {
    ...input,
    status: input.status === "hidden" ? "draft" : input.status,
  });
  const clip = await ShortClip.create({
    ...fields,
    vendorId: vendor._id,
    status: input.status,
    hiddenReason: input.status === "hidden" ? input.hiddenReason ?? "" : "",
    publishedAt: input.status === "published" ? new Date() : null,
    createdBy: actorId,
    updatedBy: actorId,
  });
  return getClip(String(clip._id));
}

export async function updateClip(
  id: string,
  input: ClipWriteInput,
  actor: { id: string; isAdmin: boolean; vendorId?: string },
) {
  await connectDB();
  if (!Types.ObjectId.isValid(id)) throw new NotFoundError("Clip");
  const clip = await ShortClip.findById(id);
  if (!clip) throw new NotFoundError("Clip");
  if (!actor.isAdmin && String(clip.vendorId) !== actor.vendorId) {
    throw new NotFoundError("Clip");
  }
  // An admin's take-down stands until an admin lifts it.
  if (!actor.isAdmin && clip.status === "hidden") {
    throw new AuthorizationError(
      "This clip was taken down by the marketplace. Contact the marketplace to restore it.",
    );
  }
  if (!actor.isAdmin && input.status === "hidden") {
    throw new AuthorizationError("Only the marketplace can take a clip down");
  }

  const vendorId =
    actor.isAdmin && input.vendorId ? new Types.ObjectId(input.vendorId) : clip.vendorId;
  if (actor.isAdmin && input.vendorId) await requireVendor(input.vendorId);
  const fields = await buildFields(vendorId as Types.ObjectId, {
    ...input,
    status: input.status === "hidden" ? "draft" : input.status,
  });

  clip.set({
    ...fields,
    vendorId,
    status: input.status,
    hiddenReason: input.status === "hidden" ? input.hiddenReason ?? "" : "",
    updatedBy: actor.id,
  });
  if (input.status === "published" && !clip.publishedAt) clip.publishedAt = new Date();
  await clip.save();
  return getClip(id);
}

export async function deleteClip(id: string, scope: { vendorId?: string } = {}) {
  await connectDB();
  if (!Types.ObjectId.isValid(id)) throw new NotFoundError("Clip");
  const clip = await ShortClip.findById(id).select("vendorId").lean<ClipLean | null>();
  if (!clip || (scope.vendorId && String(clip.vendorId) !== scope.vendorId)) {
    throw new NotFoundError("Clip");
  }
  await Promise.all([
    ShortClip.deleteOne({ _id: clip._id }),
    ClipReaction.deleteMany({ clipId: clip._id }),
    ClipComment.deleteMany({ clipId: clip._id }),
  ]);
}

/* ------------------------------------------------------------------ */
/* Storefront feed                                                     */
/* ------------------------------------------------------------------ */

function encodeCursor(clip: { publishedAt?: Date | null; _id: Types.ObjectId }) {
  const at = clip.publishedAt ? new Date(clip.publishedAt).getTime() : 0;
  return Buffer.from(`${at}:${String(clip._id)}`).toString("base64url");
}

function decodeCursor(cursor: string | null | undefined) {
  if (!cursor) return null;
  try {
    const [at, id] = Buffer.from(cursor, "base64url").toString("utf8").split(":");
    const time = Number(at);
    if (!Number.isFinite(time) || !Types.ObjectId.isValid(id)) return null;
    return { publishedAt: new Date(time), id: new Types.ObjectId(id) };
  } catch {
    return null;
  }
}

function feedProduct(product: ModernProduct): ClipFeedProduct {
  const available = isProductAvailable(product, product.stock);
  const onlyVariant = productOnlyVariant(product);
  const quoteOnly = isQuoteOnlyProduct(product);
  const range = getProductPriceRange(product);
  const media = getPrimaryProductMedia(product);
  return {
    id: String(product._id),
    name: product.name,
    slug: product.slug,
    image:
      media?.type === "image"
        ? media.url
        : media?.thumbnailUrl || product.images?.[0] || undefined,
    price: onlyVariant?.price ?? range.min,
    comparePrice:
      typeof product.comparePrice === "number" && product.comparePrice > range.min
        ? product.comparePrice
        : undefined,
    quickAdd: available && !quoteOnly && !productRequiresVariantSelection(product),
    variantId: onlyVariant?._id ? String(onlyVariant._id) : undefined,
    variantName: onlyVariant?.name,
    available,
  };
}

type FeedVendor = {
  _id: Types.ObjectId;
  storeName: string;
  slug: string;
  logo?: string;
  district?: string;
  isDefault?: boolean;
};

/** Clips as the feed plays them: each with its pinned products still on sale. */
async function toFeedItems(clips: ClipLean[], vendorById: Map<string, FeedVendor>): Promise<ClipFeedItem[]> {
  const productIds = [...new Set(clips.flatMap((c) => (c.productIds ?? []).map(String)))];
  const products = productIds.length
    ? await Product.find({
        _id: { $in: productIds.map((id) => new Types.ObjectId(id)) },
        status: PRODUCT_STATUS.ACTIVE,
        ...(await getStorefrontProductConstraint()),
      })
        .select(PRODUCT_CARD_SELECT)
        .lean<ModernProduct[]>()
    : [];
  const productById = new Map(products.map((p) => [String(p._id), feedProduct(p)]));

  const items: ClipFeedItem[] = [];
  for (const clip of clips) {
    const vendor = vendorById.get(String(clip.vendorId));
    if (!vendor || !clip.video?.url) continue;
    const pinned = (clip.productIds ?? [])
      .map((id) => productById.get(String(id)))
      .filter((p): p is ClipFeedProduct => Boolean(p));
    if (pinned.length === 0) continue;
    items.push({
      id: String(clip._id),
      title: clip.title ?? "",
      caption: clip.caption ?? "",
      videoUrl: clip.video.url,
      videoMimeType: clip.video.mimeType ?? "video/mp4",
      posterUrl: clip.posterUrl ?? "",
      viewCount: clip.viewCount ?? 0,
      likeCount: clip.likeCount ?? 0,
      commentCount: clip.commentCount ?? 0,
      saveCount: clip.saveCount ?? 0,
      shareCount: clip.shareCount ?? 0,
      publishedAt: clip.publishedAt ? new Date(clip.publishedAt).toISOString() : null,
      store: {
        name: vendor.storeName,
        slug: vendor.slug,
        logo: vendor.logo || undefined,
        district: vendor.district,
        hasPage: !vendor.isDefault,
      },
      products: pinned,
    });
  }

  return items;
}

/**
 * Published clips, newest first, from stores a shopper can buy from — each
 * with only the pinned products still on sale. A clip whose every pin has gone
 * stays out: a "buy from this video" with nothing to buy is a dead end.
 */
export async function listClipFeed(options: {
  cursor?: string | null;
  limit?: number;
  startId?: string | null;
}): Promise<{ items: ClipFeedItem[]; nextCursor: string | null }> {
  await connectDB();
  const limit = Math.min(12, Math.max(1, options.limit ?? SHORT_CLIP_LIMITS.feedPage));
  const liveVendors = await Vendor.find({
    status: VENDOR_STATUS.APPROVED,
    storeActive: { $ne: false },
  })
    .select("_id storeName slug logo district isDefault")
    .lean<
      Array<{
        _id: Types.ObjectId;
        storeName: string;
        slug: string;
        logo?: string;
        district?: string;
        isDefault?: boolean;
      }>
    >();
  const vendorById = new Map(liveVendors.map((v) => [String(v._id), v]));

  const after = decodeCursor(options.cursor);
  const query: Record<string, unknown> = {
    status: "published",
    vendorId: { $in: liveVendors.map((v) => v._id) },
  };
  if (after) {
    query.$or = [
      { publishedAt: { $lt: after.publishedAt } },
      { publishedAt: after.publishedAt, _id: { $lt: after.id } },
    ];
  }

  // A shared link opens on its own clip first, then continues the feed.
  const startClip =
    !after && options.startId && Types.ObjectId.isValid(options.startId)
      ? await ShortClip.findOne({
          _id: new Types.ObjectId(options.startId),
          status: "published",
          vendorId: { $in: liveVendors.map((v) => v._id) },
        }).lean<ClipLean | null>()
      : null;

  const batch = await ShortClip.find(
    startClip ? { ...query, _id: { $ne: startClip._id } } : query,
  )
    .sort({ publishedAt: -1, _id: -1 })
    .limit(limit + 1)
    .lean<ClipLean[]>();
  const hasMore = batch.length > limit;
  const page = batch.slice(0, limit);
  const clips = startClip ? [startClip, ...page] : page;

  const items = await toFeedItems(clips, vendorById);
  const last = page[page.length - 1];
  return { items, nextCursor: hasMore && last ? encodeCursor(last) : null };
}

/** One view, counted once the clip has actually played for a moment. */
export async function recordClipView(id: string) {
  if (!Types.ObjectId.isValid(id)) return;
  await connectDB();
  await ShortClip.updateOne(
    { _id: new Types.ObjectId(id), status: "published" },
    { $inc: { viewCount: 1 } },
  );
}

/* ------------------------------------------------------------------ */
/* Engagement: hearts, saves, shares, comments                         */
/* ------------------------------------------------------------------ */

async function requirePublishedClip(id: string) {
  if (!Types.ObjectId.isValid(id)) throw new NotFoundError("Clip");
  await connectDB();
  const clip = await ShortClip.findOne({ _id: new Types.ObjectId(id), status: "published" })
    .select("_id vendorId")
    .lean<{ _id: Types.ObjectId; vendorId: Types.ObjectId } | null>();
  if (!clip) throw new NotFoundError("Clip");
  return clip;
}

const COUNTER: Record<"like" | "save", "likeCount" | "saveCount"> = {
  like: "likeCount",
  save: "saveCount",
};

/**
 * Heart or bookmark a clip (or take it back). Idempotent: the reaction row is
 * unique per shopper, and the counter moves only when a row was really added
 * or removed.
 */
export async function setClipReaction(
  id: string,
  userId: string,
  kind: "like" | "save",
  on: boolean,
): Promise<{ on: boolean; count: number }> {
  const clip = await requirePublishedClip(id);
  const field = COUNTER[kind];
  if (on) {
    const result = await ClipReaction.updateOne(
      { clipId: clip._id, userId, kind },
      { $setOnInsert: { clipId: clip._id, userId, kind } },
      { upsert: true },
    );
    if (result.upsertedCount) await ShortClip.updateOne({ _id: clip._id }, { $inc: { [field]: 1 } });
  } else {
    const result = await ClipReaction.deleteOne({ clipId: clip._id, userId, kind });
    if (result.deletedCount) {
      await ShortClip.updateOne({ _id: clip._id, [field]: { $gt: 0 } }, { $inc: { [field]: -1 } });
    }
  }
  const fresh = await ShortClip.findById(clip._id).select(field).lean<Record<string, number> | null>();
  return { on, count: fresh?.[field] ?? 0 };
}

/** Which of these clips the shopper has hearted or saved. */
export async function getClipViewerStates(
  userId: string,
  ids: string[],
): Promise<Record<string, ClipViewerState>> {
  const valid = ids.filter((id) => Types.ObjectId.isValid(id)).slice(0, 50);
  if (valid.length === 0) return {};
  await connectDB();
  const rows = await ClipReaction.find({
    userId,
    clipId: { $in: valid.map((id) => new Types.ObjectId(id)) },
  })
    .select("clipId kind")
    .lean<Array<{ clipId: Types.ObjectId; kind: "like" | "save" }>>();
  const states: Record<string, ClipViewerState> = {};
  for (const id of valid) states[id] = { liked: false, saved: false };
  for (const row of rows) {
    const state = states[String(row.clipId)];
    if (!state) continue;
    if (row.kind === "like") state.liked = true;
    else state.saved = true;
  }
  return states;
}

/** The shopper's saved clips, most recently saved first. */
export async function listSavedClips(userId: string): Promise<ClipFeedItem[]> {
  await connectDB();
  const saves = await ClipReaction.find({ userId, kind: "save" })
    .sort({ _id: -1 })
    .limit(60)
    .select("clipId")
    .lean<Array<{ clipId: Types.ObjectId }>>();
  if (saves.length === 0) return [];
  const [clips, vendors] = await Promise.all([
    ShortClip.find({ _id: { $in: saves.map((s) => s.clipId) }, status: "published" }).lean<ClipLean[]>(),
    Vendor.find({ status: VENDOR_STATUS.APPROVED, storeActive: { $ne: false } })
      .select("_id storeName slug logo district isDefault")
      .lean<FeedVendor[]>(),
  ]);
  const order = new Map(saves.map((s, i) => [String(s.clipId), i]));
  clips.sort((a, b) => (order.get(String(a._id)) ?? 0) - (order.get(String(b._id)) ?? 0));
  return toFeedItems(clips, new Map(vendors.map((v) => [String(v._id), v])));
}

/** Counted when a shopper shares (or copies the link to) a clip. */
export async function recordClipShare(id: string) {
  const clip = await requirePublishedClip(id);
  const fresh = await ShortClip.findOneAndUpdate(
    { _id: clip._id },
    { $inc: { shareCount: 1 } },
    { new: true, projection: { shareCount: 1 } },
  ).lean<{ shareCount?: number } | null>();
  return { shareCount: fresh?.shareCount ?? 0 };
}

type CommentLean = {
  _id: Types.ObjectId;
  userId: string;
  name?: string;
  text: string;
  creator?: boolean;
  createdAt?: Date;
};

function commentItem(row: CommentLean, viewerId?: string | null): ClipCommentItem {
  return {
    id: String(row._id),
    name: row.name ?? "",
    text: row.text,
    creator: row.creator === true,
    mine: Boolean(viewerId && row.userId === viewerId),
    at: row.createdAt ? new Date(row.createdAt).toISOString() : "",
  };
}

/** A page of a clip's comments, newest first. */
export async function listClipComments(
  id: string,
  options: { cursor?: string | null; viewerId?: string | null },
): Promise<{ items: ClipCommentItem[]; nextCursor: string | null; total: number }> {
  const clip = await requirePublishedClip(id);
  const query: Record<string, unknown> = { clipId: clip._id };
  if (options.cursor && Types.ObjectId.isValid(options.cursor)) {
    query._id = { $lt: new Types.ObjectId(options.cursor) };
  }
  const limit = SHORT_CLIP_LIMITS.commentsPage;
  const [rows, fresh] = await Promise.all([
    ClipComment.find(query).sort({ _id: -1 }).limit(limit + 1).lean<CommentLean[]>(),
    ShortClip.findById(clip._id).select("commentCount").lean<{ commentCount?: number } | null>(),
  ]);
  const page = rows.slice(0, limit);
  return {
    items: page.map((row) => commentItem(row, options.viewerId)),
    nextCursor: rows.length > limit ? String(page[page.length - 1]._id) : null,
    total: fresh?.commentCount ?? 0,
  };
}

export async function addClipComment(
  id: string,
  user: { id: string; name?: string | null },
  text: string,
): Promise<{ comment: ClipCommentItem; commentCount: number }> {
  const clip = await requirePublishedClip(id);
  const clean = text.replace(/\s+/g, " ").trim().slice(0, SHORT_CLIP_LIMITS.comment);
  if (!clean) throw new ValidationError("Write a comment first");
  const store = await Vendor.findOne({ _id: clip.vendorId, userId: user.id })
    .select("storeName")
    .lean<{ storeName?: string } | null>();
  const row = await ClipComment.create({
    clipId: clip._id,
    userId: user.id,
    name: store?.storeName || (user.name || "").trim().slice(0, 40),
    text: clean,
    creator: Boolean(store),
  });
  const fresh = await ShortClip.findOneAndUpdate(
    { _id: clip._id },
    { $inc: { commentCount: 1 } },
    { new: true, projection: { commentCount: 1 } },
  ).lean<{ commentCount?: number } | null>();
  return {
    comment: commentItem(row.toObject() as CommentLean, user.id),
    commentCount: fresh?.commentCount ?? 0,
  };
}

/** The writer may delete their comment; so may the marketplace. */
export async function deleteClipComment(
  id: string,
  commentId: string,
  actor: { id: string; isAdmin: boolean },
): Promise<{ commentCount: number }> {
  if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(commentId)) throw new NotFoundError("Comment");
  await connectDB();
  const row = await ClipComment.findOne({ _id: new Types.ObjectId(commentId), clipId: new Types.ObjectId(id) })
    .select("userId")
    .lean<{ userId: string } | null>();
  if (!row) throw new NotFoundError("Comment");
  if (!actor.isAdmin && row.userId !== actor.id) {
    throw new AuthorizationError("You can only delete your own comments");
  }
  await ClipComment.deleteOne({ _id: new Types.ObjectId(commentId) });
  const fresh = await ShortClip.findOneAndUpdate(
    { _id: new Types.ObjectId(id), commentCount: { $gt: 0 } },
    { $inc: { commentCount: -1 } },
    { new: true, projection: { commentCount: 1 } },
  ).lean<{ commentCount?: number } | null>();
  return { commentCount: fresh?.commentCount ?? 0 };
}

/** Which of these stores (by slug) the shopper follows. */
export async function getFollowedStores(userId: string, slugs: string[]): Promise<Record<string, boolean>> {
  const unique = [...new Set(slugs.map((s) => s.toLowerCase()).filter(Boolean))].slice(0, 50);
  if (unique.length === 0) return {};
  await connectDB();
  const vendors = await Vendor.find({ slug: { $in: unique } })
    .select("_id slug")
    .lean<Array<{ _id: Types.ObjectId; slug: string }>>();
  const follows = await VendorFollow.find({ userId, vendorId: { $in: vendors.map((v) => v._id) } })
    .select("vendorId")
    .lean<Array<{ vendorId: Types.ObjectId }>>();
  const followed = new Set(follows.map((f) => String(f.vendorId)));
  const result: Record<string, boolean> = {};
  for (const vendor of vendors) result[vendor.slug] = followed.has(String(vendor._id));
  return result;
}
