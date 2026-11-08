/**
 * The marketplace's zones: the 18 districts (อำเภอ) of Kalasin province.
 *
 * Every store belongs to exactly one district. The code is what is stored on
 * the vendor (`vendor.district`) and used in URLs (`/zones/<code>`), so it must
 * never change once a store has been saved with it; the names are display
 * only. Order is the order the zone pages list them in.
 *
 * Client-safe: plain data, no imports.
 */
export const KALASIN_PROVINCE = { th: "กาฬสินธุ์", en: "Kalasin" } as const;

export const KALASIN_DISTRICTS = [
  { code: "mueang-kalasin", th: "เมืองกาฬสินธุ์", en: "Mueang Kalasin" },
  { code: "na-mon", th: "นามน", en: "Na Mon" },
  { code: "kamalasai", th: "กมลาไสย", en: "Kamalasai" },
  { code: "rong-kham", th: "ร่องคำ", en: "Rong Kham" },
  { code: "kuchinarai", th: "กุฉินารายณ์", en: "Kuchinarai" },
  { code: "khao-wong", th: "เขาวง", en: "Khao Wong" },
  { code: "yang-talat", th: "ยางตลาด", en: "Yang Talat" },
  { code: "huai-mek", th: "ห้วยเม็ก", en: "Huai Mek" },
  { code: "sahatsakhan", th: "สหัสขันธ์", en: "Sahatsakhan" },
  { code: "kham-muang", th: "คำม่วง", en: "Kham Muang" },
  { code: "tha-khantho", th: "ท่าคันโท", en: "Tha Khantho" },
  { code: "nong-kung-si", th: "หนองกุงศรี", en: "Nong Kung Si" },
  { code: "somdet", th: "สมเด็จ", en: "Somdet" },
  { code: "huai-phueng", th: "ห้วยผึ้ง", en: "Huai Phueng" },
  { code: "sam-chai", th: "สามชัย", en: "Sam Chai" },
  { code: "na-khu", th: "นาคู", en: "Na Khu" },
  { code: "don-chan", th: "ดอนจาน", en: "Don Chan" },
  { code: "khong-chai", th: "ฆ้องชัย", en: "Khong Chai" },
] as const;

export type KalasinDistrictCode = (typeof KALASIN_DISTRICTS)[number]["code"];

export const KALASIN_DISTRICT_CODES = KALASIN_DISTRICTS.map(
  (district) => district.code,
) as readonly KalasinDistrictCode[];

export function isKalasinDistrictCode(
  value: unknown,
): value is KalasinDistrictCode {
  return (
    typeof value === "string" &&
    (KALASIN_DISTRICT_CODES as readonly string[]).includes(value)
  );
}

export function getKalasinDistrict(code: unknown) {
  return KALASIN_DISTRICTS.find((district) => district.code === code);
}

/** The district's name in the page's language: Thai for `th`, English otherwise. */
export function kalasinDistrictName(code: unknown, locale: string): string {
  const district = getKalasinDistrict(code);
  if (!district) return "";
  return locale === "th" ? district.th : district.en;
}

/** "อ.นามน" / "Na Mon District", for badges and headings. */
export function kalasinDistrictLabel(code: unknown, locale: string): string {
  const district = getKalasinDistrict(code);
  if (!district) return "";
  return locale === "th" ? `อ.${district.th}` : `${district.en} District`;
}

/**
 * The district from free text: a code, or its Thai or English name with or
 * without "อำเภอ"/"อ."/"District". For imports and for addresses typed before
 * the district field existed.
 */
export function matchKalasinDistrict(value: unknown): KalasinDistrictCode | null {
  if (typeof value !== "string") return null;
  const text = value
    .trim()
    .toLowerCase()
    .replace(/^(อำเภอ|อ\.)\s*/u, "")
    .replace(/\s+district$/, "")
    .trim();
  if (!text) return null;
  const found = KALASIN_DISTRICTS.find(
    (district) =>
      district.code === text ||
      district.th === text ||
      district.en.toLowerCase() === text,
  );
  return found ? found.code : null;
}
