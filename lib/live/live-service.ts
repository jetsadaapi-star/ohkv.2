import "server-only";
import { randomBytes, timingSafeEqual } from "node:crypto";
import * as z from "zod";
import { Types } from "mongoose";
import { PRODUCT_STATUS, VENDOR_STATUS } from "@/config/app.config";
import { AuthorizationError, NotFoundError, ValidationError } from "@/lib/api/errors";
import { connectDB } from "@/lib/db";
import { getStorageConfig } from "@/lib/storage";
import { revalidateProductContent } from "@/lib/cache-invalidation";
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
import { Product, Vendor } from "@/models";
import { syncProductAggregates } from "@/models/product.model";
import { LiveChatMessage, LiveGift, LivePresence, LiveSession } from "@/models/live-session.model";
import { LIVE_GIFT_LIMITS, liveGift } from "@/lib/live/live-gifts";
import {
  LIVE_LIMITS,
  type LiveCard,
  type LiveChatItem,
  type LiveDashboardItem,
  type LiveProductSummary,
  type LiveRoom,
  type LiveRoomState,
  type LiveShopProduct,
  type LiveStatus,
  type LiveStoreInfo,
  type LiveSupporter,
  type LiveStudioCredentials,
} from "@/lib/live/live-types";

/**
 * Live selling: the stores' dashboards, the storefront's rooms, and the media
 * server's permission checks. Every rule about a live lives here.
 */

/* ------------------------------------------------------------------ */
/* Configuration                                                       */
/* ------------------------------------------------------------------ */

const trimSlash = (value: string) => value.replace(/\/+$/, "");

/** Where browsers reach the media server (WHIP / WHEP). */
export function liveMediaPublicUrl() {
  return trimSlash(process.env.LIVE_MEDIA_PUBLIC_URL || "http://localhost:8889");
}
function liveRtmpPublicUrl() {
  return trimSlash(process.env.LIVE_RTMP_PUBLIC_URL || "rtmp://localhost:1935");
}
function liveMediaApiUrl() {
  return trimSlash(process.env.LIVE_MEDIA_API_URL || "http://localhost:9997");
}
const mediaPath = (id: string) => `live/${id}`;

/** A store that has not checked in for this long, and has no stream, is ended. */
const STALE_AFTER_MS = 60_000;
/** A viewer counts while its player polled within this window. */
const VIEWER_WINDOW_MS = 20_000;

/* ------------------------------------------------------------------ */
/* Input                                                               */
/* ------------------------------------------------------------------ */

const objectId = z
  .string()
  .refine((value) => Types.ObjectId.isValid(value), { message: "Invalid id" });

export const LiveInputSchema = z.object({
  title: z.string().trim().min(1, "Give the live a title").max(LIVE_LIMITS.title),
  description: z.string().trim().max(LIVE_LIMITS.description).optional(),
  coverUrl: z.string().trim().max(2048).optional(),
  scheduledAt: z
    .string()
    .trim()
    .max(40)
    .optional()
    .refine((v) => !v || !Number.isNaN(Date.parse(v)), { message: "Invalid date" }),
  products: z
    .array(
      z.object({
        productId: objectId,
        discountPercent: z.number().min(0).max(LIVE_LIMITS.maxDiscount).default(0),
      }),
    )
    .max(LIVE_LIMITS.products, `Add at most ${LIVE_LIMITS.products} products`)
    .default([]),
});
export type LiveInput = z.infer<typeof LiveInputSchema>;

/* ------------------------------------------------------------------ */
/* Shapes                                                              */
/* ------------------------------------------------------------------ */

type LiveLean = {
  _id: Types.ObjectId;
  vendorId: Types.ObjectId;
  title: string;
  description?: string;
  coverUrl?: string;
  status: LiveStatus;
  scheduledAt?: Date | null;
  startedAt?: Date | null;
  endedAt?: Date | null;
  endedReason?: string;
  streamKey?: string;
  products?: Array<{ productId: Types.ObjectId; discountPercent?: number }>;
  pinnedProductId?: Types.ObjectId | null;
  productsVersion?: number;
  priceSnapshot?: PriceSnapshot[];
  likeCount?: number;
  giftCount?: number;
  peakViewers?: number;
  totalViews?: number;
  lastHeartbeatAt?: Date | null;
  updatedAt?: Date;
};

type PriceSnapshot = {
  productId: Types.ObjectId;
  price?: number;
  comparePrice?: number | null;
  livePrice?: number;
  variants?: Array<{
    variantId: Types.ObjectId;
    price?: number;
    comparePrice?: number | null;
    livePrice?: number;
  }>;
};

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
  comparePrice?: number | null;
  priceRange?: { min?: number; max?: number };
  variants?: Array<{ _id: Types.ObjectId; price?: number; comparePrice?: number | null }>;
};

const iso = (d?: Date | null) => (d ? new Date(d).toISOString() : null);
const round2 = (n: number) => Math.round(n * 100) / 100;

function productImage(product: ProductLean | ModernProduct): string | undefined {
  const media = getPrimaryProductMedia(product as unknown as ModernProduct);
  if (media?.type === "image" && media.url) return media.url;
  return media?.thumbnailUrl || (product as ProductLean).images?.[0] || undefined;
}

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

/**
 * A product's regular price, before any live discount: while its live is on
 * air the product itself carries the live price, so the snapshot says what
 * it was.
 */
function regularPrice(product: ProductLean, snapshot?: PriceSnapshot): number {
  if (snapshot) {
    if (snapshot.variants?.length) {
      const prices = snapshot.variants.map((v) => v.price ?? 0);
      return prices.length ? Math.min(...prices) : 0;
    }
    if (typeof snapshot.price === "number") return snapshot.price;
  }
  return getProductPriceRange(product as unknown as ModernProduct).min;
}

async function toDashboardItems(lives: LiveLean[]): Promise<LiveDashboardItem[]> {
  const vendorIds = [...new Set(lives.map((l) => String(l.vendorId)))];
  const productIds = [
    ...new Set(lives.flatMap((l) => (l.products ?? []).map((p) => String(p.productId)))),
  ];
  const [vendors, products] = await Promise.all([
    Vendor.find({ _id: { $in: vendorIds } })
      .select("storeName district")
      .lean<Array<{ _id: Types.ObjectId; storeName: string; district?: string }>>(),
    productIds.length
      ? Product.find({ _id: { $in: productIds } })
          .select("name title slug status images media price comparePrice priceRange variants options")
          .lean<ProductLean[]>()
      : Promise.resolve([] as ProductLean[]),
  ]);
  const vendorById = new Map(vendors.map((v) => [String(v._id), v]));
  const productById = new Map(products.map((p) => [String(p._id), p]));

  return lives.map((live) => {
    const vendor = vendorById.get(String(live.vendorId));
    const snapshots = new Map(
      (live.priceSnapshot ?? []).map((s) => [String(s.productId), s]),
    );
    return {
      id: String(live._id),
      vendorId: String(live.vendorId),
      vendorName: vendor?.storeName ?? "",
      vendorDistrict: vendor?.district,
      title: live.title,
      description: live.description ?? "",
      coverUrl: live.coverUrl ?? "",
      status: live.status,
      scheduledAt: iso(live.scheduledAt),
      startedAt: iso(live.startedAt),
      endedAt: iso(live.endedAt),
      products: (live.products ?? [])
        .map((row): LiveProductSummary | null => {
          const product = productById.get(String(row.productId));
          if (!product) return null;
          return {
            id: String(product._id),
            name: product.name || product.title || "",
            slug: product.slug || "",
            image: productImage(product),
            price: regularPrice(product, snapshots.get(String(product._id))),
            discountPercent: row.discountPercent ?? 0,
            status: product.status,
          };
        })
        .filter((p): p is LiveProductSummary => Boolean(p)),
      pinnedProductId: live.pinnedProductId ? String(live.pinnedProductId) : null,
      likeCount: live.likeCount ?? 0,
      giftCount: live.giftCount ?? 0,
      peakViewers: live.peakViewers ?? 0,
      totalViews: live.totalViews ?? 0,
      endedReason: live.endedReason ?? "",
      updatedAt: live.updatedAt ? new Date(live.updatedAt).toISOString() : "",
    };
  });
}

export async function listLives(options: {
  vendorId?: string;
  status?: LiveStatus;
  page?: number;
  limit?: number;
}) {
  await connectDB();
  await sweepStaleLives();
  const page = Math.max(1, Math.floor(options.page ?? 1));
  const limit = Math.min(60, Math.max(1, Math.floor(options.limit ?? 24)));
  const query: Record<string, unknown> = {};
  if (options.vendorId) query.vendorId = new Types.ObjectId(options.vendorId);
  if (options.status) query.status = options.status;
  const [lives, total] = await Promise.all([
    LiveSession.find(query)
      .sort({ status: 1, updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean<LiveLean[]>(),
    LiveSession.countDocuments(query),
  ]);
  // "live" sorts before "scheduled" before "ended" — alphabetical order happens
  // to be wrong, so put the on-air ones first explicitly.
  const order: Record<LiveStatus, number> = { live: 0, scheduled: 1, ended: 2 };
  lives.sort((a, b) => order[a.status] - order[b.status]);
  return { items: await toDashboardItems(lives), total, page, limit };
}

async function findScoped(id: string, scope: { vendorId?: string }, withKey = false) {
  if (!Types.ObjectId.isValid(id)) throw new NotFoundError("Live");
  const query = LiveSession.findById(id);
  if (withKey) query.select("+streamKey");
  const live = await query;
  if (!live || (scope.vendorId && String(live.vendorId) !== scope.vendorId)) {
    throw new NotFoundError("Live");
  }
  return live;
}

export async function getLive(id: string, scope: { vendorId?: string } = {}) {
  await connectDB();
  if (!Types.ObjectId.isValid(id)) throw new NotFoundError("Live");
  const live = await LiveSession.findById(id).lean<LiveLean | null>();
  if (!live || (scope.vendorId && String(live.vendorId) !== scope.vendorId)) {
    throw new NotFoundError("Live");
  }
  const [item] = await toDashboardItems([live]);
  return item;
}

async function assertOwnMediaUrl(url: string) {
  const config = await getStorageConfig();
  const base = (config.publicUrl || "").replace(/\/+$/, "");
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error();
  } catch {
    throw new ValidationError("The cover image is not a valid link");
  }
  if (base && !url.startsWith(`${base}/`)) {
    throw new ValidationError("The cover image must be uploaded to the store's media storage");
  }
}

/** The live's products, which must all be the store's own. */
async function resolveOwnProducts(vendorId: Types.ObjectId, rows: LiveInput["products"]) {
  const seen = new Set<string>();
  const unique = rows.filter((row) => !seen.has(row.productId) && seen.add(row.productId));
  if (unique.length === 0) return [];
  const found = await Product.countDocuments({
    _id: { $in: unique.map((row) => new Types.ObjectId(row.productId)) },
    vendorId,
  });
  if (found !== unique.length) {
    throw new ValidationError("A live can only sell products from its own store");
  }
  return unique.map((row) => ({
    productId: new Types.ObjectId(row.productId),
    discountPercent: Math.round(row.discountPercent * 100) / 100,
  }));
}

export async function createLive(input: LiveInput, vendorId: string, actorId: string) {
  await connectDB();
  const vendor = await Vendor.findById(vendorId).select("_id").lean<{ _id: Types.ObjectId } | null>();
  if (!vendor) throw new NotFoundError("Store");
  if (input.coverUrl) await assertOwnMediaUrl(input.coverUrl);
  const products = await resolveOwnProducts(vendor._id, input.products);
  const live = await LiveSession.create({
    vendorId: vendor._id,
    title: input.title,
    description: input.description ?? "",
    coverUrl: input.coverUrl ?? "",
    scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
    products,
    streamKey: randomBytes(18).toString("base64url"),
    createdBy: actorId,
  });
  return getLive(String(live._id));
}

export async function updateLive(id: string, input: LiveInput, scope: { vendorId?: string }) {
  await connectDB();
  const live = await findScoped(id, scope);
  if (live.status === "ended") throw new ValidationError("This live has ended");
  if (input.coverUrl) await assertOwnMediaUrl(input.coverUrl);
  const products = await resolveOwnProducts(live.vendorId as Types.ObjectId, input.products);

  const wasOnAir = live.status === "live";
  if (wasOnAir) await restoreLivePrices(live);
  live.set({
    title: input.title,
    description: input.description ?? "",
    coverUrl: input.coverUrl ?? "",
    scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
    products,
  });
  if (
    live.pinnedProductId &&
    !products.some((p) => String(p.productId) === String(live.pinnedProductId))
  ) {
    live.pinnedProductId = null;
  }
  live.productsVersion = (live.productsVersion ?? 1) + 1;
  await live.save();
  if (wasOnAir) await applyLivePrices(live);
  return getLive(id);
}

export async function deleteLive(id: string, scope: { vendorId?: string }) {
  await connectDB();
  const live = await findScoped(id, scope);
  if (live.status === "live") {
    throw new ValidationError("End the live before deleting it");
  }
  await Promise.all([
    LiveSession.deleteOne({ _id: live._id }),
    LiveChatMessage.deleteMany({ sessionId: live._id }),
    LivePresence.deleteMany({ sessionId: live._id }),
    // Free gifts go with it; any that cost coins stay on the store's record.
    LiveGift.deleteMany({ sessionId: live._id, coins: 0 }),
  ]);
}

/* ------------------------------------------------------------------ */
/* Live prices                                                         */
/* ------------------------------------------------------------------ */

type LiveDoc = Awaited<ReturnType<typeof findScoped>>;

/**
 * Write each discounted product's live price onto the product, remembering
 * the regular price. The old price becomes the compare-at price, so cards and
 * the product page show the saving everywhere while the live is on.
 */
async function applyLivePrices(live: LiveDoc) {
  if ((live.priceSnapshot ?? []).length > 0) await restoreLivePrices(live);
  const snapshots: PriceSnapshot[] = [];
  for (const row of live.products ?? []) {
    const discount = row.discountPercent ?? 0;
    if (discount <= 0) continue;
    const factor = 1 - discount / 100;
    const product = await Product.findById(row.productId)
      .select("price comparePrice variants")
      .lean<ProductLean | null>();
    if (!product) continue;

    const set: Record<string, unknown> = {};
    const snapshot: PriceSnapshot = {
      productId: product._id,
      price: product.price,
      comparePrice: product.comparePrice ?? null,
      variants: [],
    };
    const variants = product.variants ?? [];
    if (variants.length > 0) {
      variants.forEach((variant, index) => {
        const regular = variant.price ?? 0;
        const livePrice = round2(regular * factor);
        set[`variants.${index}.price`] = livePrice;
        set[`variants.${index}.comparePrice`] = Math.max(variant.comparePrice ?? 0, regular);
        snapshot.variants!.push({
          variantId: variant._id,
          price: regular,
          comparePrice: variant.comparePrice ?? null,
          livePrice,
        });
      });
    } else {
      const regular = product.price ?? 0;
      const livePrice = round2(regular * factor);
      set.price = livePrice;
      set.comparePrice = Math.max(product.comparePrice ?? 0, regular);
      snapshot.livePrice = livePrice;
    }
    await Product.updateOne({ _id: product._id }, { $set: set });
    await syncProductAggregates(String(product._id));
    snapshots.push(snapshot);
  }
  live.priceSnapshot = snapshots as never;
  await live.save();
  if (snapshots.length) revalidateProductContent();
}

/**
 * Put the regular prices back. A price the store changed during the live (so
 * no longer the live price) is the store's decision and is left as it is.
 */
async function restoreLivePrices(live: LiveDoc) {
  const snapshots = (live.priceSnapshot ?? []) as unknown as PriceSnapshot[];
  if (snapshots.length === 0) return;
  for (const snap of snapshots) {
    const product = await Product.findById(snap.productId)
      .select("price comparePrice variants")
      .lean<ProductLean | null>();
    if (!product) continue;
    const set: Record<string, unknown> = {};
    const unset: Record<string, ""> = {};
    if (snap.variants?.length) {
      const variants = product.variants ?? [];
      for (const saved of snap.variants) {
        const index = variants.findIndex((v) => String(v._id) === String(saved.variantId));
        if (index < 0) continue;
        if (round2(variants[index].price ?? -1) !== round2(saved.livePrice ?? -2)) continue;
        set[`variants.${index}.price`] = saved.price;
        if (saved.comparePrice != null) set[`variants.${index}.comparePrice`] = saved.comparePrice;
        else unset[`variants.${index}.comparePrice`] = "";
      }
    } else if (round2(product.price ?? -1) === round2(snap.livePrice ?? -2)) {
      set.price = snap.price;
      if (snap.comparePrice != null) set.comparePrice = snap.comparePrice;
      else unset.comparePrice = "";
    }
    if (Object.keys(set).length || Object.keys(unset).length) {
      await Product.updateOne(
        { _id: product._id },
        { ...(Object.keys(set).length ? { $set: set } : {}), ...(Object.keys(unset).length ? { $unset: unset } : {}) },
      );
      await syncProductAggregates(String(product._id));
    }
  }
  live.priceSnapshot = [] as never;
  await live.save();
  revalidateProductContent();
}

/* ------------------------------------------------------------------ */
/* On air                                                              */
/* ------------------------------------------------------------------ */

async function systemMessage(sessionId: Types.ObjectId, text: string) {
  await LiveChatMessage.create({ sessionId, kind: "system", text: text.slice(0, LIVE_LIMITS.chatText) });
}

export async function startLive(id: string, scope: { vendorId?: string }) {
  await connectDB();
  const live = await findScoped(id, scope);
  if (live.status === "ended") throw new ValidationError("This live has ended — create a new one");
  if (live.status !== "live") {
    live.status = "live";
    live.startedAt = new Date();
    live.lastHeartbeatAt = new Date();
    live.productsVersion = (live.productsVersion ?? 1) + 1;
    await live.save();
    await applyLivePrices(live);
    await systemMessage(live._id as Types.ObjectId, "live_started");
  }
  return getLive(id);
}

export async function endLive(
  id: string,
  reason: "store" | "admin" | "timeout",
  scope: { vendorId?: string } = {},
) {
  await connectDB();
  const live = await findScoped(id, scope);
  if (live.status === "ended") return getLive(id);
  await restoreLivePrices(live);
  live.status = "ended";
  live.endedAt = new Date();
  live.endedReason = reason;
  live.pinnedProductId = null;
  live.productsVersion = (live.productsVersion ?? 1) + 1;
  await live.save();
  await systemMessage(live._id as Types.ObjectId, "live_ended");
  await kickPublisher(id);
  return getLive(id);
}

export async function pinLiveProduct(
  id: string,
  productId: string | null,
  scope: { vendorId?: string },
) {
  await connectDB();
  const live = await findScoped(id, scope);
  if (productId && !(live.products ?? []).some((p) => String(p.productId) === productId)) {
    throw new ValidationError("Add the product to the live before pinning it");
  }
  live.pinnedProductId = productId ? new Types.ObjectId(productId) : null;
  await live.save();
  if (productId) {
    const product = await Product.findById(productId).select("name").lean<{ name?: string } | null>();
    if (product?.name) await systemMessage(live._id as Types.ObjectId, `pinned:${product.name}`);
  }
  return { pinnedProductId: productId };
}

/**
 * Lives whose store went quiet: no studio check-in for a minute and nothing on
 * the media server. Ended so their live prices do not outlive them.
 */
export async function sweepStaleLives() {
  const stale = await LiveSession.find({
    status: "live",
    $or: [
      { lastHeartbeatAt: { $lt: new Date(Date.now() - STALE_AFTER_MS) } },
      { lastHeartbeatAt: null },
    ],
  })
    .select("_id")
    .limit(20)
    .lean<Array<{ _id: Types.ObjectId }>>();
  for (const live of stale) {
    const id = String(live._id);
    if (await isOnAir(id)) {
      // Streaming from OBS with the studio closed still counts as present.
      await LiveSession.updateOne({ _id: live._id }, { $set: { lastHeartbeatAt: new Date() } });
      continue;
    }
    await endLive(id, "timeout").catch(() => {});
  }
}

/* ------------------------------------------------------------------ */
/* Media server                                                        */
/* ------------------------------------------------------------------ */

const onAirCache = new Map<string, { at: number; value: boolean }>();

/** Whether the media server is receiving this live's camera right now. */
export async function isOnAir(id: string): Promise<boolean> {
  const cached = onAirCache.get(id);
  if (cached && Date.now() - cached.at < 2500) return cached.value;
  let value = false;
  try {
    const res = await fetch(
      `${liveMediaApiUrl()}/v3/paths/get/${encodeURIComponent(mediaPath(id))}`,
      { cache: "no-store", signal: AbortSignal.timeout(1500) },
    );
    if (res.ok) {
      const body = (await res.json()) as { ready?: boolean };
      value = body.ready === true;
    }
  } catch {
    value = false;
  }
  onAirCache.set(id, { at: Date.now(), value });
  return value;
}

/** Drop the store's stream when its live ends (best effort). */
async function kickPublisher(id: string) {
  onAirCache.delete(id);
  try {
    const res = await fetch(`${liveMediaApiUrl()}/v3/paths/get/${encodeURIComponent(mediaPath(id))}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) return;
    const body = (await res.json()) as { source?: { type?: string; id?: string } };
    const source = body.source;
    if (!source?.id || !source.type) return;
    const kind =
      source.type.startsWith("webRTC") ? "webrtcsessions" : source.type.startsWith("rtmp") ? "rtmpconns" : null;
    if (!kind) return;
    await fetch(`${liveMediaApiUrl()}/v3/${kind}/kick/${source.id}`, {
      method: "POST",
      signal: AbortSignal.timeout(1500),
    });
  } catch {
    // The stream stops on its own once the studio closes it.
  }
}

function sameSecret(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export const MediaAuthSchema = z
  .object({
    user: z.string().optional().nullable(),
    password: z.string().optional().nullable(),
    token: z.string().optional().nullable(),
    action: z.string(),
    path: z.string().optional().nullable(),
    query: z.string().optional().nullable(),
  })
  .passthrough();

/**
 * The media server asks before every publish and read. Publishing needs the
 * live's stream key (as the password, a bearer token, or `key=` in the
 * query); watching needs the live to be on air.
 */
export async function authorizeMedia(request: z.infer<typeof MediaAuthSchema>) {
  const match = /^live\/([a-f0-9]{24})$/.exec(request.path ?? "");
  if (!match) return false;
  await connectDB();
  const live = await LiveSession.findById(match[1])
    .select("+streamKey status vendorId")
    .lean<LiveLean | null>();
  if (!live || live.status === "ended") return false;

  if (request.action === "publish") {
    const queryKey = new URLSearchParams(request.query ?? "").get("key") ?? "";
    const offered = [request.password, request.token, queryKey].filter(
      (v): v is string => typeof v === "string" && v.length > 0,
    );
    return Boolean(live.streamKey) && offered.some((v) => sameSecret(v, live.streamKey!));
  }
  if (request.action === "read") {
    if (live.status !== "live") return false;
    const vendor = await Vendor.findById(live.vendorId)
      .select("status storeActive")
      .lean<{ status?: string; storeActive?: boolean } | null>();
    return vendor?.status === VENDOR_STATUS.APPROVED && vendor.storeActive !== false;
  }
  return false;
}

/* ------------------------------------------------------------------ */
/* Studio                                                              */
/* ------------------------------------------------------------------ */

export async function getStudioCredentials(
  id: string,
  scope: { vendorId?: string },
): Promise<LiveStudioCredentials> {
  await connectDB();
  const live = await findScoped(id, scope, true);
  const streamKey = live.get("streamKey") as string;
  return {
    streamKey,
    whipUrl: `${liveMediaPublicUrl()}/${mediaPath(id)}/whip`,
    rtmpServer: `${liveRtmpPublicUrl()}/live`,
    rtmpStreamKey: `${id}?key=${streamKey}`,
  };
}

/** The studio's poll: the room as viewers see it, and a check-in. */
export async function getStudioState(
  id: string,
  scope: { vendorId?: string },
  options: { after?: string | null; version?: string | null },
) {
  await connectDB();
  const live = await findScoped(id, scope);
  if (live.status === "live") {
    await LiveSession.updateOne({ _id: live._id }, { $set: { lastHeartbeatAt: new Date() } });
  }
  return getRoomState(id, { after: options.after, version: options.version, viewerId: null });
}

/* ------------------------------------------------------------------ */
/* Storefront                                                          */
/* ------------------------------------------------------------------ */

async function liveVendors() {
  return Vendor.find({ status: VENDOR_STATUS.APPROVED, storeActive: { $ne: false } })
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
}

function storeInfo(vendor: {
  storeName: string;
  slug: string;
  logo?: string;
  district?: string;
  isDefault?: boolean;
}): LiveStoreInfo {
  return {
    name: vendor.storeName,
    slug: vendor.slug,
    logo: vendor.logo || undefined,
    district: vendor.district,
    hasPage: !vendor.isDefault,
  };
}

async function viewerCounts(ids: Types.ObjectId[]) {
  if (ids.length === 0) return new Map<string, number>();
  const rows = await LivePresence.aggregate<{ _id: Types.ObjectId; count: number }>([
    {
      $match: {
        sessionId: { $in: ids },
        lastSeen: { $gt: new Date(Date.now() - VIEWER_WINDOW_MS) },
      },
    },
    { $group: { _id: "$sessionId", count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.count]));
}

async function shopProducts(live: LiveLean): Promise<LiveShopProduct[]> {
  const rows = live.products ?? [];
  if (rows.length === 0) return [];
  const products = await Product.find({
    _id: { $in: rows.map((r) => r.productId) },
    status: PRODUCT_STATUS.ACTIVE,
    ...(await getStorefrontProductConstraint()),
  })
    .select(PRODUCT_CARD_SELECT)
    .lean<ModernProduct[]>();
  const byId = new Map(products.map((p) => [String(p._id), p]));
  return rows
    .map((row): LiveShopProduct | null => {
      const product = byId.get(String(row.productId));
      if (!product) return null;
      const available = isProductAvailable(product, product.stock);
      const onlyVariant = productOnlyVariant(product);
      const range = getProductPriceRange(product);
      const price = onlyVariant?.price ?? range.min;
      return {
        id: String(product._id),
        name: product.name,
        slug: product.slug,
        image: productImage(product),
        price,
        comparePrice:
          typeof product.comparePrice === "number" && product.comparePrice > price
            ? product.comparePrice
            : undefined,
        discountPercent: row.discountPercent ?? 0,
        quickAdd:
          available && !isQuoteOnlyProduct(product) && !productRequiresVariantSelection(product),
        variantId: onlyVariant?._id ? String(onlyVariant._id) : undefined,
        variantName: onlyVariant?.name,
        available,
      };
    })
    .filter((p): p is LiveShopProduct => Boolean(p));
}

/**
 * The storefront's lives: on air now (newest first), then the ones coming up.
 */
export async function listPublicLives(options: { limit?: number } = {}): Promise<{
  live: LiveCard[];
  upcoming: LiveCard[];
}> {
  await connectDB();
  await sweepStaleLives();
  const limit = Math.min(24, Math.max(1, options.limit ?? 12));
  const vendors = await liveVendors();
  const vendorById = new Map(vendors.map((v) => [String(v._id), v]));
  const vendorIds = vendors.map((v) => v._id);
  const [onAir, upcoming] = await Promise.all([
    LiveSession.find({ status: "live", vendorId: { $in: vendorIds } })
      .sort({ startedAt: -1 })
      .limit(limit)
      .lean<LiveLean[]>(),
    LiveSession.find({
      status: "scheduled",
      vendorId: { $in: vendorIds },
      scheduledAt: { $gte: new Date(Date.now() - 2 * 60 * 60 * 1000) },
    })
      .sort({ scheduledAt: 1 })
      .limit(limit)
      .lean<LiveLean[]>(),
  ]);
  const viewers = await viewerCounts(onAir.map((l) => l._id));
  const productIds = [
    ...new Set([...onAir, ...upcoming].flatMap((l) => (l.products ?? []).map((p) => p.productId))),
  ];
  const images = new Map<string, string | undefined>();
  if (productIds.length) {
    const products = await Product.find({ _id: { $in: productIds } })
      .select("images media")
      .lean<ProductLean[]>();
    for (const p of products) images.set(String(p._id), productImage(p));
  }
  const card = (live: LiveLean): LiveCard | null => {
    const vendor = vendorById.get(String(live.vendorId));
    if (!vendor) return null;
    return {
      id: String(live._id),
      title: live.title,
      coverUrl: live.coverUrl ?? "",
      status: live.status,
      scheduledAt: iso(live.scheduledAt),
      startedAt: iso(live.startedAt),
      viewers: viewers.get(String(live._id)) ?? 0,
      totalViews: live.totalViews ?? 0,
      likeCount: live.likeCount ?? 0,
      productCount: (live.products ?? []).length,
      productImages: (live.products ?? [])
        .map((p) => images.get(String(p.productId)))
        .filter((u): u is string => Boolean(u))
        .slice(0, 4),
      store: storeInfo(vendor),
    };
  };
  return {
    live: onAir.map(card).filter((c): c is LiveCard => Boolean(c)),
    upcoming: upcoming.map(card).filter((c): c is LiveCard => Boolean(c)),
  };
}

/** A live's room, as its watch page first renders it. */
export async function getLiveRoom(id: string): Promise<LiveRoom | null> {
  if (!Types.ObjectId.isValid(id)) return null;
  await connectDB();
  await sweepStaleLives();
  const live = await LiveSession.findById(id).lean<LiveLean | null>();
  if (!live) return null;
  const vendor = await Vendor.findOne({
    _id: live.vendorId,
    status: VENDOR_STATUS.APPROVED,
    storeActive: { $ne: false },
  })
    .select("storeName slug logo district isDefault")
    .lean<{ storeName: string; slug: string; logo?: string; district?: string; isDefault?: boolean } | null>();
  if (!vendor) return null;
  const [products, viewers] = await Promise.all([shopProducts(live), viewerCounts([live._id])]);
  return {
    id,
    title: live.title,
    description: live.description ?? "",
    coverUrl: live.coverUrl ?? "",
    status: live.status,
    scheduledAt: iso(live.scheduledAt),
    startedAt: iso(live.startedAt),
    viewers: viewers.get(id) ?? 0,
    totalViews: live.totalViews ?? 0,
    likeCount: live.likeCount ?? 0,
    productCount: products.length,
    productImages: products.map((p) => p.image).filter((u): u is string => Boolean(u)).slice(0, 4),
    store: storeInfo(vendor),
    whepUrl: `${liveMediaPublicUrl()}/${mediaPath(id)}/whep`,
    products,
    pinnedProductId: live.pinnedProductId ? String(live.pinnedProductId) : null,
  };
}

function chatItem(message: {
  _id: Types.ObjectId;
  kind?: string;
  name?: string;
  text: string;
  host?: boolean;
  giftId?: string | null;
  giftCount?: number | null;
  createdAt?: Date;
}): LiveChatItem {
  const gift = message.kind === "gift" && message.giftId ? { id: message.giftId, count: message.giftCount ?? 1 } : null;
  return {
    id: String(message._id),
    kind: message.kind === "system" ? "system" : gift ? "gift" : "chat",
    name: message.name ?? "",
    text: message.text,
    host: message.host === true,
    at: message.createdAt ? new Date(message.createdAt).toISOString() : "",
    ...(gift ? { gift } : {}),
  };
}

/* ------------------------------------------------------------------ */
/* Gifts                                                               */
/* ------------------------------------------------------------------ */

// The supporters ranking is read by every viewer's poll; it is worked out at
// most once per room every few seconds.
const SUPPORTERS_TTL_MS = 5000;
const supportersCache = new Map<string, { at: number; rows: LiveSupporter[] }>();

async function liveSupporters(sessionId: Types.ObjectId): Promise<LiveSupporter[]> {
  const key = String(sessionId);
  const cached = supportersCache.get(key);
  if (cached && Date.now() - cached.at < SUPPORTERS_TTL_MS) return cached.rows;
  const rows = await LiveGift.aggregate<{ _id: string; name: string; count: number }>([
    { $match: { sessionId } },
    { $sort: { createdAt: -1 } },
    { $group: { _id: "$userId", name: { $first: "$name" }, count: { $sum: "$count" } } },
    { $sort: { count: -1, _id: 1 } },
    { $limit: LIVE_GIFT_LIMITS.topSupporters },
  ]);
  const supporters = rows.map((row) => ({ name: row.name || "—", count: row.count }));
  supportersCache.set(key, { at: Date.now(), rows: supporters });
  if (supportersCache.size > 500) {
    for (const [k, v] of supportersCache) if (Date.now() - v.at > SUPPORTERS_TTL_MS) supportersCache.delete(k);
  }
  return supporters;
}

/** A refusal the player words itself: which limit, and how long to wait. */
function giftLimit(reason: "minute" | "cooldown", retryAfter: number) {
  const error = new ValidationError(
    reason === "minute" ? "Too many gifts this minute" : "Wait a moment before sending this gift again",
  );
  error.details = { reason: `gift_${reason}`, retryAfter };
  return error;
}

/**
 * A signed-in viewer sends a gift (a batch of taps on the same one). Free for
 * now, so the limits are what keep it meaningful: so many a minute, and a
 * cool-down on the bigger ones. Shows in the chat as a gift line, which every
 * player and the studio pick up with their usual poll.
 */
export async function sendLiveGift(
  id: string,
  user: { id: string; name?: string | null },
  giftId: string,
  count: number,
) {
  if (!Types.ObjectId.isValid(id)) throw new NotFoundError("Live");
  const gift = liveGift(giftId);
  if (!gift) throw new ValidationError("Unknown gift");
  const n = Math.max(1, Math.min(LIVE_GIFT_LIMITS.batch, Math.floor(count)));
  await connectDB();
  const live = await LiveSession.findById(id).select("status vendorId").lean<LiveLean | null>();
  if (!live) throw new NotFoundError("Live");
  if (live.status !== "live") throw new ValidationError("Gifts open when the live starts");
  if (await Vendor.exists({ _id: live.vendorId, userId: user.id })) {
    const error = new ValidationError("A store can't send gifts to its own live");
    error.details = { reason: "gift_own" };
    throw error;
  }

  const now = Date.now();
  const recent = await LiveGift.find({
    sessionId: live._id,
    userId: user.id,
    createdAt: { $gte: new Date(now - 60_000) },
  })
    .select("giftId count createdAt")
    .lean<Array<{ giftId: string; count: number; createdAt: Date }>>();
  const sentThisMinute = recent.reduce((sum, row) => sum + row.count, 0);
  if (sentThisMinute + n > LIVE_GIFT_LIMITS.perMinute) {
    const oldest = Math.min(...recent.map((row) => new Date(row.createdAt).getTime()));
    throw giftLimit("minute", Math.max(1, Math.ceil((oldest + 60_000 - now) / 1000)));
  }
  const cooldown = LIVE_GIFT_LIMITS.cooldownSeconds[gift.tier] * 1000;
  if (cooldown > 0) {
    const last = recent
      .filter((row) => liveGift(row.giftId)?.tier === gift.tier)
      .reduce((latest, row) => Math.max(latest, new Date(row.createdAt).getTime()), 0);
    if (last && now - last < cooldown) {
      throw giftLimit("cooldown", Math.ceil((last + cooldown - now) / 1000));
    }
  }

  const name = (user.name || "").trim().slice(0, 40);
  await LiveGift.create({
    sessionId: live._id,
    vendorId: live.vendorId,
    userId: user.id,
    name,
    giftId: gift.id,
    count: n,
    coins: gift.coins * n,
  });
  const [message] = await Promise.all([
    LiveChatMessage.create({
      sessionId: live._id,
      userId: user.id,
      name,
      kind: "gift",
      text: gift.emoji,
      giftId: gift.id,
      giftCount: n,
    }),
    LiveSession.updateOne({ _id: live._id }, { $inc: { giftCount: n } }),
  ]);
  supportersCache.delete(String(live._id));
  return chatItem(message.toObject() as never);
}

/** A viewer's poll: status, counts, the pin, new chat, and products when they changed. */
export async function getRoomState(
  id: string,
  options: { after?: string | null; version?: string | null; viewerId?: string | null },
): Promise<LiveRoomState> {
  if (!Types.ObjectId.isValid(id)) throw new NotFoundError("Live");
  await connectDB();
  const live = await LiveSession.findById(id).lean<LiveLean | null>();
  if (!live) throw new NotFoundError("Live");
  const sessionId = live._id;

  const viewerId = options.viewerId?.trim().slice(0, 64);
  if (viewerId && live.status === "live") {
    const joined = await LivePresence.updateOne(
      { sessionId, viewerId },
      { $set: { lastSeen: new Date() } },
      { upsert: true },
    );
    // A player that just joined is one more view.
    if (joined.upsertedCount) {
      await LiveSession.updateOne({ _id: sessionId }, { $inc: { totalViews: 1 } });
    }
  }

  const messageQuery: Record<string, unknown> = { sessionId };
  const after = options.after && Types.ObjectId.isValid(options.after) ? options.after : null;
  if (after) messageQuery._id = { $gt: new Types.ObjectId(after) };
  const [rawMessages, viewers, onAir, supporters] = await Promise.all([
    after
      ? LiveChatMessage.find(messageQuery).sort({ _id: 1 }).limit(LIVE_LIMITS.chatPage).lean()
      : LiveChatMessage.find(messageQuery).sort({ _id: -1 }).limit(30).lean().then((rows) => rows.reverse()),
    viewerCounts([sessionId]),
    live.status === "live" ? isOnAir(id) : Promise.resolve(false),
    (live.giftCount ?? 0) > 0 ? liveSupporters(sessionId) : Promise.resolve([] as LiveSupporter[]),
  ]);
  const viewerCount = viewers.get(id) ?? 0;
  if (viewerCount > (live.peakViewers ?? 0)) {
    await LiveSession.updateOne({ _id: sessionId }, { $max: { peakViewers: viewerCount } });
  }

  const version = String(live.productsVersion ?? 1);
  return {
    id,
    status: live.status,
    onAir,
    viewers: viewerCount,
    likeCount: live.likeCount ?? 0,
    giftCount: live.giftCount ?? 0,
    supporters,
    pinnedProductId: live.pinnedProductId ? String(live.pinnedProductId) : null,
    messages: (rawMessages as unknown as Parameters<typeof chatItem>[0][]).map(chatItem),
    productsVersion: version,
    ...(options.version !== version ? { products: await shopProducts(live) } : {}),
  };
}

export async function postLiveChat(
  id: string,
  user: { id: string; name?: string | null },
  text: string,
) {
  if (!Types.ObjectId.isValid(id)) throw new NotFoundError("Live");
  await connectDB();
  const live = await LiveSession.findById(id).select("status vendorId").lean<LiveLean | null>();
  if (!live) throw new NotFoundError("Live");
  if (live.status !== "live") throw new ValidationError("Chat opens when the live starts");
  const clean = text.replace(/\s+/g, " ").trim().slice(0, LIVE_LIMITS.chatText);
  if (!clean) throw new ValidationError("Write a message first");
  const host = Boolean(
    await Vendor.exists({ _id: live.vendorId, userId: user.id }),
  );
  const name = host
    ? ((await Vendor.findById(live.vendorId).select("storeName").lean<{ storeName?: string } | null>())
        ?.storeName ?? "")
    : (user.name || "").trim().slice(0, 40);
  const message = await LiveChatMessage.create({
    sessionId: live._id,
    userId: user.id,
    name,
    text: clean,
    host,
  });
  return chatItem(message.toObject() as never);
}

export async function addLiveLikes(id: string, count: number) {
  if (!Types.ObjectId.isValid(id)) throw new NotFoundError("Live");
  await connectDB();
  const n = Math.max(1, Math.min(LIVE_LIMITS.likeBatch, Math.floor(count)));
  const result = await LiveSession.findOneAndUpdate(
    { _id: new Types.ObjectId(id), status: "live" },
    { $inc: { likeCount: n } },
    { new: true, projection: { likeCount: 1 } },
  ).lean<{ likeCount?: number } | null>();
  if (!result) throw new AuthorizationError("This live is not on air");
  return { likeCount: result.likeCount ?? 0 };
}

/**
 * The most-watched lives of the last 30 days — on air or ended — by how many
 * people watched them. What the storefront's "top lives" ranking shows.
 */
export async function listTopLives(options: { limit?: number; days?: number } = {}): Promise<LiveCard[]> {
  await connectDB();
  const limit = Math.min(10, Math.max(1, options.limit ?? 5));
  const since = new Date(Date.now() - (options.days ?? 30) * 24 * 60 * 60 * 1000);
  const vendors = await liveVendors();
  const vendorById = new Map(vendors.map((v) => [String(v._id), v]));
  const lives = await LiveSession.find({
    status: { $in: ["live", "ended"] },
    vendorId: { $in: vendors.map((v) => v._id) },
    startedAt: { $gte: since },
    totalViews: { $gt: 0 },
  })
    .sort({ totalViews: -1, peakViewers: -1, startedAt: -1 })
    .limit(limit)
    .lean<LiveLean[]>();
  if (lives.length === 0) return [];
  const viewers = await viewerCounts(lives.filter((l) => l.status === "live").map((l) => l._id));
  const productIds = [...new Set(lives.flatMap((l) => (l.products ?? []).map((p) => p.productId)))];
  const images = new Map<string, string | undefined>();
  if (productIds.length) {
    const products = await Product.find({ _id: { $in: productIds } }).select("images media").lean<ProductLean[]>();
    for (const p of products) images.set(String(p._id), productImage(p));
  }
  return lives
    .map((live): LiveCard | null => {
      const vendor = vendorById.get(String(live.vendorId));
      if (!vendor) return null;
      return {
        id: String(live._id),
        title: live.title,
        coverUrl: live.coverUrl ?? "",
        status: live.status,
        scheduledAt: iso(live.scheduledAt),
        startedAt: iso(live.startedAt),
        viewers: viewers.get(String(live._id)) ?? 0,
        totalViews: live.totalViews ?? 0,
        likeCount: live.likeCount ?? 0,
        productCount: (live.products ?? []).length,
        productImages: (live.products ?? [])
          .map((p) => images.get(String(p.productId)))
          .filter((u): u is string => Boolean(u))
          .slice(0, 4),
        store: storeInfo(vendor),
      };
    })
    .filter((c): c is LiveCard => Boolean(c));
}
