import "server-only";
import { randomBytes } from "node:crypto";
import { Order } from "@/models";
import { ORDER_STATUS, PAYMENT_STATUS } from "@/config/app.config";
import { ValidationError } from "@/lib/api/errors";
import { createSystemAuditContext } from "@/lib/audit";
import { getStorageService } from "@/lib/storage";
import { notifyAdminsPaymentAnomaly } from "@/lib/notifications/notifications";
import {
  buildPromptPayPayload,
  isPromptPayIdType,
  maskPromptPayId,
  promptPayIdProblem,
  type PromptPayIdType,
} from "@/lib/payments/promptpay";
import {
  clampTimeLimit,
  SLIP_KEY_PREFIX,
  SLIP_MAX_BYTES,
  SLIP_MIME_TYPES,
  type StoreBankAccount,
  type TransferPaymentMethod,
  type TransferSnapshot,
  type TransferStatus,
} from "@/lib/payments/transfer-payment";

/**
 * PromptPay and bank-transfer orders, from placement to paid.
 *
 * 1. Checkout places the order as cash on delivery would (stock and coupon
 *    taken now) and `startTransferPayment` stamps it with a payment token,
 *    a deadline and a snapshot of where to pay.
 * 2. The shopper opens /payment/<token>, transfers, and attaches the slip.
 * 3. An admin checks the slip on the order page and approves it (the order
 *    is marked paid through the normal admin path) or rejects it (the
 *    shopper may send another while time remains).
 * 4. An order still without a slip at its deadline is cancelled, which
 *    gives back its stock and coupon (`expireTransferOrders`).
 */

type PaymentSettingsLike = {
  general?: { defaultCurrency?: string };
  payment?: {
    promptpay?: {
      enabled?: boolean;
      idType?: string;
      idValue?: string;
      accountName?: string;
      instructions?: string;
    };
    bank_transfer?: {
      enabled?: boolean;
      accounts?: StoreBankAccount[];
      instructions?: string;
    };
    transfer?: { timeLimitMinutes?: number; slipRequired?: boolean };
  };
};

function promptPayReady(settings: PaymentSettingsLike): boolean {
  const pp = settings.payment?.promptpay;
  if (!pp?.enabled) return false;
  const type: PromptPayIdType = isPromptPayIdType(pp.idType) ? pp.idType : "phone";
  return promptPayIdProblem(type, pp.idValue) === null;
}

function bankTransferReady(settings: PaymentSettingsLike): boolean {
  const bt = settings.payment?.bank_transfer;
  return Boolean(bt?.enabled && (bt.accounts ?? []).some((a) => a.accountNumber && a.accountName));
}

/** Whether checkout may offer the method right now. */
export function isTransferMethodReady(settings: PaymentSettingsLike, method: TransferPaymentMethod): boolean {
  const currency = String(settings.general?.defaultCurrency || "THB").toUpperCase();
  if (currency !== "THB") return false;
  return method === "promptpay" ? promptPayReady(settings) : bankTransferReady(settings);
}

/** Refuse a transfer checkout the store cannot take. */
export function assertTransferAllowed(params: {
  settings: PaymentSettingsLike;
  method: TransferPaymentMethod;
  hasPreorder: boolean;
}) {
  if (!isTransferMethodReady(params.settings, params.method)) {
    throw new ValidationError({
      paymentMethod: ["ช่องทางชำระเงินนี้ยังไม่เปิดให้บริการ กรุณาเลือกช่องทางอื่น"],
    });
  }
  // A pre-order's deposit and balance maths expect a gateway that can come
  // back for the rest; a slip cannot.
  if (params.hasPreorder) {
    throw new ValidationError({
      paymentMethod: ["สินค้าพรีออร์เดอร์ชำระด้วยการโอนไม่ได้ กรุณาเลือกช่องทางอื่น"],
    });
  }
}

function snapshotFor(settings: PaymentSettingsLike, method: TransferPaymentMethod): TransferSnapshot {
  if (method === "promptpay") {
    const pp = settings.payment?.promptpay ?? {};
    return {
      promptpay: {
        idType: isPromptPayIdType(pp.idType) ? pp.idType : "phone",
        idValue: String(pp.idValue ?? ""),
        accountName: pp.accountName || undefined,
      },
      instructions: pp.instructions || undefined,
    };
  }
  const bt = settings.payment?.bank_transfer ?? {};
  return {
    accounts: (bt.accounts ?? []).map((a) => ({
      bankName: a.bankName,
      accountName: a.accountName,
      accountNumber: a.accountNumber,
      ...(a.branch ? { branch: a.branch } : {}),
    })),
    instructions: bt.instructions || undefined,
  };
}

/** Stamp a freshly placed order with its payment page. Returns the token. */
export async function startTransferPayment(
  orderId: unknown,
  method: TransferPaymentMethod,
  settings: PaymentSettingsLike,
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(24).toString("base64url");
  const minutes = clampTimeLimit(settings.payment?.transfer?.timeLimitMinutes);
  const expiresAt = new Date(Date.now() + minutes * 60_000);
  await Order.updateOne(
    { _id: orderId },
    {
      $set: {
        transferPayment: {
          token,
          method,
          status: "awaiting_slip",
          expiresAt,
          timeLimitMinutes: minutes,
          slipRequired: settings.payment?.transfer?.slipRequired !== false,
          snapshot: snapshotFor(settings, method),
          slipCount: 0,
        },
      },
    },
  );
  return { token, expiresAt };
}

type TransferOrderLean = {
  _id: unknown;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  total: number;
  currency?: string;
  createdAt?: Date;
  customerId?: unknown;
  guestEmail?: string;
  items?: Array<{ name?: string; quantity?: number; image?: string; price?: number }>;
  transferPayment?: {
    token: string;
    method: TransferPaymentMethod;
    status: TransferStatus;
    expiresAt: Date;
    timeLimitMinutes?: number;
    slipRequired?: boolean;
    snapshot?: TransferSnapshot;
    slipKey?: string;
    slipName?: string;
    slipUploadedAt?: Date;
    slipCount?: number;
    reviewedAt?: Date;
    rejectReason?: string;
  };
};

const VIEW_FIELDS =
  "_id orderNumber status paymentStatus paymentMethod total currency createdAt items.name items.quantity items.image items.price transferPayment";

/** What the shopper's payment page shows. Never the raw PromptPay ID. */
export interface TransferPaymentView {
  orderNumber: string;
  method: TransferPaymentMethod;
  status: TransferStatus;
  /** "paid" | "cancelled" | "open" — the order as the page should read it. */
  outcome: "paid" | "cancelled" | "open";
  total: number;
  currency: string;
  expiresAt: string;
  timeLimitMinutes: number;
  slipRequired: boolean;
  slipUploadedAt?: string;
  slipName?: string;
  slipCount: number;
  rejectReason?: string;
  instructions?: string;
  promptpay?: {
    payload: string;
    idType: PromptPayIdType;
    maskedId: string;
    accountName?: string;
  };
  accounts?: StoreBankAccount[];
  items: Array<{ name: string; quantity: number; image?: string }>;
  serverNow: string;
}

function toView(order: TransferOrderLean): TransferPaymentView | null {
  const tp = order.transferPayment;
  if (!tp) return null;
  const snapshot = tp.snapshot ?? {};
  const paid = order.paymentStatus === PAYMENT_STATUS.PAID || tp.status === "approved";
  const cancelled = order.status === ORDER_STATUS.CANCELLED || tp.status === "expired";
  return {
    orderNumber: order.orderNumber,
    method: tp.method,
    status: tp.status,
    outcome: paid ? "paid" : cancelled ? "cancelled" : "open",
    total: order.total,
    currency: order.currency || "THB",
    expiresAt: new Date(tp.expiresAt).toISOString(),
    timeLimitMinutes: tp.timeLimitMinutes ?? 30,
    slipRequired: tp.slipRequired !== false,
    slipUploadedAt: tp.slipUploadedAt ? new Date(tp.slipUploadedAt).toISOString() : undefined,
    slipName: tp.slipName,
    slipCount: tp.slipCount ?? 0,
    rejectReason: tp.status === "rejected" ? tp.rejectReason : undefined,
    instructions: snapshot.instructions,
    promptpay:
      tp.method === "promptpay" && snapshot.promptpay
        ? {
            payload: buildPromptPayPayload({
              type: snapshot.promptpay.idType,
              id: snapshot.promptpay.idValue,
              amount: order.total,
            }),
            idType: snapshot.promptpay.idType,
            maskedId: maskPromptPayId(snapshot.promptpay.idType, snapshot.promptpay.idValue),
            accountName: snapshot.promptpay.accountName,
          }
        : undefined,
    accounts: tp.method === "bank_transfer" ? snapshot.accounts ?? [] : undefined,
    items: (order.items ?? []).map((i) => ({
      name: String(i.name ?? ""),
      quantity: Number(i.quantity ?? 1),
      image: i.image,
    })),
    serverNow: new Date().toISOString(),
  };
}

function validToken(token: string) {
  return /^[A-Za-z0-9_-]{20,64}$/.test(token);
}

export async function getTransferPaymentView(token: string): Promise<TransferPaymentView | null> {
  if (!validToken(token)) return null;
  let order = await Order.findOne({ "transferPayment.token": token }).select(VIEW_FIELDS).lean<TransferOrderLean>();
  if (!order) return null;
  const tp = order.transferPayment;
  const due =
    tp &&
    (tp.status === "awaiting_slip" || tp.status === "rejected") &&
    new Date(tp.expiresAt).getTime() <= Date.now();
  if (due) {
    // Expired here or by a sweep running alongside: either way, read it again.
    await expireIfDue(order);
    order = await Order.findOne({ _id: order._id }).select(VIEW_FIELDS).lean<TransferOrderLean>();
    if (!order) return null;
  }
  return toView(order);
}

/** Store the slip privately and hand the order to the store for review. */
export async function attachTransferSlip(token: string, file: File): Promise<TransferPaymentView> {
  if (!validToken(token)) throw new ValidationError("ไม่พบรายการชำระเงิน");
  const order = await Order.findOne({ "transferPayment.token": token }).select(VIEW_FIELDS).lean<TransferOrderLean>();
  const tp = order?.transferPayment;
  if (!order || !tp) throw new ValidationError("ไม่พบรายการชำระเงิน");

  if (order.paymentStatus === PAYMENT_STATUS.PAID || tp.status === "approved") {
    throw new ValidationError("รายการนี้ชำระเงินเรียบร้อยแล้ว");
  }
  if (order.status === ORDER_STATUS.CANCELLED || tp.status === "expired") {
    throw new ValidationError("รายการนี้ถูกยกเลิกหรือหมดเวลาชำระแล้ว");
  }
  if (tp.status === "reviewing") {
    throw new ValidationError("ร้านค้ากำลังตรวจสอบสลิปที่ส่งไว้ กรุณารอผลการตรวจสอบ");
  }
  if (new Date(tp.expiresAt).getTime() <= Date.now()) {
    await expireIfDue(order);
    throw new ValidationError("หมดเวลาชำระเงินแล้ว");
  }
  if ((tp.slipCount ?? 0) >= 5) {
    throw new ValidationError("ส่งสลิปครบจำนวนครั้งที่กำหนดแล้ว กรุณาติดต่อร้านค้า");
  }

  const mimeType = file.type || "application/octet-stream";
  if (!(SLIP_MIME_TYPES as readonly string[]).includes(mimeType)) {
    throw new ValidationError("รองรับเฉพาะไฟล์รูป PNG, JPG หรือ WebP");
  }
  if (file.size <= 0 || file.size > SLIP_MAX_BYTES) {
    throw new ValidationError("ไฟล์สลิปต้องมีขนาดไม่เกิน 3 MB");
  }

  const storage = await getStorageService();
  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
  const uploaded = await storage.uploadPrivateFile(buffer, {
    fileName: `slip-${order.orderNumber}.${ext}`,
    contentType: mimeType,
    fileSize: file.size,
    customPath: SLIP_KEY_PREFIX,
    metadata: { orderNumber: order.orderNumber, purpose: "payment-slip" },
  });

  // Conditional: a review or the deadline that landed meanwhile wins.
  const updated = await Order.findOneAndUpdate(
    {
      _id: order._id,
      status: { $ne: ORDER_STATUS.CANCELLED },
      paymentStatus: { $ne: PAYMENT_STATUS.PAID },
      "transferPayment.status": { $in: ["awaiting_slip", "rejected"] },
    },
    {
      $set: {
        "transferPayment.status": "reviewing",
        "transferPayment.slipKey": uploaded.key,
        "transferPayment.slipName": file.name.slice(0, 160),
        "transferPayment.slipUploadedAt": new Date(),
      },
      $unset: { "transferPayment.rejectReason": "" },
      $inc: { "transferPayment.slipCount": 1 },
    },
    { returnDocument: "after" },
  )
    .select(VIEW_FIELDS)
    .lean<TransferOrderLean>();
  if (!updated) {
    await storage.deletePrivateFile(uploaded.key).catch(() => undefined);
    throw new ValidationError("สถานะรายการเปลี่ยนไปแล้ว กรุณารีเฟรชหน้า");
  }

  void notifyAdminsPaymentAnomaly({
    title: `มีสลิปโอนเงินรอตรวจสอบ · ${order.orderNumber}`,
    message: `ลูกค้าแนบสลิป${tp.method === "promptpay" ? "พร้อมเพย์" : "โอนผ่านธนาคาร"} ยอด ${order.total.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท กรุณาตรวจสอบและยืนยันการชำระเงิน`,
    dedupeKey: `transfer-slip:${String(order._id)}:${(tp.slipCount ?? 0) + 1}`,
    link: `/admin/orders/${String(order._id)}`,
  });

  return toView(updated)!;
}

/** The slip, for an admin. */
export async function getTransferSlipKey(orderId: string): Promise<string | null> {
  const order = await Order.findOne({ _id: orderId }).select("transferPayment.slipKey").lean<TransferOrderLean>();
  return order?.transferPayment?.slipKey ?? null;
}

/** What the admin order page shows about the transfer. */
export async function getTransferAdminState(orderId: string) {
  const order = await Order.findOne({ _id: orderId }).select(VIEW_FIELDS).lean<TransferOrderLean>();
  if (!order?.transferPayment) return null;
  await expireIfDue(order);
  const fresh = await Order.findOne({ _id: orderId }).select(VIEW_FIELDS).lean<TransferOrderLean>();
  if (!fresh?.transferPayment) return null;
  const view = toView(fresh)!;
  const tp = fresh.transferPayment;
  return {
    ...view,
    hasSlip: Boolean(tp.slipKey),
    reviewedAt: tp.reviewedAt ? new Date(tp.reviewedAt).toISOString() : undefined,
    rejectReason: tp.rejectReason,
    token: tp.token,
    promptpayId:
      tp.method === "promptpay" && tp.snapshot?.promptpay
        ? { idType: tp.snapshot.promptpay.idType, idValue: tp.snapshot.promptpay.idValue }
        : undefined,
  };
}

/** Record the admin's decision on the slip. Approval's money side is the caller's. */
export async function recordTransferReview(params: {
  orderId: string;
  decision: "approved" | "rejected";
  reason?: string;
  reviewer: string;
}) {
  const update =
    params.decision === "approved"
      ? {
          $set: {
            "transferPayment.status": "approved",
            "transferPayment.reviewedAt": new Date(),
            "transferPayment.reviewedBy": params.reviewer,
          },
          $unset: { "transferPayment.rejectReason": "" },
        }
      : {
          $set: {
            "transferPayment.status": "rejected",
            "transferPayment.reviewedAt": new Date(),
            "transferPayment.reviewedBy": params.reviewer,
            "transferPayment.rejectReason": (params.reason || "สลิปไม่ถูกต้อง").slice(0, 300),
            // A refused slip gives the shopper time to send the right one.
            "transferPayment.expiresAt": new Date(Date.now() + 30 * 60_000),
          },
        };
  const result = await Order.updateOne(
    {
      _id: params.orderId,
      "transferPayment.status":
        params.decision === "approved" ? { $in: ["reviewing", "rejected", "awaiting_slip"] } : "reviewing",
    },
    update,
  );
  if (result.matchedCount === 0) {
    throw new ValidationError("สถานะการชำระเงินเปลี่ยนไปแล้ว กรุณารีเฟรชหน้า");
  }
}

/** Undo an approval whose money side failed. */
export async function revertTransferApproval(orderId: string) {
  await Order.updateOne(
    { _id: orderId, "transferPayment.status": "approved", paymentStatus: { $ne: PAYMENT_STATUS.PAID } },
    { $set: { "transferPayment.status": "reviewing" }, $unset: { "transferPayment.reviewedAt": "", "transferPayment.reviewedBy": "" } },
  ).catch(() => undefined);
}

async function expireIfDue(order: TransferOrderLean): Promise<boolean> {
  const tp = order.transferPayment;
  if (!tp) return false;
  if (tp.status !== "awaiting_slip" && tp.status !== "rejected") return false;
  if (order.paymentStatus === PAYMENT_STATUS.PAID || order.status === ORDER_STATUS.CANCELLED) return false;
  if (new Date(tp.expiresAt).getTime() > Date.now()) return false;
  return expireTransferOrder(order._id);
}

async function expireTransferOrder(orderId: unknown): Promise<boolean> {
  // Claim it first, so a slip arriving this instant is refused rather than
  // landing on an order about to be cancelled.
  const claimed = await Order.updateOne(
    {
      _id: orderId,
      paymentStatus: PAYMENT_STATUS.PENDING,
      "transferPayment.status": { $in: ["awaiting_slip", "rejected"] },
      "transferPayment.expiresAt": { $lte: new Date() },
    },
    { $set: { "transferPayment.status": "expired" } },
  );
  if (claimed.modifiedCount !== 1) return false;
  try {
    const { cancelOrderForCustomer } = await import("@/lib/orders/customer-cancel");
    await cancelOrderForCustomer({
      orderFilter: { _id: orderId },
      auditContext: createSystemAuditContext(),
      reason: "หมดเวลาชำระเงิน (ไม่ได้รับสลิปการโอน)",
      by: "system",
      allowedStatuses: [ORDER_STATUS.PENDING],
    });
  } catch (err) {
    // Someone moved the order on (e.g. an admin processed it): keep it, and
    // let the store decide.
    console.error("Failed to cancel an expired transfer order:", err);
    await Order.updateOne(
      { _id: orderId, status: { $ne: ORDER_STATUS.CANCELLED } },
      { $set: { "transferPayment.status": "awaiting_slip" } },
    ).catch(() => undefined);
    return false;
  }
  return true;
}

/** Cancel every transfer order whose time ran out with no slip. */
export async function expireTransferOrders(options: { limit?: number } = {}) {
  const due = await Order.find({
    "transferPayment.status": { $in: ["awaiting_slip", "rejected"] },
    "transferPayment.expiresAt": { $lte: new Date() },
    paymentStatus: PAYMENT_STATUS.PENDING,
    status: { $ne: ORDER_STATUS.CANCELLED },
  })
    .select("_id")
    .limit(options.limit ?? 50)
    .lean<{ _id: unknown }[]>();
  let expired = 0;
  for (const row of due) {
    if (await expireTransferOrder(row._id)) expired++;
  }
  return { expired };
}

let lastSweep = 0;
/** At most once a minute per process: cheap enough to call from busy routes. */
export function sweepTransferExpiry() {
  const now = Date.now();
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  void expireTransferOrders({ limit: 25 }).catch((err) =>
    console.error("Transfer expiry sweep failed:", err),
  );
}
