import "server-only";

import { APIError } from "better-auth/api";
import { parsePhoneNumberFromString } from "libphonenumber-js/min";
import { USER_ACCOUNT_STATUS, USER_ROLES } from "@/config/app.config";
import { connectDB, mongoose } from "@/lib/db";
import { looksLikeE164 } from "@/lib/auth/phone-identity";
import { isSmsDeliveryConfigured, sendSms } from "@/lib/sms/sms";
import { smsStoreName } from "@/lib/sms/sms-text";
import { getSettings, type ISettingsData } from "@/models/settings.model";
import { SmsDelivery } from "@/models/sms-delivery.model";

/**
 * Signing in with a phone number: a six-digit code texted through the SMS
 * provider set up in Settings → SMS, on Better Auth's phone-number plugin.
 *
 * The plugin signs in whoever holds a verified number and nothing else, so
 * the store's own rules are kept here and run before it (lib/auth/auth.ts):
 *
 * - on only while Settings → SMS has it switched on AND can actually send;
 * - a number no account has makes a customer account only when the admin
 *   allows sign-up by phone — otherwise no text goes out for it at all;
 * - customers and vendors only: an admin or staff account, or one with
 *   two-factor on, keeps signing in by email, where its second factor is
 *   asked for (a texted code would walk straight past it);
 * - texts cost money and can be aimed at a stranger, so each number gets a
 *   few an hour, on top of the per-address limit in the auth config.
 *
 * Banned or inactive accounts are refused where every session is made.
 */

export const PHONE_OTP_EXPIRES_SECONDS = 300;
export const PHONE_OTP_LENGTH = 6;
/** Wrong codes before a code is thrown away. */
export const PHONE_OTP_ATTEMPTS = 5;
/** Texts to one number per hour. */
const OTP_PER_NUMBER_PER_HOUR = 5;
export const OTP_SMS_CATEGORY = "otp";

const PHONE_LOGIN_ROLES = new Set<string>([USER_ROLES.CUSTOMER, USER_ROLES.VENDOR]);

type SmsSettings = Pick<ISettingsData, "sms">;

export interface PhoneLoginConfig {
  /** Switched on and SMS can send. */
  available: boolean;
  allowSignUp: boolean;
  /** ISO-2, for numbers typed the national way ("081…"). */
  defaultCountry: string;
}

export function phoneLoginConfigOf(settings: SmsSettings | null | undefined): PhoneLoginConfig {
  const sms = settings?.sms;
  return {
    available: Boolean(sms?.phoneLogin?.enabled) && isSmsDeliveryConfigured(settings),
    allowSignUp: sms?.phoneLogin?.allowSignUp !== false,
    defaultCountry: (sms?.defaultCountry || "TH").toUpperCase(),
  };
}

export async function getPhoneLoginConfig(): Promise<PhoneLoginConfig> {
  await connectDB();
  return phoneLoginConfigOf(await getSettings());
}

/** Only a real, complete number in E.164 ("+66812345678"). */
export function isValidLoginPhoneNumber(value: unknown): boolean {
  if (!looksLikeE164(value)) return false;
  return Boolean(parsePhoneNumberFromString(value)?.isValid());
}

/** "+66812345678" → "081-234-5678" style, for a new account's first name. */
export function nationalPhoneLabel(e164: string): string {
  return parsePhoneNumberFromString(e164)?.formatNational() || e164;
}

function refuse(code: string, message: string, status: "FORBIDDEN" | "BAD_REQUEST" | "TOO_MANY_REQUESTS" = "FORBIDDEN"): never {
  throw new APIError(status, { code, message });
}

interface PhoneUser {
  _id: unknown;
  role?: string;
  status?: string;
  twoFactorEnabled?: boolean;
}

async function userWithPhone(phoneNumber: string): Promise<PhoneUser | null> {
  const db = mongoose.connection.db;
  if (!db) return null;
  return db
    .collection("user")
    .findOne<PhoneUser>(
      { phoneNumber },
      { projection: { role: 1, status: 1, twoFactorEnabled: 1 } },
    );
}

function assertMaySignIn(user: PhoneUser) {
  if (!PHONE_LOGIN_ROLES.has(user.role || USER_ROLES.CUSTOMER) || user.twoFactorEnabled) {
    refuse("PHONE_LOGIN_EMAIL_ONLY", "This account signs in with its email address.");
  }
  if ((user.status || USER_ACCOUNT_STATUS.ACTIVE) !== USER_ACCOUNT_STATUS.ACTIVE) {
    refuse("ACCOUNT_INACTIVE_OR_BANNED", "This account can't sign in. Contact support.");
  }
}

/**
 * Before a code is sent or checked to sign in (no session): the feature is
 * on, the number is real, and its account may sign in this way — or, for a
 * new number, sign-up by phone is allowed.
 */
export async function assertPhoneSignInAllowed(phoneNumber: unknown) {
  await connectDB();
  const config = phoneLoginConfigOf(await getSettings());
  if (!config.available) refuse("PHONE_LOGIN_DISABLED", "Signing in with a phone number is turned off.");
  if (!isValidLoginPhoneNumber(phoneNumber)) {
    refuse("INVALID_PHONE_NUMBER", "Enter a valid mobile number.", "BAD_REQUEST");
  }
  const user = await userWithPhone(phoneNumber as string);
  if (user) assertMaySignIn(user);
  else if (!config.allowSignUp) {
    refuse("PHONE_NOT_REGISTERED", "No account uses this number yet. Sign in with your email and add it from your account.");
  }
}

/**
 * Before a signed-in customer or vendor adds a number to their account: SMS
 * is on, and the number is free.
 */
export async function assertPhoneLinkAllowed(
  phoneNumber: unknown,
  sessionUser: { id: string; role?: string | null; twoFactorEnabled?: boolean | null },
) {
  await connectDB();
  const settings = await getSettings();
  if (!phoneLoginConfigOf(settings).available) {
    refuse("PHONE_LOGIN_DISABLED", "Signing in with a phone number is turned off.");
  }
  if (!PHONE_LOGIN_ROLES.has(sessionUser.role || USER_ROLES.CUSTOMER)) {
    refuse("PHONE_LOGIN_EMAIL_ONLY", "This account signs in with its email address.");
  }
  if (!isValidLoginPhoneNumber(phoneNumber)) {
    refuse("INVALID_PHONE_NUMBER", "Enter a valid mobile number.", "BAD_REQUEST");
  }
  const owner = await userWithPhone(phoneNumber as string);
  if (owner && String(owner._id) !== sessionUser.id) {
    refuse("PHONE_NUMBER_EXIST", "Another account already uses this number.", "BAD_REQUEST");
  }
}

/** A handful of texts per number per hour, whoever asks. */
export async function assertOtpBudget(phoneNumber: string) {
  await connectDB();
  const sent = await SmsDelivery.countDocuments({
    to: phoneNumber,
    category: OTP_SMS_CATEGORY,
    createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) },
  });
  if (sent >= OTP_PER_NUMBER_PER_HOUR) {
    refuse("OTP_TOO_MANY", "Too many codes sent to this number. Try again in an hour.", "TOO_MANY_REQUESTS");
  }
}

/** The text with the code, in the store's language (Thai for a Thai store). */
export async function sendPhoneOtp(phoneNumber: string, code: string) {
  await connectDB();
  const settings = await getSettings();
  const store = smsStoreName(settings.general?.storeName);
  const minutes = Math.round(PHONE_OTP_EXPIRES_SECONDS / 60);
  const thai = phoneNumber.startsWith("+66") || phoneLoginConfigOf(settings).defaultCountry === "TH";
  const body = thai
    ? `${store}: รหัสเข้าสู่ระบบของคุณคือ ${code} (ใช้ได้ ${minutes} นาที) ห้ามบอกรหัสนี้กับผู้อื่น`
    : `${store}: your sign-in code is ${code} (valid for ${minutes} minutes). Never share it with anyone.`;
  const result = await sendSms({ to: phoneNumber, body, category: OTP_SMS_CATEGORY, settings });
  if (result.status === "failed") {
    refuse("OTP_SEND_FAILED", "The code could not be sent. Try again in a moment.", "BAD_REQUEST");
  }
}
