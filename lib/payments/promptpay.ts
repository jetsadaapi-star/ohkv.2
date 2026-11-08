/**
 * PromptPay (พร้อมเพย์) QR payloads — the Thai EMVCo "Tag 29" format every
 * Thai banking app scans. Pure and dependency-free, so the admin preview, the
 * payment page and the server all build the same string.
 *
 * Proxy types:
 * - phone       — 10-digit mobile (0812345678), sent as 0066 + 9 digits
 * - national_id — 13-digit national ID card number
 * - tax_id      — 13-digit juristic / tax ID (เลขนิติบุคคล)
 * - ewallet     — 15-digit e-Wallet ID
 */

export const PROMPTPAY_ID_TYPES = ["phone", "national_id", "tax_id", "ewallet"] as const;
export type PromptPayIdType = (typeof PROMPTPAY_ID_TYPES)[number];

/** How many digits each proxy type has. */
export const PROMPTPAY_ID_LENGTH: Record<PromptPayIdType, number> = {
  phone: 10,
  national_id: 13,
  tax_id: 13,
  ewallet: 15,
};

const PROMPTPAY_AID = "A000000677010111";

export function digitsOnly(value: string | null | undefined): string {
  return String(value ?? "").replace(/\D/g, "");
}

export function isPromptPayIdType(value: unknown): value is PromptPayIdType {
  return typeof value === "string" && (PROMPTPAY_ID_TYPES as readonly string[]).includes(value);
}

/** Mod-11 check digit used by Thai national and juristic IDs. */
function thaiIdChecksumOk(id: string): boolean {
  if (!/^\d{13}$/.test(id)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(id[i]) * (13 - i);
  return (11 - (sum % 11)) % 10 === Number(id[12]);
}

/** Why an ID is not usable, or null when it is. Returns a reason code. */
export function promptPayIdProblem(
  type: PromptPayIdType,
  raw: string | null | undefined,
): "empty" | "length" | "phone_prefix" | "checksum" | null {
  const id = digitsOnly(raw);
  if (!id) return "empty";
  if (id.length !== PROMPTPAY_ID_LENGTH[type]) return "length";
  if (type === "phone" && !/^0[689]/.test(id)) return "phone_prefix";
  if ((type === "national_id" || type === "tax_id") && !thaiIdChecksumOk(id)) return "checksum";
  return null;
}

/** Shown on screen: 081-234-5678, 1-2345-67890-12-3, … */
export function formatPromptPayId(type: PromptPayIdType, raw: string | null | undefined): string {
  const id = digitsOnly(raw);
  if (type === "phone" && id.length === 10) return `${id.slice(0, 3)}-${id.slice(3, 6)}-${id.slice(6)}`;
  if ((type === "national_id" || type === "tax_id") && id.length === 13) {
    return `${id[0]}-${id.slice(1, 5)}-${id.slice(5, 10)}-${id.slice(10, 12)}-${id[12]}`;
  }
  if (type === "ewallet" && id.length === 15) return `${id.slice(0, 3)}-${id.slice(3, 9)}-${id.slice(9)}`;
  return id;
}

/** The ID with all but its last four digits hidden, for public pages. */
export function maskPromptPayId(type: PromptPayIdType, raw: string | null | undefined): string {
  const id = digitsOnly(raw);
  if (!id) return "";
  const hideBefore = Math.max(0, id.length - 4);
  let digitIndex = 0;
  return formatPromptPayId(type, id).replace(/\d/g, (d) => (digitIndex++ < hideBefore ? "x" : d));
}

function tlv(tag: string, value: string): string {
  return `${tag}${String(value.length).padStart(2, "0")}${value}`;
}

/** CRC-16/CCITT-FALSE, as EMVCo requires (poly 0x1021, init 0xFFFF). */
export function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/**
 * The string to encode in the QR. With an amount the QR is "dynamic" (the
 * banking app fills in the amount); without one the payer types it.
 */
export function buildPromptPayPayload(params: {
  type: PromptPayIdType;
  id: string;
  amount?: number | null;
}): string {
  const id = digitsOnly(params.id);
  let proxy: string;
  if (params.type === "phone") {
    proxy = tlv("01", `0066${id.replace(/^0/, "")}`.padStart(13, "0"));
  } else if (params.type === "ewallet") {
    proxy = tlv("03", id);
  } else {
    proxy = tlv("02", id);
  }
  const amount = Number(params.amount);
  const hasAmount = Number.isFinite(amount) && amount > 0;
  const body =
    tlv("00", "01") +
    tlv("01", hasAmount ? "12" : "11") +
    tlv("29", tlv("00", PROMPTPAY_AID) + proxy) +
    tlv("53", "764") +
    (hasAmount ? tlv("54", amount.toFixed(2)) : "") +
    tlv("58", "TH");
  const withCrcTag = `${body}6304`;
  return withCrcTag + crc16(withCrcTag);
}
