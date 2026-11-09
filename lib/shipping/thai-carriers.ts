/**
 * The couriers Thai shops hand parcels to, for the hand-entered "mark as
 * shipped" flow: one tap to name the courier, and a tracking page for the
 * customer.
 *
 * Client-safe (no imports): the ship dialogs pick from it in the browser and
 * `trackingPageUrl` links from it on the server, from one list.
 *
 * Tracking pages were checked to open. Where a courier's site takes the number
 * in its own address (`{tracking}`), the link lands on the parcel; where it
 * does not publish such an address (J&T, SPX), the link opens its tracking page
 * and the customer pastes the number — `deepLink: false`, so the number is
 * never glued onto a URL that would 404.
 */

export interface ThaiCarrier {
  id: string;
  /** What is stored as the order's `carrier`, and shown to the customer. */
  name: string;
  /** Thai name, for the picker. */
  nameTh: string;
  /** Brand colour for the picker chip. */
  color: string;
  /** Matched against a typed carrier name. */
  match: RegExp;
  template: string;
  deepLink: boolean;
  /** A tracking number only this courier issues, for detection; absent when ambiguous. */
  pattern?: RegExp;
}

export const THAI_CARRIERS: readonly ThaiCarrier[] = [
  {
    id: "thailandpost",
    name: "Thailand Post",
    nameTh: "ไปรษณีย์ไทย",
    color: "#E2231A",
    match: /thailand\s*post|thai\s*post|ไปรษณีย์ไทย|\bems\b|ไปรษณีย์/i,
    template: "https://track.thailandpost.co.th/?trackNumber={tracking}",
    deepLink: true,
    // UPU S10: two letters, eight digits and a check digit, then the country.
    pattern: /^[A-Z]{2}\d{9}TH$/i,
  },
  {
    id: "kex",
    name: "KEX Express",
    nameTh: "KEX (Kerry)",
    color: "#F26522",
    match: /\bkex\b|kerry|เคอรี่/i,
    template: "https://th.kex-express.com/th/track/?track={tracking}",
    deepLink: true,
    pattern: /^KEX[A-Z0-9]{6,}$/i,
  },
  {
    id: "flash",
    name: "Flash Express",
    nameTh: "แฟลช เอ็กซ์เพรส",
    color: "#FFD400",
    match: /flash|แฟลช/i,
    template: "https://www.flashexpress.co.th/fle/tracking?se={tracking}",
    deepLink: true,
  },
  {
    id: "jt",
    name: "J&T Express",
    nameTh: "J&T Express",
    color: "#D9001B",
    match: /j\s*&\s*t|j\s*and\s*t|เจแอนด์ที/i,
    template: "https://www.jtexpress.co.th/service/track",
    deepLink: false,
  },
  {
    id: "spx",
    name: "SPX Express",
    nameTh: "SPX (Shopee Express)",
    color: "#EE4D2D",
    match: /\bspx\b|shopee\s*ex/i,
    template: "https://spx.co.th/",
    deepLink: false,
  },
  {
    id: "ninjavan",
    name: "Ninja Van",
    nameTh: "นินจาแวน",
    color: "#C1002B",
    match: /ninja\s*van|นินจา/i,
    template: "https://www.ninjavan.co/th-th/tracking?id={tracking}",
    deepLink: true,
    pattern: /^NV[A-Z0-9]{8,}$/i,
  },
  {
    id: "best",
    name: "Best Express",
    nameTh: "เบสท์ เอ็กซ์เพรส",
    color: "#E60012",
    match: /best\s*(express|inc)|เบสท์/i,
    template: "https://www.best-inc.co.th/track?bills={tracking}",
    deepLink: true,
  },
  {
    id: "dhl-ecommerce",
    name: "DHL eCommerce",
    nameTh: "DHL eCommerce",
    color: "#FFCC00",
    match: /dhl\s*e-?commerce/i,
    template: "https://ecommerceportal.dhl.com/track/?ref={tracking}",
    deepLink: true,
  },
  {
    id: "nim",
    name: "Nim Express",
    nameTh: "นิ่มเอ็กซ์เพรส",
    color: "#0B5CAB",
    match: /nim\s*express|นิ่ม/i,
    template: "https://www.nimexpress.com/web/p/tracking?i={tracking}",
    deepLink: true,
  },
];

/** The courier a tracking number can only have come from, if any. */
export function detectThaiCarrier(trackingNumber: string): ThaiCarrier | undefined {
  const value = trackingNumber.trim().replace(/\s+/g, "");
  if (value.length < 8) return undefined;
  return THAI_CARRIERS.find((carrier) => carrier.pattern?.test(value));
}

/** The catalogue entry a typed carrier name means, if any. */
export function thaiCarrierFor(name: string | undefined): ThaiCarrier | undefined {
  const value = name?.trim();
  if (!value) return undefined;
  return THAI_CARRIERS.find((carrier) => carrier.match.test(value));
}
