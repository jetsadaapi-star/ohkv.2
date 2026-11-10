import "server-only";

import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { PlatformPayment, Vendor } from "@/models";
import type { IPlatformPayment, IPlatformTransfer } from "@/models/platformPayment.model";
import { NotificationType } from "@/models/notification.model";
import { NotFoundError, ValidationError } from "@/lib/api/errors";
import { getStorageService } from "@/lib/storage";
import { createNotification, notifyAdminsPaymentAnomaly } from "@/lib/notifications/notifications";
import { finalizePlatformPayment } from "@/lib/payments/platform-payments";
import { buildPromptPayPayload, maskPromptPayId } from "@/lib/payments/promptpay";
import { SLIP_KEY_PREFIX, SLIP_MAX_BYTES, SLIP_MIME_TYPES } from "@/lib/payments/transfer-payment";
import type { TransferPaymentView } from "@/lib/payments/transfer-orders";
import type { AuditContext } from "@/lib/audit";
import {
  PLATFORM_PAYMENT_KIND,
  PLATFORM_PAYMENT_STATUS,
  PLATFORM_TRANSFER_METHODS,
  isPlatformTransferMethod,
  type PlatformPaymentKind,
} from "@/config/app.config";

/**
 * A vendor paying the marketplace by PromptPay or bank transfer — for an ad
 * booking, a plan period, or commission owed.
 *
 * 1. The vendor picks the method; `initiatePlatformPayment` freezes where to
 *    pay onto the attempt and sends them to /payment/platform/<id>.
 * 2. They transfer and attach the slip (`attachPlatformTransferSlip`).
 * 3. An admin checks it in Vendors → Transfer slips and approves it — the
 *    attempt is finalized exactly as a gateway's would be, so the ad goes
 *    live, the plan renews or the commission clears — or rejects it, and the
 *    vendor may send another while time remains.
 * 4. An attempt with no slip at its deadline expires, and what it held (an
 *    ad's days) goes back (`expireLapsedPlatformTransfers`).
 */

const MAX_SLIPS = 5;

export const KIND_LABEL_TH: Record<PlatformPaymentKind, string> = {
  [PLATFORM_PAYMENT_KIND.BOOST]: "ค่าโฆษณาสินค้า",
  [PLATFORM_PAYMENT_KIND.SUBSCRIPTION]: "ค่าแพ็กเกจร้านค้า",
  [PLATFORM_PAYMENT_KIND.COMMISSION]: "ค่าคอมมิชชันค้างจ่าย",
};

type Lean = Pick<
  IPlatformPayment,
  "kind" | "vendorId" | "userId" | "provider" | "status" | "amount" | "currency" | "reference" | "createdAt" | "boostTerms"
> & { _id: Types.ObjectId; transfer?: IPlatformTransfer | null };

const FIELDS = "kind vendorId userId provider status amount currency reference transfer createdAt boostTerms";

/**
 * What was bought, in Thai for both sides to read. The routes describe a
 * charge in English for the gateways; an ad booking is rebuilt from its
 * frozen terms, with the product's name the description ends on.
 */
function describe(payment: Pick<Lean, "kind" | "boostTerms" | "transfer">) {
  const raw = payment.transfer?.description ?? "";
  if (payment.kind === PLATFORM_PAYMENT_KIND.BOOST && payment.boostTerms) {
    const product = raw.includes(": ") ? raw.slice(raw.indexOf(": ") + 2) : "";
    const { position, startDay, endDay } = payment.boostTerms;
    return `ลงโฆษณาตำแหน่งที่ ${position} · ${startDay} ถึง ${endDay}${product ? ` · ${product}` : ""}`;
  }
  return raw || KIND_LABEL_TH[payment.kind];
}

/** The attempt, for the vendor who made it (or a member of that store). */
async function loadOwned(paymentId: string, viewer: { userId: string; vendorId?: string | null }) {
  if (!Types.ObjectId.isValid(paymentId)) throw new NotFoundError("Payment");
  await connectDB();
  const payment = await PlatformPayment.findById(paymentId).select(FIELDS).lean<Lean | null>();
  if (!payment || !payment.transfer || !isPlatformTransferMethod(payment.provider)) {
    throw new NotFoundError("Payment");
  }
  const own =
    payment.userId === viewer.userId || (viewer.vendorId && String(payment.vendorId) === String(viewer.vendorId));
  if (!own) throw new NotFoundError("Payment");
  return payment;
}

/** The same page shoppers pay a transfer order on, fed from the attempt. */
function toView(payment: Lean): TransferPaymentView {
  const tp = payment.transfer!;
  const snapshot = tp.snapshot ?? {};
  const paid = payment.status === PLATFORM_PAYMENT_STATUS.PAID || tp.status === "approved";
  const closed =
    !paid &&
    (tp.status === "expired" ||
      [PLATFORM_PAYMENT_STATUS.EXPIRED, PLATFORM_PAYMENT_STATUS.FAILED, PLATFORM_PAYMENT_STATUS.REFUNDED].includes(
        payment.status as never,
      ));
  const method = payment.provider as (typeof PLATFORM_TRANSFER_METHODS)[number];
  return {
    orderNumber: payment.reference,
    method,
    status: tp.status === "approved" ? "approved" : closed ? "expired" : tp.status,
    outcome: paid ? "paid" : closed ? "cancelled" : "open",
    total: payment.amount,
    currency: payment.currency,
    expiresAt: new Date(tp.expiresAt).toISOString(),
    timeLimitMinutes: tp.timeLimitMinutes,
    slipRequired: true,
    slipUploadedAt: tp.slipUploadedAt ? new Date(tp.slipUploadedAt).toISOString() : undefined,
    slipName: tp.slipName,
    slipCount: tp.slipCount ?? 0,
    rejectReason: tp.status === "rejected" ? tp.rejectReason : undefined,
    instructions: snapshot.instructions,
    promptpay:
      method === "promptpay" && snapshot.promptpay
        ? {
            payload: buildPromptPayPayload({
              type: snapshot.promptpay.idType,
              id: snapshot.promptpay.idValue,
              amount: payment.amount,
            }),
            idType: snapshot.promptpay.idType,
            maskedId: maskPromptPayId(snapshot.promptpay.idType, snapshot.promptpay.idValue),
            accountName: snapshot.promptpay.accountName,
          }
        : undefined,
    accounts: method === "bank_transfer" ? snapshot.accounts ?? [] : undefined,
    items: [{ name: `${KIND_LABEL_TH[payment.kind]}: ${describe(payment)}`, quantity: 1 }],
    serverNow: new Date().toISOString(),
  };
}

export interface PlatformTransferPage {
  view: TransferPaymentView;
  kind: PlatformPaymentKind;
}

export async function getPlatformTransferPage(
  paymentId: string,
  viewer: { userId: string; vendorId?: string | null },
): Promise<PlatformTransferPage> {
  void expireLapsedPlatformTransfers().catch(() => undefined);
  let payment = await loadOwned(paymentId, viewer);
  if (dueToExpire(payment)) {
    await expireOne(payment._id);
    payment = await loadOwned(paymentId, viewer);
  }
  return { view: toView(payment), kind: payment.kind };
}

function dueToExpire(payment: Lean) {
  const tp = payment.transfer;
  return (
    payment.status === PLATFORM_PAYMENT_STATUS.PENDING &&
    tp &&
    (tp.status === "awaiting_slip" || tp.status === "rejected") &&
    new Date(tp.expiresAt).getTime() <= Date.now()
  );
}

/** Store the slip privately and put the attempt in the admins' queue. */
export async function attachPlatformTransferSlip(
  paymentId: string,
  viewer: { userId: string; vendorId?: string | null },
  file: File,
): Promise<TransferPaymentView> {
  const payment = await loadOwned(paymentId, viewer);
  const tp = payment.transfer!;
  if (payment.status === PLATFORM_PAYMENT_STATUS.PAID || tp.status === "approved") {
    throw new ValidationError("รายการนี้ชำระเงินเรียบร้อยแล้ว");
  }
  if (payment.status !== PLATFORM_PAYMENT_STATUS.PENDING || tp.status === "expired") {
    throw new ValidationError("รายการนี้หมดเวลาหรือถูกยกเลิกแล้ว กรุณาเริ่มชำระใหม่");
  }
  if (tp.status === "reviewing") {
    throw new ValidationError("ทีมงานกำลังตรวจสอบสลิปที่ส่งไว้ กรุณารอผลการตรวจสอบ");
  }
  if (new Date(tp.expiresAt).getTime() <= Date.now()) {
    await expireOne(payment._id);
    throw new ValidationError("หมดเวลาชำระเงินแล้ว กรุณาเริ่มชำระใหม่");
  }
  if ((tp.slipCount ?? 0) >= MAX_SLIPS) {
    throw new ValidationError("ส่งสลิปครบจำนวนครั้งที่กำหนดแล้ว กรุณาติดต่อผู้ดูแลตลาดออนไลน์");
  }
  const mimeType = file.type || "application/octet-stream";
  if (!(SLIP_MIME_TYPES as readonly string[]).includes(mimeType)) {
    throw new ValidationError("รองรับเฉพาะไฟล์รูป PNG, JPG หรือ WebP");
  }
  if (file.size <= 0 || file.size > SLIP_MAX_BYTES) {
    throw new ValidationError("ไฟล์สลิปต้องมีขนาดไม่เกิน 3 MB");
  }

  const storage = await getStorageService();
  const ext = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
  const uploaded = await storage.uploadPrivateFile(Buffer.from(await file.arrayBuffer()), {
    fileName: `slip-${payment.reference}.${ext}`,
    contentType: mimeType,
    fileSize: file.size,
    customPath: SLIP_KEY_PREFIX,
    metadata: { reference: payment.reference, purpose: "platform-payment-slip" },
  });

  // Conditional: a review or the deadline that landed meanwhile wins.
  const updated = await PlatformPayment.findOneAndUpdate(
    {
      _id: payment._id,
      status: PLATFORM_PAYMENT_STATUS.PENDING,
      "transfer.status": { $in: ["awaiting_slip", "rejected"] },
    },
    {
      $set: {
        "transfer.status": "reviewing",
        "transfer.slipKey": uploaded.key,
        "transfer.slipName": file.name.slice(0, 160),
        "transfer.slipUploadedAt": new Date(),
      },
      $unset: { "transfer.rejectReason": "" },
      $inc: { "transfer.slipCount": 1 },
    },
    { returnDocument: "after" },
  )
    .select(FIELDS)
    .lean<Lean | null>();
  if (!updated) {
    await storage.deletePrivateFile(uploaded.key).catch(() => undefined);
    throw new ValidationError("สถานะรายการเปลี่ยนไปแล้ว กรุณารีเฟรชหน้า");
  }

  const vendor = await Vendor.findById(payment.vendorId).select("storeName").lean<{ storeName?: string } | null>();
  void notifyAdminsPaymentAnomaly({
    title: `ร้านค้าแจ้งโอน${KIND_LABEL_TH[payment.kind]} · ${vendor?.storeName ?? payment.reference}`,
    message: `${vendor?.storeName ?? "ร้านค้า"} แนบสลิป${payment.provider === "promptpay" ? "พร้อมเพย์" : "โอนผ่านธนาคาร"} ยอด ${payment.amount.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท กรุณาตรวจสอบและยืนยัน`,
    dedupeKey: `platform-slip:${String(payment._id)}:${(tp.slipCount ?? 0) + 1}`,
    link: "/admin/vendors/transfer-slips",
  });

  return toView(updated);
}

/* ------------------------------------------------------------------ */
/* Admin                                                               */
/* ------------------------------------------------------------------ */

export interface PlatformTransferRow {
  id: string;
  kind: PlatformPaymentKind;
  kindLabel: string;
  description?: string;
  method: string;
  amount: number;
  currency: string;
  reference: string;
  status: IPlatformTransfer["status"];
  paymentStatus: string;
  vendor: { id: string; name: string; slug?: string } | null;
  createdAt: string;
  expiresAt: string;
  slipUploadedAt?: string;
  slipCount: number;
  hasSlip: boolean;
  rejectReason?: string;
  reviewedAt?: string;
}

/** The queue: slips waiting first, then the recent history. */
export async function listPlatformTransfers(filter: "reviewing" | "all" = "reviewing"): Promise<PlatformTransferRow[]> {
  await connectDB();
  void expireLapsedPlatformTransfers().catch(() => undefined);
  const query =
    filter === "reviewing"
      ? { "transfer.status": "reviewing" as const, status: PLATFORM_PAYMENT_STATUS.PENDING }
      : { "transfer.status": { $exists: true } };
  const rows = await PlatformPayment.find(query)
    .sort(filter === "reviewing" ? { "transfer.slipUploadedAt": 1 } : { createdAt: -1 })
    .limit(200)
    .select(FIELDS)
    .populate({ path: "vendorId", select: "storeName slug" })
    .lean<Array<Omit<Lean, "vendorId"> & { vendorId: { _id: Types.ObjectId; storeName?: string; slug?: string } | null }>>();
  return rows.map((row) => {
    const tp = row.transfer!;
    return {
      id: String(row._id),
      kind: row.kind,
      kindLabel: KIND_LABEL_TH[row.kind],
      description: describe(row),
      method: row.provider,
      amount: row.amount,
      currency: row.currency,
      reference: row.reference,
      status: tp.status,
      paymentStatus: row.status,
      vendor: row.vendorId ? { id: String(row.vendorId._id), name: row.vendorId.storeName ?? "", slug: row.vendorId.slug } : null,
      createdAt: new Date(row.createdAt).toISOString(),
      expiresAt: new Date(tp.expiresAt).toISOString(),
      slipUploadedAt: tp.slipUploadedAt ? new Date(tp.slipUploadedAt).toISOString() : undefined,
      slipCount: tp.slipCount ?? 0,
      hasSlip: Boolean(tp.slipKey),
      rejectReason: tp.rejectReason,
      reviewedAt: tp.reviewedAt ? new Date(tp.reviewedAt).toISOString() : undefined,
    };
  });
}

export async function countPlatformTransfersAwaitingReview() {
  await connectDB();
  return PlatformPayment.countDocuments({ "transfer.status": "reviewing", status: PLATFORM_PAYMENT_STATUS.PENDING });
}

export async function getPlatformTransferSlipKey(paymentId: string): Promise<string | null> {
  if (!Types.ObjectId.isValid(paymentId)) return null;
  await connectDB();
  const row = await PlatformPayment.findById(paymentId).select("transfer.slipKey").lean<{ transfer?: { slipKey?: string } } | null>();
  return row?.transfer?.slipKey ?? null;
}

/**
 * Approve: the money is in the account, so the attempt is finalized as a
 * gateway would finalize it — the ad goes live, the plan period starts, the
 * commission clears. Reject: the vendor is told why and may send another
 * slip while time remains (the deadline is pushed out a day so they can).
 */
export async function reviewPlatformTransfer(params: {
  paymentId: string;
  action: "approve" | "reject";
  reason?: string;
  reviewerId: string;
  auditContext: AuditContext;
}) {
  if (!Types.ObjectId.isValid(params.paymentId)) throw new NotFoundError("Payment");
  await connectDB();
  const payment = await PlatformPayment.findById(params.paymentId);
  if (!payment || !payment.transfer) throw new NotFoundError("Payment");
  if (payment.transfer.status !== "reviewing" || payment.status !== PLATFORM_PAYMENT_STATUS.PENDING) {
    throw new ValidationError("รายการนี้ไม่ได้อยู่ระหว่างรอตรวจสอบแล้ว กรุณารีเฟรชหน้า");
  }

  if (params.action === "reject") {
    const reason = (params.reason ?? "").trim().slice(0, 300) || "ไม่พบยอดโอนที่ตรงกับสลิปนี้";
    await PlatformPayment.updateOne(
      { _id: payment._id, "transfer.status": "reviewing" },
      {
        $set: {
          "transfer.status": "rejected",
          "transfer.rejectReason": reason,
          "transfer.reviewedAt": new Date(),
          "transfer.reviewedBy": params.reviewerId,
          // A day to send the right slip, from now.
          "transfer.expiresAt": new Date(Math.max(new Date(payment.transfer.expiresAt).getTime(), Date.now() + 86_400_000)),
        },
      },
    );
    await notifyVendor(payment, "สลิปโอนเงินไม่ผ่านการตรวจสอบ", `${KIND_LABEL_TH[payment.kind]}: ${reason} กรุณาส่งสลิปใหม่`);
    return { status: "rejected" as const };
  }

  // Amount and currency are the attempt's own: the admin is confirming that
  // exactly this was received.
  const result = await finalizePlatformPayment(
    payment,
    { amount: payment.amount, currency: payment.currency },
    params.auditContext,
  );
  if (!result.paid) throw new ValidationError("ยืนยันการชำระเงินไม่สำเร็จ รายการอาจถูกยกเลิกไปแล้ว");
  await PlatformPayment.updateOne(
    { _id: payment._id },
    {
      $set: {
        "transfer.status": "approved",
        "transfer.reviewedAt": new Date(),
        "transfer.reviewedBy": params.reviewerId,
      },
    },
  );
  await notifyVendor(payment, "ยืนยันการชำระเงินแล้ว", `${KIND_LABEL_TH[payment.kind]} ยอด ${payment.amount.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท ได้รับการยืนยันแล้ว`);
  return { status: "approved" as const };
}

async function notifyVendor(payment: IPlatformPayment, title: string, message: string) {
  if (!payment.userId) return;
  await createNotification({
    userId: payment.userId,
    type: NotificationType.PAYMENT_RECEIVED,
    title,
    message,
    link: `/payment/platform/${String(payment._id)}`,
    data: { platformPaymentId: String(payment._id), kind: payment.kind },
  }).catch(() => undefined);
}

/* ------------------------------------------------------------------ */
/* Expiry                                                              */
/* ------------------------------------------------------------------ */

async function expireOne(id: Types.ObjectId) {
  await PlatformPayment.updateOne(
    {
      _id: id,
      status: PLATFORM_PAYMENT_STATUS.PENDING,
      "transfer.status": { $in: ["awaiting_slip", "rejected"] },
      "transfer.expiresAt": { $lte: new Date() },
    },
    {
      $set: {
        status: PLATFORM_PAYMENT_STATUS.EXPIRED,
        "transfer.status": "expired",
        failureReason: "No transfer slip before the deadline",
      },
    },
  );
}

let sweeping: Promise<number> | null = null;

/**
 * Transfers with no slip by their deadline expire. An expired attempt no
 * longer holds anything: the ad-hold sweep then gives the days back.
 */
export function expireLapsedPlatformTransfers(): Promise<number> {
  sweeping ??= (async () => {
    try {
      await connectDB();
      const result = await PlatformPayment.updateMany(
        {
          status: PLATFORM_PAYMENT_STATUS.PENDING,
          "transfer.status": { $in: ["awaiting_slip", "rejected"] },
          "transfer.expiresAt": { $lte: new Date() },
        },
        {
          $set: {
            status: PLATFORM_PAYMENT_STATUS.EXPIRED,
            "transfer.status": "expired",
            failureReason: "No transfer slip before the deadline",
          },
        },
      );
      return result.modifiedCount;
    } finally {
      sweeping = null;
    }
  })();
  return sweeping;
}
