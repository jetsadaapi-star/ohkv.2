import "server-only";

import { Types } from "mongoose";
import { NotFoundError, ValidationError } from "@/lib/api/errors";
import { connectDB } from "@/lib/db";
import { revalidateProductContent } from "@/lib/cache-invalidation";
import { Order, Product } from "@/models";
import { syncProductAggregates } from "@/models/product.model";
import { LiveSession } from "@/models/live-session.model";
import {
  FlashSale,
  type IFlashSale,
  type IFlashSaleItem,
  type IFlashSaleSnapshot,
} from "@/models/flash-sale.model";

/**
 * Flash Sales (Admin → Flash Sale): a set of products at a percentage off for
 * a window, each optionally capped at a number of units.
 *
 * The engine is the live-selling deal's: on start the sale price is written
 * onto the product (the regular price becomes the compare-at price, so every
 * card shows the saving), and on end the regular price goes back — unless the
 * store changed the price in the meantime, which is their decision and stays.
 * A product already on a live deal is left alone, and the live deal skips a
 * product on a flash sale, so one never undoes the other.
 *
 * `runFlashSales` (cron, every minute) starts what is due, ends what is over,
 * and ends a product early once its cap of units has been ordered — a soft
 * cap, checked each minute, not a hold on stock.
 */

export const FLASH_SALE_LIMITS = {
  items: 100,
  maxDays: 31,
  minDiscount: 1,
  maxDiscount: 90,
} as const;

const round2 = (n: number) => Math.round(n * 100) / 100;

interface ProductLean {
  _id: Types.ObjectId;
  price?: number;
  comparePrice?: number | null;
  variants?: Array<{ _id: Types.ObjectId; price?: number; comparePrice?: number | null }>;
}

export interface FlashSaleInput {
  name: string;
  startsAt: Date;
  endsAt: Date;
  items: Array<{ productId: string; discountPercent: number; quantityLimit?: number | null }>;
}

function cleanItems(items: FlashSaleInput["items"]) {
  const seen = new Set<string>();
  const out: Array<{ productId: Types.ObjectId; discountPercent: number; quantityLimit: number | null }> = [];
  for (const item of items) {
    if (!Types.ObjectId.isValid(item.productId) || seen.has(item.productId)) continue;
    seen.add(item.productId);
    const discount = Math.round(Number(item.discountPercent));
    if (!Number.isFinite(discount) || discount < FLASH_SALE_LIMITS.minDiscount || discount > FLASH_SALE_LIMITS.maxDiscount) {
      throw new ValidationError({ items: [`Discounts run from ${FLASH_SALE_LIMITS.minDiscount}% to ${FLASH_SALE_LIMITS.maxDiscount}%`] });
    }
    const limit = item.quantityLimit == null || item.quantityLimit === 0 ? null : Math.floor(Number(item.quantityLimit));
    if (limit !== null && (!Number.isFinite(limit) || limit < 1)) {
      throw new ValidationError({ items: ["A unit limit must be a whole number above zero"] });
    }
    out.push({ productId: new Types.ObjectId(item.productId), discountPercent: discount, quantityLimit: limit });
  }
  if (out.length === 0) throw new ValidationError({ items: ["Add at least one product"] });
  if (out.length > FLASH_SALE_LIMITS.items) {
    throw new ValidationError({ items: [`A sale holds at most ${FLASH_SALE_LIMITS.items} products`] });
  }
  return out;
}

function checkWindow(startsAt: Date, endsAt: Date) {
  if (!(startsAt instanceof Date) || Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    throw new ValidationError({ startsAt: ["Choose when the sale starts and ends"] });
  }
  if (endsAt.getTime() <= startsAt.getTime()) {
    throw new ValidationError({ endsAt: ["The sale must end after it starts"] });
  }
  if (endsAt.getTime() - startsAt.getTime() > FLASH_SALE_LIMITS.maxDays * 86_400_000) {
    throw new ValidationError({ endsAt: [`A flash sale lasts at most ${FLASH_SALE_LIMITS.maxDays} days`] });
  }
  if (endsAt.getTime() <= Date.now()) {
    throw new ValidationError({ endsAt: ["The end has already passed"] });
  }
}

/** No product may be in two sales whose windows overlap. */
async function checkOverlap(params: {
  id?: Types.ObjectId;
  startsAt: Date;
  endsAt: Date;
  productIds: Types.ObjectId[];
}) {
  const clash = await FlashSale.findOne({
    ...(params.id ? { _id: { $ne: params.id } } : {}),
    state: { $in: ["scheduled", "live"] },
    startsAt: { $lt: params.endsAt },
    endsAt: { $gt: params.startsAt },
    "items.productId": { $in: params.productIds },
  })
    .select("name")
    .lean<{ name: string } | null>();
  if (clash) {
    throw new ValidationError({
      items: [`Some of these products are already in "${clash.name}" at an overlapping time`],
    });
  }
}

export async function createFlashSale(input: FlashSaleInput, userId?: string) {
  await connectDB();
  const name = input.name.trim().slice(0, 120);
  if (!name) throw new ValidationError({ name: ["Name the sale"] });
  checkWindow(input.startsAt, input.endsAt);
  const items = cleanItems(input.items);
  await checkOverlap({ startsAt: input.startsAt, endsAt: input.endsAt, productIds: items.map((i) => i.productId) });
  const sale = await FlashSale.create({
    name,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    items: items.map((item) => ({ ...item, soldCount: 0, endedEarly: false })),
    createdByUserId: userId && Types.ObjectId.isValid(userId) ? new Types.ObjectId(userId) : undefined,
  });
  await runFlashSales({ only: sale._id });
  return FlashSale.findById(sale._id).lean<IFlashSale>();
}

/**
 * Changes a sale. A live one is taken off the products first and put back on
 * with the new terms, so a changed discount or item list is what shows.
 */
export async function updateFlashSale(id: string, input: FlashSaleInput) {
  await connectDB();
  if (!Types.ObjectId.isValid(id)) throw new NotFoundError("Flash sale");
  const sale = await FlashSale.findById(id);
  if (!sale) throw new NotFoundError("Flash sale");
  if (sale.state === "ended" || sale.state === "cancelled") {
    throw new ValidationError("This sale is over and can no longer be changed");
  }
  const name = input.name.trim().slice(0, 120);
  if (!name) throw new ValidationError({ name: ["Name the sale"] });
  checkWindow(input.startsAt, input.endsAt);
  const items = cleanItems(input.items);
  await checkOverlap({ id: sale._id, startsAt: input.startsAt, endsAt: input.endsAt, productIds: items.map((i) => i.productId) });

  if (sale.state === "live") await restorePrices(sale);
  const previous = new Map(sale.items.map((item) => [String(item.productId), item]));
  sale.name = name;
  sale.startsAt = input.startsAt;
  sale.endsAt = input.endsAt;
  sale.items = items.map((item) => ({
    ...item,
    soldCount: previous.get(String(item.productId))?.soldCount ?? 0,
    endedEarly: false,
  })) as never;
  sale.state = "scheduled";
  await sale.save();
  await runFlashSales({ only: sale._id });
  return FlashSale.findById(sale._id).lean<IFlashSale>();
}

/** Stops a sale now (or drops one not started), putting regular prices back. */
export async function cancelFlashSale(id: string) {
  await connectDB();
  if (!Types.ObjectId.isValid(id)) throw new NotFoundError("Flash sale");
  const sale = await FlashSale.findById(id);
  if (!sale) throw new NotFoundError("Flash sale");
  if (sale.state === "live") await restorePrices(sale);
  if (sale.state === "scheduled" || sale.state === "live") {
    sale.state = "cancelled";
    sale.endedAt = new Date();
    await sale.save();
  }
  return sale.toObject();
}

export async function deleteFlashSale(id: string) {
  await cancelFlashSale(id);
  await FlashSale.deleteOne({ _id: new Types.ObjectId(id) });
}

export async function listFlashSales() {
  await connectDB();
  return FlashSale.find({})
    .sort({ startsAt: -1 })
    .limit(200)
    .populate({ path: "items.productId", select: "name images price slug" })
    .lean<IFlashSale[]>();
}

export async function getFlashSale(id: string) {
  await connectDB();
  if (!Types.ObjectId.isValid(id)) throw new NotFoundError("Flash sale");
  const sale = await FlashSale.findById(id)
    .populate({ path: "items.productId", select: "name images price comparePrice slug variants" })
    .lean<IFlashSale | null>();
  if (!sale) throw new NotFoundError("Flash sale");
  return sale;
}

/* ------------------------------------------------------------------ */
/* Prices on and off                                                   */
/* ------------------------------------------------------------------ */

/** Products a live-selling deal has its price on right now. */
async function productsOnLiveDeal(): Promise<Set<string>> {
  const lives = await LiveSession.find({ "priceSnapshot.0": { $exists: true } })
    .select("priceSnapshot.productId")
    .lean<Array<{ priceSnapshot?: Array<{ productId: unknown }> }>>();
  return new Set(lives.flatMap((live) => (live.priceSnapshot ?? []).map((row) => String(row.productId))));
}

/** Products a live flash sale has its price on right now (for the live deal to skip). */
export async function productsOnFlashSale(): Promise<Set<string>> {
  await connectDB();
  const sales = await FlashSale.find({ state: "live" })
    .select("priceSnapshot.productId")
    .lean<Array<{ priceSnapshot?: Array<{ productId: unknown }> }>>();
  return new Set(sales.flatMap((sale) => (sale.priceSnapshot ?? []).map((row) => String(row.productId))));
}

async function applyItem(item: IFlashSaleItem): Promise<IFlashSaleSnapshot | null> {
  const product = await Product.findById(item.productId)
    .select("price comparePrice variants")
    .lean<ProductLean | null>();
  if (!product) return null;
  const factor = 1 - item.discountPercent / 100;
  const set: Record<string, unknown> = {};
  const snapshot: IFlashSaleSnapshot = {
    productId: product._id,
    price: product.price,
    comparePrice: product.comparePrice ?? null,
  };
  const variants = product.variants ?? [];
  if (variants.length > 0) {
    snapshot.variants = variants.map((variant, index) => {
      const regular = variant.price ?? 0;
      const salePrice = round2(regular * factor);
      set[`variants.${index}.price`] = salePrice;
      set[`variants.${index}.comparePrice`] = Math.max(variant.comparePrice ?? 0, regular);
      return { variantId: variant._id, price: regular, comparePrice: variant.comparePrice ?? null, salePrice };
    });
  }
  // The product's own price too: cards and single-price products read it.
  const regular = product.price ?? 0;
  const salePrice = round2(regular * factor);
  set.price = salePrice;
  set.comparePrice = Math.max(product.comparePrice ?? 0, regular);
  snapshot.salePrice = salePrice;
  await Product.updateOne({ _id: product._id }, { $set: set });
  await syncProductAggregates(String(product._id));
  return snapshot;
}

async function restoreSnapshot(snap: IFlashSaleSnapshot) {
  const product = await Product.findById(snap.productId)
    .select("price comparePrice variants")
    .lean<ProductLean | null>();
  if (!product) return;
  const set: Record<string, unknown> = {};
  const unset: Record<string, ""> = {};
  // Only what still carries the sale price: a price changed during the sale
  // is the store's decision and stays.
  if (round2(product.price ?? -1) === round2(snap.salePrice ?? -2)) {
    set.price = snap.price;
    if (snap.comparePrice != null) set.comparePrice = snap.comparePrice;
    else unset.comparePrice = "";
  }
  const variants = product.variants ?? [];
  for (const saved of snap.variants ?? []) {
    const index = variants.findIndex((v) => String(v._id) === String(saved.variantId));
    if (index < 0) continue;
    if (round2(variants[index].price ?? -1) !== round2(saved.salePrice ?? -2)) continue;
    set[`variants.${index}.price`] = saved.price;
    if (saved.comparePrice != null) set[`variants.${index}.comparePrice`] = saved.comparePrice;
    else unset[`variants.${index}.comparePrice`] = "";
  }
  if (Object.keys(set).length || Object.keys(unset).length) {
    await Product.updateOne(
      { _id: product._id },
      { ...(Object.keys(set).length ? { $set: set } : {}), ...(Object.keys(unset).length ? { $unset: unset } : {}) },
    );
    await syncProductAggregates(String(product._id));
  }
}

async function applyPrices(sale: InstanceType<typeof FlashSale>) {
  if (sale.priceSnapshot.length) await restorePrices(sale);
  const onLive = await productsOnLiveDeal();
  const snapshots: IFlashSaleSnapshot[] = [];
  for (const item of sale.items) {
    if (item.endedEarly) continue;
    if (onLive.has(String(item.productId))) {
      item.endedEarly = true;
      item.skippedReason = "live_deal";
      continue;
    }
    const snap = await applyItem(item);
    if (snap) snapshots.push(snap);
    else {
      item.endedEarly = true;
      item.skippedReason = "missing";
    }
  }
  sale.priceSnapshot = snapshots as never;
  sale.markModified("items");
}

async function restorePrices(sale: InstanceType<typeof FlashSale>, productIds?: Set<string>) {
  const keep: IFlashSaleSnapshot[] = [];
  for (const snap of sale.priceSnapshot) {
    if (productIds && !productIds.has(String(snap.productId))) {
      keep.push(snap);
      continue;
    }
    await restoreSnapshot(snap);
  }
  sale.priceSnapshot = keep as never;
}

/** Units of each product ordered since the sale began (cancelled orders aside). */
async function unitsSoldSince(since: Date, productIds: Types.ObjectId[]) {
  const rows = await Order.aggregate<{ _id: Types.ObjectId; units: number }>([
    { $match: { createdAt: { $gte: since }, status: { $ne: "cancelled" }, "items.productId": { $in: productIds } } },
    { $unwind: "$items" },
    { $match: { "items.productId": { $in: productIds } } },
    { $group: { _id: "$items.productId", units: { $sum: "$items.quantity" } } },
  ]);
  return new Map(rows.map((row) => [String(row._id), row.units]));
}

/**
 * The minute's work: start due sales, end finished ones, and end any product
 * whose cap has been reached. `only` limits it to one sale (after a save).
 */
export async function runFlashSales(options: { only?: Types.ObjectId; now?: Date } = {}) {
  await connectDB();
  const now = options.now ?? new Date();
  const scope = options.only ? { _id: options.only } : {};
  let started = 0;
  let ended = 0;
  let soldOut = 0;

  const due = await FlashSale.find({ ...scope, state: "scheduled", startsAt: { $lte: now }, endsAt: { $gt: now } });
  for (const sale of due) {
    // Claimed first, so two sweeps at once cannot apply the same sale twice.
    const claim = await FlashSale.updateOne({ _id: sale._id, state: "scheduled" }, { $set: { state: "live" }, $min: { startedAt: now } });
    if (claim.modifiedCount !== 1) continue;
    sale.state = "live";
    await applyPrices(sale);
    await sale.save();
    started += 1;
  }

  const over = await FlashSale.find({ ...scope, state: { $in: ["live", "scheduled"] }, endsAt: { $lte: now } });
  for (const sale of over) {
    if (sale.state === "live") await restorePrices(sale);
    sale.state = "ended";
    sale.endedAt = now;
    await sale.save();
    ended += 1;
  }

  const live = await FlashSale.find({ ...scope, state: "live" });
  for (const sale of live) {
    const ids = sale.items.map((item) => item.productId);
    const sold = await unitsSoldSince(sale.startedAt ?? sale.startsAt, ids);
    const reached = new Set<string>();
    for (const item of sale.items) {
      item.soldCount = sold.get(String(item.productId)) ?? 0;
      if (!item.endedEarly && item.quantityLimit && item.soldCount >= item.quantityLimit) {
        item.endedEarly = true;
        item.skippedReason = "sold_out";
        reached.add(String(item.productId));
      }
    }
    if (reached.size) {
      await restorePrices(sale, reached);
      soldOut += reached.size;
    }
    sale.markModified("items");
    await sale.save();
  }

  if (started || ended || soldOut) revalidateProductContent();
  return { started, ended, soldOut, live: live.length };
}

/* ------------------------------------------------------------------ */
/* Storefront                                                          */
/* ------------------------------------------------------------------ */

export interface PublicFlashSale {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  live: boolean;
  items: Array<{
    productId: string;
    discountPercent: number;
    quantityLimit: number | null;
    soldCount: number;
    soldOut: boolean;
  }>;
}

/** Sales on now, and those starting within a week, for the storefront. */
export async function publicFlashSales(): Promise<PublicFlashSale[]> {
  await connectDB();
  const now = new Date();
  const sales = await FlashSale.find({
    $or: [
      { state: "live", endsAt: { $gt: now } },
      { state: "scheduled", startsAt: { $lte: new Date(now.getTime() + 7 * 86_400_000) }, endsAt: { $gt: now } },
    ],
  })
    .sort({ startsAt: 1 })
    .limit(10)
    .lean<IFlashSale[]>();
  return sales.map((sale) => ({
    id: String(sale._id),
    name: sale.name,
    startsAt: sale.startsAt.toISOString(),
    endsAt: sale.endsAt.toISOString(),
    live: sale.state === "live",
    items: sale.items
      .filter((item) => item.skippedReason !== "live_deal" && item.skippedReason !== "missing")
      .map((item) => ({
        productId: String(item.productId),
        discountPercent: item.discountPercent,
        quantityLimit: item.quantityLimit ?? null,
        soldCount: item.soldCount ?? 0,
        soldOut: item.endedEarly && item.skippedReason === "sold_out",
      })),
  }));
}
