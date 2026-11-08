/**
 * Pay-by-transfer methods: PromptPay QR and a transfer into one of the
 * store's bank accounts. The shopper transfers in their banking app, attaches
 * the slip, and the store checks it and marks the order paid.
 *
 * Shared by the server and the browser — no server-only imports here.
 */
import type { PromptPayIdType } from "@/lib/payments/promptpay";

export const TRANSFER_PAYMENT_METHODS = ["promptpay", "bank_transfer"] as const;
export type TransferPaymentMethod = (typeof TRANSFER_PAYMENT_METHODS)[number];

export function isTransferPaymentMethod(value: unknown): value is TransferPaymentMethod {
  return typeof value === "string" && (TRANSFER_PAYMENT_METHODS as readonly string[]).includes(value);
}

/**
 * - awaiting_slip — waiting for the shopper to transfer and attach a slip
 * - reviewing     — slip attached; the store is checking it
 * - approved      — the store confirmed the money; the order is paid
 * - rejected      — the store refused the slip; the shopper may send another
 * - expired       — time ran out with no slip; the order was cancelled
 */
export const TRANSFER_STATUSES = ["awaiting_slip", "reviewing", "approved", "rejected", "expired"] as const;
export type TransferStatus = (typeof TRANSFER_STATUSES)[number];

export const TRANSFER_TIME_LIMIT_DEFAULT = 30;
export const TRANSFER_TIME_LIMIT_MIN = 5;
/** Seven days. */
export const TRANSFER_TIME_LIMIT_MAX = 10080;
export const TRANSFER_TIME_LIMIT_PRESETS = [15, 30, 60, 180, 1440] as const;

export const SLIP_MAX_BYTES = 3 * 1024 * 1024;
export const SLIP_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export const SLIP_KEY_PREFIX = "payment-slips/";

export function isSlipKey(key: string): boolean {
  return (
    key.startsWith(SLIP_KEY_PREFIX) &&
    !key.includes("\\") &&
    key.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..")
  );
}

export function clampTimeLimit(value: unknown): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n <= 0) return TRANSFER_TIME_LIMIT_DEFAULT;
  return Math.min(TRANSFER_TIME_LIMIT_MAX, Math.max(TRANSFER_TIME_LIMIT_MIN, n));
}

export interface PromptPaySettingsValue {
  enabled?: boolean;
  idType?: PromptPayIdType;
  idValue?: string;
  accountName?: string;
  instructions?: string;
}

export interface StoreBankAccount {
  bankName: string;
  accountName: string;
  accountNumber: string;
  branch?: string;
}

export interface BankTransferSettingsValue {
  enabled?: boolean;
  accounts?: StoreBankAccount[];
  instructions?: string;
}

export interface TransferRulesValue {
  timeLimitMinutes?: number;
  /** Ask for a slip before the order is reviewed. On by default. */
  slipRequired?: boolean;
}

/** What the order keeps of where the shopper was told to pay. */
export interface TransferSnapshot {
  promptpay?: { idType: PromptPayIdType; idValue: string; accountName?: string };
  accounts?: StoreBankAccount[];
  instructions?: string;
}

/** The time limit, in hours/minutes, as Thai text. */
export function describeMinutes(minutes: number, locale: string): string {
  const th = locale.startsWith("th");
  if (minutes % 1440 === 0) {
    const d = minutes / 1440;
    return th ? `${d} วัน` : `${d} day${d === 1 ? "" : "s"}`;
  }
  if (minutes % 60 === 0) {
    const h = minutes / 60;
    return th ? `${h} ชั่วโมง` : `${h} hour${h === 1 ? "" : "s"}`;
  }
  return th ? `${minutes} นาที` : `${minutes} min`;
}
