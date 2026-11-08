/**
 * Fonts (docs/INVOICE_TEMPLATE_BUILDER.md §5.6): every font key maps to a
 * CSS stack, and every stack ends with Noto Sans Bengali so `৳` and Bangla
 * always render, whichever face the designer picked. The faces come from
 * files already shipped under /public/fonts/storefront; `fontFaceCss` is the
 * `@font-face` block the renderer puts into its own document (the page, the
 * preview and the print iframe alike), so the fonts load wherever a template
 * is drawn.
 *
 * Client-safe: strings only.
 */
import type { FontKey } from "./types";

/** The families this module declares with `@font-face`. */
export const BENGALI_FAMILY = "Noto Sans Bengali";
const SERIF_BENGALI_FAMILY = "Noto Serif Bengali";
const INTER_FAMILY = "Inter Store";
/** Thai + Latin; leads every stack so Thai text always has a real face. */
export const THAI_FAMILY = "Sarabun";

const BENGALI_FALLBACK = `"${THAI_FAMILY}", "${BENGALI_FAMILY}", sans-serif`;

export const FONT_STACKS: Record<FontKey, string> = {
  "clean-sans": `"${THAI_FAMILY}", "${INTER_FAMILY}", Inter, ui-sans-serif, system-ui, ${BENGALI_FALLBACK}`,
  "bangla-friendly": BENGALI_FALLBACK,
  "compact-thermal": `"Courier New", ui-monospace, ${BENGALI_FALLBACK}`,
  "elegant-serif": `"${SERIF_BENGALI_FAMILY}", ui-serif, Georgia, "${THAI_FAMILY}", "${BENGALI_FAMILY}", serif`,
  "mono-code": `ui-monospace, SFMono-Regular, Menlo, Consolas, ${BENGALI_FALLBACK}`,
  system: `system-ui, ${BENGALI_FALLBACK}`,
  arial: `Arial, ${BENGALI_FALLBACK}`,
  helvetica: `Helvetica, ${BENGALI_FALLBACK}`,
  "noto-sans-bengali": BENGALI_FALLBACK,
};

export const FONT_LABELS: Record<FontKey, { en: string; bn: string; th: string }> = {
  "clean-sans": { en: "Clean Sans", bn: "ক্লিন স্যান্স", th: "ไม่มีเชิง เรียบง่าย" },
  "bangla-friendly": { en: "Bangla Friendly", bn: "বাংলা ফ্রেন্ডলি", th: "รองรับอักษรเบงกาลี" },
  "compact-thermal": { en: "Compact Thermal", bn: "কমপ্যাক্ট থার্মাল", th: "เทอร์มอลแบบกะทัดรัด" },
  "elegant-serif": { en: "Elegant Serif", bn: "এলিগ্যান্ট সেরিফ", th: "มีเชิง หรูหรา" },
  "mono-code": { en: "Mono Code", bn: "মনো কোড", th: "โมโนสเปซ" },
  system: { en: "System", bn: "সিস্টেম", th: "ฟอนต์ของระบบ" },
  arial: { en: "Arial", bn: "Arial", th: "Arial" },
  helvetica: { en: "Helvetica", bn: "Helvetica", th: "Helvetica" },
  "noto-sans-bengali": { en: "Noto Sans Bengali", bn: "নোটো স্যান্স বাংলা", th: "Noto Sans Bengali" },
};

/** The `font-family` value for a key; an unknown key gets the Bangla-safe default. */
export function fontFamilyFor(key: FontKey | string | undefined): string {
  return (key && (FONT_STACKS as Record<string, string>)[key]) || FONT_STACKS["clean-sans"];
}

/** `weight` is set for static faces; variable faces cover 100-900. */
type Face = { family: string; file: string; unicodeRange: string; weight?: string };

const LATIN_RANGE =
  "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD";
const BENGALI_RANGE =
  "U+0951-0952, U+0964-0965, U+0980-09FE, U+1CD0, U+1CD2, U+1CD5-1CD6, U+1CD8, U+1CE1, U+1CEA, U+1CED, U+1CF2, U+1CF5-1CF7, U+200C-200D, U+20B9, U+25CC, U+A8F1";
const THAI_RANGE = "U+02D7, U+0303, U+0331, U+0E01-0E5B, U+200C-200D, U+25CC";

/** Each face the templates can need, with the shipped file behind it. */
export const TEMPLATE_FONT_FACES: readonly Face[] = [
  { family: THAI_FAMILY, file: "sarabun-thai-400-normal.woff2", unicodeRange: THAI_RANGE, weight: "400" },
  { family: THAI_FAMILY, file: "sarabun-latin-400-normal.woff2", unicodeRange: LATIN_RANGE, weight: "400" },
  { family: THAI_FAMILY, file: "sarabun-thai-700-normal.woff2", unicodeRange: THAI_RANGE, weight: "700" },
  { family: THAI_FAMILY, file: "sarabun-latin-700-normal.woff2", unicodeRange: LATIN_RANGE, weight: "700" },
  { family: INTER_FAMILY, file: "inter-latin.woff2", unicodeRange: LATIN_RANGE },
  { family: BENGALI_FAMILY, file: "noto-sans-bengali-bengali.woff2", unicodeRange: BENGALI_RANGE },
  { family: BENGALI_FAMILY, file: "noto-sans-bengali-latin.woff2", unicodeRange: LATIN_RANGE },
  { family: SERIF_BENGALI_FAMILY, file: "noto-serif-bengali-bengali.woff2", unicodeRange: BENGALI_RANGE },
  { family: SERIF_BENGALI_FAMILY, file: "noto-serif-bengali-latin.woff2", unicodeRange: LATIN_RANGE },
];

export const FONT_FILE_PATH = "/fonts/storefront/";

/**
 * The `@font-face` rules for every template face. `origin` makes the URLs
 * absolute for a document whose base URL is not the app's (the print iframe
 * is written with `document.write`, so it inherits the page's; an explicit
 * origin is still safer). `inline` gives a file's contents as a `data:` URL
 * instead, for a print that must not touch the network (the till offline:
 * the print iframe is not under the service worker, so it can't reach the
 * cached files itself).
 */
export function fontFaceCss(origin = "", inline?: Readonly<Record<string, string>>): string {
  const base = origin.replace(/\/$/, "") + FONT_FILE_PATH;
  return TEMPLATE_FONT_FACES.map(
    (face) =>
      `@font-face{font-family:"${face.family}";font-style:normal;font-weight:${face.weight ?? "100 900"};font-display:block;` +
      `src:url(${inline?.[face.file] ?? `${base}${face.file}`}) format("woff2");unicode-range:${face.unicodeRange};}`,
  ).join("\n");
}

/** The font specs `document.fonts.load` is asked for before printing. */
export const FONTS_TO_LOAD: readonly string[] = [
  `12px "${THAI_FAMILY}"`,
  `bold 12px "${THAI_FAMILY}"`,
  `12px "${INTER_FAMILY}"`,
  `12px "${BENGALI_FAMILY}"`,
  `12px "${SERIF_BENGALI_FAMILY}"`,
];
