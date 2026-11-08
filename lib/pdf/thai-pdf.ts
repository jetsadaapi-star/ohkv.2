/**
 * Thai in @react-pdf documents (invoices, shipping labels).
 *
 * - Sarabun (SIL OFL, public/fonts/sarabun) draws Thai and Latin in one face;
 *   Helvetica and Inter have no Thai glyphs, so Thai printed as garbage.
 *   Bundled as TTF because @react-pdf reads TTF, not the site's woff2.
 * - Thai has no spaces between words, so a whole line was one "word" the
 *   layout could not wrap. Thai runs are split at ICU word boundaries; the
 *   empty string after each piece stops the engine printing a "-" at the
 *   break. Pieces joined by a no-break space stay together.
 * - SARA AM (ำ) is drawn as two glyphs (ํ + า) and the layout then dropped
 *   the line's last letter; `tx()` writes it as the two marks up front.
 *
 * Importing this module registers the font and the word splitter once.
 */
import path from "node:path";
import { Font } from "@react-pdf/renderer";

export const PDF_FONT = "Sarabun";

const sarabun = (file: string, fontWeight: number, fontStyle: "normal" | "italic" = "normal") => ({
  src: path.join(process.cwd(), "public", "fonts", "sarabun", file),
  fontWeight,
  fontStyle,
});

Font.register({
  family: PDF_FONT,
  fonts: [
    sarabun("Sarabun-Regular.ttf", 400),
    sarabun("Sarabun-Medium.ttf", 500),
    sarabun("Sarabun-SemiBold.ttf", 600),
    sarabun("Sarabun-Bold.ttf", 700),
    sarabun("Sarabun-ExtraBold.ttf", 800),
  ],
});

const THAI = /[\u0E00-\u0E7F]/;
const thaiWords = new Intl.Segmenter("th", { granularity: "word" });

function thaiPieces(word: string) {
  const pieces: string[] = [];
  let glue = false;
  for (const { segment } of thaiWords.segment(word)) {
    const nbsp = segment.includes("\u00A0");
    if ((glue || nbsp) && pieces.length > 0) pieces[pieces.length - 1] += segment;
    else pieces.push(segment);
    glue = nbsp;
  }
  return pieces;
}

Font.registerHyphenationCallback((word) =>
  THAI.test(word) ? thaiPieces(word).flatMap((piece) => [piece, ""]) : [word],
);

export function hasThai(value?: string | null) {
  return THAI.test(value || "");
}

/** Text ready for a Thai PDF line (see the SARA AM note above). */
export function tx(value: string): string;
export function tx(value: string | undefined): string | undefined;
export function tx(value: string | undefined) {
  return value === undefined ? value : value.replace(/\u0E33/g, "\u0E4D\u0E32");
}

/** Spaces that must not break (a phone number split in two is misdialled). */
export function keepTogether(value: string) {
  return value.replace(/\s+/g, "\u00A0");
}

export function isThailand(country?: string | null) {
  const c = (country || "").trim().toLowerCase();
  return !c || c === "th" || c === "tha" || c === "thailand" || c === "ประเทศไทย" || c === "ไทย";
}

/** Thai order "ต.… อ.… จ.…" for a Thai address; "city, state" otherwise. */
export function localityLine(city?: string | null, state?: string | null) {
  const c = (city || "").trim();
  const s = (state || "").trim();
  if (hasThai(c) || hasThai(s)) {
    const province =
      !s || s.startsWith("จ.") || s.startsWith("จังหวัด") || s.includes("กรุงเทพ") ? s : `จ.${s}`;
    return [c, province].filter(Boolean).join(" ");
  }
  return [c, s].filter(Boolean).join(", ");
}

/** A phone worth printing: enough digits, not an email typed in the box. */
export function printablePhone(phone?: string | null) {
  const value = (phone || "").trim();
  if (!value || value.includes("@")) return "";
  return value.replace(/\D/g, "").length >= 6 ? keepTogether(value) : "";
}

/** "฿1,234.50" for baht; the ISO code for other currencies (always has glyphs). */
export function pdfMoney(amount: number, currency: string) {
  const code = (currency || "THB").toUpperCase();
  const n = new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    Math.abs(amount),
  );
  const sign = amount < 0 ? "-" : "";
  return code === "THB" ? `${sign}฿${n}` : `${sign}${code} ${n}`;
}

/** 6 พ.ย. 2569 */
export function thaiDate(date: Date | string | number) {
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  }).format(new Date(date));
}

const DIGITS = ["", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
const PLACES = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"];

function readThaiNumber(n: number, afterMillion = false): string {
  if (n === 0) return "";
  if (n >= 1_000_000) {
    return `${readThaiNumber(Math.floor(n / 1_000_000))}ล้าน${readThaiNumber(n % 1_000_000, true)}`;
  }
  // "หนึ่งล้านเอ็ด": a lone 1 after a larger unit reads เอ็ด.
  if (afterMillion && n === 1) return "เอ็ด";
  const digits = String(n).split("").map(Number);
  let out = "";
  digits.forEach((d, i) => {
    const place = digits.length - i - 1;
    if (d === 0) return;
    if (place === 1 && d === 1) out += "สิบ";
    else if (place === 1 && d === 2) out += "ยี่สิบ";
    else if (place === 0 && d === 1 && digits.length > 1) out += "เอ็ด";
    else out += DIGITS[d] + PLACES[place];
  });
  return out;
}

/** The amount in Thai words, as Thai receipts print it: "ห้าร้อยบาทถ้วน". */
export function bahtText(amount: number) {
  const satangTotal = Math.round(Math.abs(amount) * 100);
  const baht = Math.floor(satangTotal / 100);
  const satang = satangTotal % 100;
  if (baht === 0 && satang === 0) return "ศูนย์บาทถ้วน";
  const bahtPart = baht > 0 ? `${readThaiNumber(baht)}บาท` : "";
  return satang > 0 ? `${bahtPart}${readThaiNumber(satang)}สตางค์` : `${bahtPart}ถ้วน`;
}
