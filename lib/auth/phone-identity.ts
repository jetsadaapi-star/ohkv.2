/**
 * Accounts made by signing in with a phone number. Better Auth needs an email
 * on every user, so such an account carries a placeholder on the reserved
 * `.invalid` domain (RFC 2606) — it can never be delivered to, and nothing is
 * ever sent to it (lib/email/email.ts). The customer can add a real address
 * later from their account.
 *
 * Client-safe: the account pages use it to show the phone instead.
 */

export const PHONE_PLACEHOLDER_DOMAIN = "phone.invalid";

export function phonePlaceholderEmail(e164: string): string {
  return `p${e164.replace(/\D/g, "")}@${PHONE_PLACEHOLDER_DOMAIN}`;
}

export function isPhonePlaceholderEmail(email: unknown): boolean {
  return typeof email === "string" && email.trim().toLowerCase().endsWith(`@${PHONE_PLACEHOLDER_DOMAIN}`);
}

/** E.164 shape: a plus, then 7–15 digits, the first not zero. */
export function looksLikeE164(value: unknown): value is string {
  return typeof value === "string" && /^\+[1-9]\d{6,14}$/.test(value);
}

/** Calling codes for the countries a store is likely to default to. */
const CALLING_CODES: Record<string, string> = {
  TH: "66", LA: "856", KH: "855", MM: "95", MY: "60", SG: "65", VN: "84", ID: "62", PH: "63",
  CN: "86", JP: "81", KR: "82", IN: "91", BD: "880", US: "1", GB: "44", AU: "61",
};

/**
 * A number as typed ("081-234 5678", "+66 81…", "0066…") in E.164, for the
 * browser. Light on purpose — the server checks it properly with
 * libphonenumber before any text goes out (lib/auth/phone-login.ts).
 */
export function toE164(raw: string, defaultCountry: string): string | null {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;
  let e164: string;
  if (trimmed.startsWith("+")) e164 = `+${digits}`;
  else if (digits.startsWith("00")) e164 = `+${digits.slice(2)}`;
  else {
    const code = CALLING_CODES[defaultCountry.toUpperCase()];
    if (!code) return null;
    e164 = `+${code}${digits.replace(/^0/, "")}`;
  }
  return looksLikeE164(e164) ? e164 : null;
}

/** "+66812345678" → "081 234 5678" for a Thai number; others as given. */
export function displayPhone(e164: string): string {
  if (e164.startsWith("+66") && e164.length === 12) {
    const n = `0${e164.slice(3)}`;
    return `${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`;
  }
  return e164;
}
