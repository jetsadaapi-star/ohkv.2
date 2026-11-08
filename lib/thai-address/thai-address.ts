/**
 * Thai administrative divisions — province (จังหวัด), district (อำเภอ/เขต),
 * sub-district (ตำบล/แขวง) and postcode — for address forms.
 *
 * Data: kongvut/thai-province-data (MIT), api/latest (v3), compacted into
 * /public/data/thai-address/thai-address.json and fetched once per page when
 * an address form needs it (≈130 KB gzipped). Client-safe, no server imports.
 *
 * The store's address shape has no sub-district field (street / apartment /
 * city / state / postalCode / country is shared by orders, shipments and
 * carriers), so a Thai address is written into it the way Thai addresses are
 * printed:
 *   state      → province          "กาฬสินธุ์"
 *   city       → sub-district + district  "ต.กมลาไสย อ.กมลาไสย" (Bangkok: "แขวงพระบรมมหาราชวัง เขตพระนคร")
 *   postalCode → the sub-district's postcode
 * and read back from it when an address is edited.
 */

export interface ThaiProvince {
  id: number;
  th: string;
  en: string;
}
export interface ThaiDistrict {
  id: number;
  provinceId: number;
  th: string;
  en: string;
  /** อำเภอ or เขต (Bangkok). */
  prefix: string;
}
export interface ThaiSubdistrict {
  id: number;
  districtId: number;
  th: string;
  en: string;
  zip: string;
  /** ตำบล or แขวง (Bangkok). */
  prefix: string;
}

export interface ThaiAddressData {
  provinces: ThaiProvince[];
  districts: ThaiDistrict[];
  subdistricts: ThaiSubdistrict[];
  provinceById: Map<number, ThaiProvince>;
  districtById: Map<number, ThaiDistrict>;
  districtsByProvince: Map<number, ThaiDistrict[]>;
  subdistrictsByDistrict: Map<number, ThaiSubdistrict[]>;
  subdistrictsByZip: Map<string, ThaiSubdistrict[]>;
}

export const THAI_ADDRESS_DATA_URL = "/data/thai-address/thai-address.json";

let cache: Promise<ThaiAddressData> | null = null;

/** The dataset, fetched once and shared by every form on the page. */
export function loadThaiAddressData(): Promise<ThaiAddressData> {
  if (!cache) {
    cache = fetch(THAI_ADDRESS_DATA_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`thai-address ${res.status}`);
        return res.json() as Promise<{
          p: [number, string, string][];
          d: [number, number, string, string, string][];
          s: [number, number, string, string, string, string][];
        }>;
      })
      .then((raw) => {
        const provinces = raw.p.map(([id, th, en]) => ({ id, th, en }));
        const districts = raw.d.map(([id, provinceId, th, en, prefix]) => ({ id, provinceId, th, en, prefix }));
        const subdistricts = raw.s.map(([id, districtId, th, en, zip, prefix]) => ({ id, districtId, th, en, zip, prefix }));
        const group = <T, K>(rows: T[], key: (row: T) => K) => {
          const map = new Map<K, T[]>();
          for (const row of rows) {
            const k = key(row);
            const list = map.get(k);
            if (list) list.push(row);
            else map.set(k, [row]);
          }
          return map;
        };
        const byTh = (a: { th: string }, b: { th: string }) => a.th.localeCompare(b.th, "th");
        const districtsByProvince = group(districts, (d) => d.provinceId);
        districtsByProvince.forEach((list) => list.sort(byTh));
        const subdistrictsByDistrict = group(subdistricts, (s) => s.districtId);
        subdistrictsByDistrict.forEach((list) => list.sort(byTh));
        return {
          provinces,
          districts,
          subdistricts,
          provinceById: new Map(provinces.map((p) => [p.id, p])),
          districtById: new Map(districts.map((d) => [d.id, d])),
          districtsByProvince,
          subdistrictsByDistrict,
          subdistrictsByZip: group(subdistricts, (s) => s.zip),
        };
      })
      .catch((error) => {
        cache = null; // let the next form try again
        throw error;
      });
  }
  return cache;
}

const BANGKOK_ID = 1;

/** "ต.กมลาไสย อ.กมลาไสย", or "แขวง… เขต…" in Bangkok; just the district when no sub-district yet. */
export function formatThaiCity(district: ThaiDistrict, subdistrict?: ThaiSubdistrict | null) {
  const bangkok = district.provinceId === BANGKOK_ID;
  const d = bangkok ? `เขต${district.th}` : `อ.${district.th}`;
  if (!subdistrict) return d;
  const s = bangkok ? `แขวง${subdistrict.th}` : `ต.${subdistrict.th}`;
  return `${s} ${d}`;
}

/** The full one-line form, e.g. for a summary: "ต.… อ.… จ.… 46000". */
export function formatThaiAddressLine(parts: { city?: string; state?: string; postalCode?: string }) {
  const province = parts.state ? (parts.state === "กรุงเทพมหานคร" ? parts.state : `จ.${parts.state}`) : "";
  return [parts.city, province, parts.postalCode].filter(Boolean).join(" ");
}

const strip = (value: string) =>
  value
    .replace(/^(จังหวัด|จ\.)\s*/, "")
    .replace(/\s+/g, "")
    .toLowerCase();

/** The province a saved `state` names (Thai or English, with or without "จ."). */
export function findProvince(data: ThaiAddressData, state?: string | null) {
  if (!state?.trim()) return null;
  const key = strip(state);
  return (
    data.provinces.find((p) => strip(p.th) === key || p.en.replace(/\s+/g, "").toLowerCase() === key) ?? null
  );
}

/**
 * The district and sub-district a saved `city` names, within a province:
 * "ต.X อ.Y", "ตำบลX อำเภอY", "แขวงX เขตY", or just a district name.
 */
export function parseThaiCity(data: ThaiAddressData, provinceId: number, city?: string | null) {
  const empty = { district: null as ThaiDistrict | null, subdistrict: null as ThaiSubdistrict | null };
  if (!city?.trim()) return empty;
  const districts = data.districtsByProvince.get(provinceId) ?? [];
  const text = city.trim();
  const dMatch = /(?:อ\.|อำเภอ|เขต)\s*([^\s,]+)/.exec(text);
  const sMatch = /(?:ต\.|ตำบล|แขวง)\s*([^\s,]+)/.exec(text);
  const districtName = dMatch?.[1] ?? (sMatch ? null : text.replace(/^(อ\.|อำเภอ|เขต)\s*/, ""));
  const district = districtName
    ? districts.find((d) => d.th === districtName || d.en.toLowerCase() === districtName.toLowerCase()) ?? null
    : null;
  if (!district) return empty;
  const subdistrict = sMatch
    ? (data.subdistrictsByDistrict.get(district.id) ?? []).find((s) => s.th === sMatch[1]) ?? null
    : null;
  return { district, subdistrict };
}
