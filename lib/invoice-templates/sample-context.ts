/**
 * `sampleContext(category, locale)` (docs/INVOICE_TEMPLATE_BUILDER.md
 * §4.7.1): the clearly marked sample data the editor, the preview and Test
 * Print fill a template with. Every field has a value, so a designer sees
 * every element filled; `isSample: true` lets the preview say "SAMPLE DATA —
 * not a real order" and keeps a sample from ever being mistaken for a print.
 *
 * `sampleContext(category, locale, { items })` makes a long order (60 lines,
 * for page-flow previews). Client-safe.
 */
import type { ContextItem, PrintContext } from "./context-types";
import type { TemplateCategory, TemplateLocale } from "./types";

/** Picks the sample's words: Thai for `th`, English otherwise (Bangla reuses English). */
const say = (locale: TemplateLocale, en: string, th: string): string => (locale === "th" ? th : en);

const STORE_EN: PrintContext["store"] = {
  name: "Oh-K Shop | OTOP ฮักกาฬสินธุ์",
  phone: "043-811-234",
  email: "shop@example.com",
  address: "123 Kalasin Rd, Kalasin Subdistrict, Mueang Kalasin, Kalasin 46000",
  logo: "/logo.png",
  website: "https://storify.example.com",
  facebook: "https://facebook.com/storify",
  taxId: "Tax ID 0465512345678",
};

const STORE: Record<TemplateLocale, PrintContext["store"]> = {
  en: STORE_EN,
  bn: STORE_EN,
  th: {
    ...STORE_EN,
    address: "123 ถ.กาฬสินธุ์ ต.กาฬสินธุ์ อ.เมืองกาฬสินธุ์ จ.กาฬสินธุ์ 46000",
    taxId: "เลขประจำตัวผู้เสียภาษี 0465512345678",
  },
};

const CUSTOMER_EN: PrintContext["customer"] = {
  name: "Somying Jaidee",
  phone: "081-234-5678",
  email: "somying@example.com",
  addressLines: ["99 Moo 5, Kalasin Subdistrict", "Mueang Kalasin, Kalasin 46000", "Thailand"],
};

const CUSTOMER: Record<TemplateLocale, PrintContext["customer"]> = {
  en: CUSTOMER_EN,
  bn: CUSTOMER_EN,
  th: {
    ...CUSTOMER_EN,
    name: "สมหญิง ใจดี",
    addressLines: ["99 หมู่ 5 ต.กาฬสินธุ์", "อ.เมืองกาฬสินธุ์ จ.กาฬสินธุ์ 46000", "ประเทศไทย"],
  },
};

type SampleLine = [name: string, variant: string | null, colour: string | null, size: string | null, sku: string, qty: number, price: number, compareAt: number | null, discount: number];

const LINES_EN: SampleLine[] = [
  ["Praewa silk", "Red / 2 m", "Red", "2 m", "PRW-RED-2M", 1, 3500, 4200, 0],
  ["Pha khao ma loincloth", "Blue / Free size", "Blue", "Free size", "PKM-BLU", 2, 250, null, 50],
  ["Curry puffs (box)", null, null, null, "KRP-BOX", 1, 120, null, 0],
];

const LINES: Record<TemplateLocale, SampleLine[]> = {
  en: LINES_EN,
  bn: LINES_EN,
  th: [
    ["ผ้าไหมแพรวา", "แดง / 2 เมตร", "แดง", "2 เมตร", "PRW-RED-2M", 1, 3500, 4200, 0],
    ["ผ้าขาวม้า", "น้ำเงิน / ฟรีไซซ์", "น้ำเงิน", "ฟรีไซซ์", "PKM-BLU", 2, 250, null, 50],
    ["ขนมกระหรี่ปั๊บ (กล่อง)", null, null, null, "KRP-BOX", 1, 120, null, 0],
  ],
};

function sampleItem(line: SampleLine, index: number): ContextItem {
  const [name, variant, colour, size, sku, qty, unitPrice, compareAtPrice, lineDiscount] = line;
  return {
    name,
    variant,
    colour,
    size,
    sku,
    qty,
    unitPrice,
    compareAtPrice,
    lineDiscount,
    lineTotal: unitPrice * qty - lineDiscount,
    image: `/samples/product-${(index % 3) + 1}.png`,
    weight: index % 2 === 0 ? "0.5 kg" : null,
    note: null,
    // The sample order carries no tax online, so its tax columns read 0.
    taxRate: 0,
    tax: 0,
    totalWithTax: unitPrice * qty - lineDiscount,
  };
}

function sampleItems(locale: TemplateLocale, count: number): ContextItem[] {
  const base = LINES[locale];
  return Array.from({ length: count }, (_, index) => {
    const line = base[index % base.length]!;
    const item = sampleItem(line, index);
    return index < base.length ? item : { ...item, name: `${item.name} ${index + 1}`, sku: `${item.sku}-${index + 1}` };
  });
}

function sum(items: ContextItem[]): { gross: number; discount: number; units: number } {
  return items.reduce(
    (acc, item) => ({
      gross: acc.gross + item.unitPrice * item.qty,
      discount: acc.discount + item.lineDiscount,
      units: acc.units + item.qty,
    }),
    { gross: 0, discount: 0, units: 0 },
  );
}

export interface SampleContextOptions {
  /** How many lines the sample order has (default 3; 60 makes three A4 pages). */
  items?: number;
}

export function sampleContext(
  category: TemplateCategory,
  locale: TemplateLocale,
  options: SampleContextOptions = {},
): PrintContext {
  const items = sampleItems(locale, Math.max(1, options.items ?? 3));
  const { gross, discount: lineDiscount } = sum(items);
  const couponDiscount = 150;
  const discount = lineDiscount + couponDiscount;
  const delivery = category === "pos" ? 0 : 50;
  const taxable = gross - discount;
  const tax = category === "pos" ? Math.round(taxable * 0.07) : 0;
  const total = taxable + delivery + tax;
  const pos = category === "pos";
  const cashTendered = Math.ceil(total / 100) * 100;

  return {
    category,
    locale,
    isSample: true,
    store: STORE[locale],
    order: {
      number: pos ? "POS-100042" : "OHK-100042",
      date: "2026-10-11T09:30:00.000Z",
      paymentStatus: pos ? "paid" : "pending",
      paymentMethod: pos ? "cash" : "cod",
      customerNote: say(locale, "Please deliver in the afternoon", "กรุณาจัดส่งช่วงบ่าย"),
      internalNote: say(locale, "Fragile: pack with care", "แตกง่าย: แพ็กอย่างระมัดระวัง"),
      takenBy: say(locale, "Somchai Srisuk", "สมชาย ศรีสุข"),
      channel: pos ? "pos" : "online",
    },
    customer: CUSTOMER[locale],
    items,
    money: {
      currency: "THB",
      subtotal: gross,
      discount,
      delivery,
      tax,
      taxMode: "added",
      duty: 0,
      total,
      paid: pos ? total : 0,
      due: pos ? 0 : total,
      cod: pos ? 0 : total,
      refunded: 0,
    },
    delivery: pos
      ? { method: null, courier: null, service: null, trackingNumber: null, trackingUrl: null, seller: null, labelSource: null }
      : {
          method: say(locale, "Standard delivery", "จัดส่งแบบมาตรฐาน"),
          courier: say(locale, "Kerry Express", "Kerry Express"),
          service: say(locale, "Express", "ส่งด่วน"),
          trackingNumber: "KEX0123456789",
          trackingUrl: "https://storify.example.com/track-order?number=OHK-100042",
          seller: "Oh-K Shop | OTOP ฮักกาฬสินธุ์",
          labelSource: "internal",
        },
    pos: pos
      ? {
          counter: say(locale, "Kalasin counter", "เคาน์เตอร์กาฬสินธุ์"),
          cashier: say(locale, "Somchai Srisuk", "สมชาย ศรีสุข"),
          tenders: [{ label: say(locale, "Cash", "เงินสด"), amount: total }],
          cashTendered,
          change: cashTendered - total,
          taxExemptReason: null,
        }
      : null,
    page: { number: 1, count: 1 },
    consignment: category === "sticker" ? { id: "sample-consignment", index: 1, count: 1 } : null,
  };
}
