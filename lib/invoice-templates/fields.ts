/**
 * The field registry (docs/INVOICE_TEMPLATE_BUILDER.md §4.7.2): every key a
 * template element can be bound to, with its label, group, scope, the
 * categories it is valid in, a sample and a resolver over the render context.
 *
 * `resolve` returns `null` when the data is missing. **`null` prints the
 * fallback, or nothing, and skips the before/after text.** Nothing here ever
 * returns `undefined` or `NaN`: a missing figure is `null`, a present one is
 * a finite number.
 *
 * Values are typed by `valueType` so the renderer (Phase 2) can format them:
 * `money` is a number in `context.money.currency`, `date` an ISO string,
 * `multiline` a string with `\n` between lines, `url` and `image` strings.
 *
 * Client-safe: the editor, the preview and the till all read it.
 */
import { FIELD_KEYS, ITEM_FIELD_KEYS, type FieldKey, type ItemFieldKey } from "./field-keys";
import type { ContextItem, PrintContext } from "./context-types";
import { TEMPLATE_CATEGORIES, type TemplateCategory, type TemplateDesign, type TemplateLocale } from "./types";

export type FieldScope = "order" | "item" | "consignment" | "store" | "page" | "pos";
export type FieldGroup = "order" | "customer" | "money" | "delivery" | "items" | "store" | "pos" | "page";
export type FieldValueType = "text" | "multiline" | "money" | "number" | "date" | "url" | "image";
export type FieldValue = string | number | null;

type Labels = Record<TemplateLocale, string>;

export interface FieldDefinition {
  key: FieldKey;
  label: Labels;
  group: FieldGroup;
  scope: FieldScope;
  categories: readonly TemplateCategory[];
  valueType: FieldValueType;
  /** A value for the picker's live sample, in the admin's language. */
  sample: (locale: TemplateLocale) => FieldValue;
  resolve: (context: PrintContext) => FieldValue;
}

export interface ItemFieldDefinition {
  key: ItemFieldKey;
  label: Labels;
  valueType: FieldValueType;
  sample: (locale: TemplateLocale) => FieldValue;
  resolve: (item: ContextItem, context: PrintContext) => FieldValue;
}

const ALL = TEMPLATE_CATEGORIES;
const ONLINE_AND_STICKER = ["online", "sticker"] as const;
const POS_ONLY = ["pos"] as const;

const bn = (en: string, bangla: string, thai: string): Labels => ({ en, bn: bangla, th: thai });

/** A sample value: Thai for `th`, English otherwise (the sample shop is a Thai one). */
const say = (locale: TemplateLocale, en: string, th: string): string => (locale === "th" ? th : en);

const text = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const amount = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const lines = (values: ReadonlyArray<string | null | undefined>): string | null => {
  const kept = values.filter((line): line is string => Boolean(line && line.trim()));
  return kept.length > 0 ? kept.join("\n") : null;
};

// ---------------------------------------------------------------------------
// Labels for stored values
// ---------------------------------------------------------------------------

const PAYMENT_STATUS_LABELS: Record<string, Labels> = {
  pending: bn("Pending", "বাকি", "รอชำระ"),
  paid: bn("Paid", "পরিশোধিত", "ชำระแล้ว"),
  partially_paid: bn("Partially paid", "আংশিক পরিশোধিত", "ชำระบางส่วน"),
  refunded: bn("Refunded", "ফেরত দেওয়া হয়েছে", "คืนเงินแล้ว"),
  partially_refunded: bn("Partially refunded", "আংশিক ফেরত", "คืนเงินบางส่วน"),
  expired: bn("Expired", "মেয়াদোত্তীর্ণ", "หมดอายุ"),
  failed: bn("Failed", "ব্যর্থ", "ไม่สำเร็จ"),
};

const PAYMENT_METHOD_LABELS: Record<string, Labels> = {
  cod: bn("Cash on delivery", "ক্যাশ অন ডেলিভারি", "เก็บเงินปลายทาง"),
  cash: bn("Cash", "নগদ", "เงินสด"),
  card: bn("Card", "কার্ড", "บัตร"),
  stripe: bn("Card", "কার্ড", "บัตร"),
  paypal: bn("PayPal", "PayPal", "PayPal"),
  bank: bn("Bank transfer", "ব্যাংক ট্রান্সফার", "โอนเงินผ่านธนาคาร"),
  bank_transfer: bn("Bank transfer", "ব্যাংক ট্রান্সফার", "โอนเงินผ่านธนาคาร"),
  promptpay: bn("PromptPay", "PromptPay", "พร้อมเพย์"),
  bkash: bn("bKash", "বিকাশ", "bKash"),
  nagad: bn("Nagad", "নগদ", "Nagad"),
  rocket: bn("Rocket", "রকেট", "Rocket"),
  sslcommerz: bn("SSLCommerz", "SSLCommerz", "SSLCommerz"),
  razorpay: bn("Razorpay", "Razorpay", "Razorpay"),
  paystack: bn("Paystack", "Paystack", "Paystack"),
  mobile_money: bn("Mobile money", "মোবাইল মানি", "พร้อมเพย์ / โมบายแบงกิ้ง"),
  store_credit: bn("Store credit", "স্টোর ক্রেডিট", "เครดิตช้อปปิ้ง"),
  pay_later: bn("Pay later", "পরে পরিশোধ", "ชำระภายหลัง"),
  wallet: bn("Wallet", "ওয়ালেট", "วอลเล็ต"),
};

function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function paymentStatusLabel(status: string | null, locale: TemplateLocale): string | null {
  const key = text(status)?.toLowerCase();
  if (!key) return null;
  return PAYMENT_STATUS_LABELS[key]?.[locale] ?? titleCase(key);
}

/** One method, or several joined by " + " (a split POS sale). */
export function paymentMethodLabel(method: string | null, locale: TemplateLocale): string | null {
  const raw = text(method);
  if (!raw) return null;
  return raw
    .split("+")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)
    .map((part) => PAYMENT_METHOD_LABELS[part]?.[locale] ?? titleCase(part))
    .join(" + ");
}

const PAGE_LABEL: Record<TemplateLocale, (n: number, c: number) => string> = {
  en: (n, c) => `Page ${n} of ${c}`,
  bn: (n, c) => `পৃষ্ঠা ${n} / ${c}`,
  th: (n, c) => `หน้า ${n} จาก ${c}`,
};

export function pageLabel(page: { number: number; count: number }, locale: TemplateLocale): string {
  return PAGE_LABEL[locale](page.number, page.count);
}

// ---------------------------------------------------------------------------
// Item lists
// ---------------------------------------------------------------------------

function itemDisplayName(item: ContextItem): string {
  return item.variant ? `${item.name} (${item.variant})` : item.name;
}

export function itemsNames(items: ReadonlyArray<ContextItem>): string | null {
  return items.length > 0 ? items.map(itemDisplayName).join(", ") : null;
}

export function itemsSkuQtyList(items: ReadonlyArray<ContextItem>): string | null {
  return lines(items.map((item) => `${item.sku ?? item.name} × ${item.qty}`));
}

/** Text that embeds an amount takes a formatter; the renderer passes the template's amount format (`bindings.ts`). */
export type AmountText = (value: number) => string;

export function itemsSummary(items: ReadonlyArray<ContextItem>, money: AmountText = String): string | null {
  return lines(items.map((item) => `${itemDisplayName(item)} × ${item.qty} — ${money(item.lineTotal)}`));
}

export function tendersText(tenders: ReadonlyArray<{ label: string; amount: number }>, money: AmountText = String): string | null {
  return lines(tenders.map((tender) => `${tender.label}: ${money(tender.amount)}`));
}

export function itemsTotalUnits(items: ReadonlyArray<ContextItem>): number {
  return items.reduce((sum, item) => sum + (Number.isFinite(item.qty) ? item.qty : 0), 0);
}

// ---------------------------------------------------------------------------
// The registry
// ---------------------------------------------------------------------------

const field = (definition: FieldDefinition): FieldDefinition => definition;

export const FIELDS: readonly FieldDefinition[] = [
  // Order
  field({
    key: "order.number",
    label: bn("Order / invoice number", "অর্ডার / চালান নম্বর", "เลขที่คำสั่งซื้อ / ใบแจ้งหนี้"),
    group: "order",
    scope: "order",
    categories: ALL,
    valueType: "text",
    sample: () => "OHK-100042",
    resolve: (ctx) => text(ctx.order.number),
  }),
  field({
    key: "order.date",
    label: bn("Order date", "অর্ডারের তারিখ", "วันที่สั่งซื้อ"),
    group: "order",
    scope: "order",
    categories: ALL,
    valueType: "date",
    sample: () => "2026-10-11T09:30:00.000Z",
    resolve: (ctx) => text(ctx.order.date),
  }),
  field({
    key: "order.paymentStatus",
    label: bn("Payment status", "পেমেন্টের অবস্থা", "สถานะการชำระเงิน"),
    group: "order",
    scope: "order",
    categories: ALL,
    valueType: "text",
    sample: (locale) => paymentStatusLabel("paid", locale),
    resolve: (ctx) => paymentStatusLabel(ctx.order.paymentStatus, ctx.locale),
  }),
  field({
    key: "order.paymentMethod",
    label: bn("Payment method", "পেমেন্টের মাধ্যম", "วิธีชำระเงิน"),
    group: "order",
    scope: "order",
    categories: ALL,
    valueType: "text",
    sample: (locale) => paymentMethodLabel("cod", locale),
    resolve: (ctx) => paymentMethodLabel(ctx.order.paymentMethod, ctx.locale),
  }),
  field({
    key: "order.customerNote",
    label: bn("Customer note", "ক্রেতার নোট", "หมายเหตุจากลูกค้า"),
    group: "order",
    scope: "order",
    categories: ALL,
    valueType: "multiline",
    sample: (locale) => say(locale, "Please deliver in the afternoon", "กรุณาจัดส่งช่วงบ่าย"),
    resolve: (ctx) => text(ctx.order.customerNote),
  }),
  field({
    key: "order.internalNote",
    label: bn("Internal note (staff only)", "অভ্যন্তরীণ নোট (শুধু স্টাফ)", "บันทึกภายใน (เฉพาะพนักงาน)"),
    group: "order",
    scope: "order",
    categories: ALL,
    valueType: "multiline",
    sample: (locale) => say(locale, "Fragile: pack with care", "แตกง่าย: แพ็กอย่างระมัดระวัง"),
    resolve: (ctx) => text(ctx.order.internalNote),
  }),
  field({
    key: "order.takenBy",
    label: bn("Order taken by", "অর্ডার নিয়েছেন", "ผู้รับคำสั่งซื้อ"),
    group: "order",
    scope: "order",
    categories: ALL,
    valueType: "text",
    sample: (locale) => say(locale, "Somchai Srisuk", "สมชาย ศรีสุข"),
    resolve: (ctx) => text(ctx.order.takenBy),
  }),

  // Customer
  field({
    key: "customer.name",
    label: bn("Customer name", "ক্রেতার নাম", "ชื่อลูกค้า"),
    group: "customer",
    scope: "order",
    categories: ALL,
    valueType: "text",
    sample: (locale) => say(locale, "Somying Jaidee", "สมหญิง ใจดี"),
    resolve: (ctx) => text(ctx.customer.name),
  }),
  field({
    key: "customer.phone",
    label: bn("Customer phone", "ক্রেতার ফোন", "เบอร์โทรลูกค้า"),
    group: "customer",
    scope: "order",
    categories: ALL,
    valueType: "text",
    sample: () => "081-234-5678",
    resolve: (ctx) => text(ctx.customer.phone),
  }),
  field({
    key: "customer.email",
    label: bn("Customer email", "ক্রেতার ইমেইল", "อีเมลลูกค้า"),
    group: "customer",
    scope: "order",
    categories: ALL,
    valueType: "text",
    sample: () => "somying@example.com",
    resolve: (ctx) => text(ctx.customer.email),
  }),
  field({
    key: "customer.address",
    label: bn("Delivery address", "ডেলিভারি ঠিকানা", "ที่อยู่จัดส่ง"),
    group: "customer",
    scope: "order",
    categories: ALL,
    valueType: "multiline",
    sample: (locale) =>
      say(locale, "99 Moo 5, Kalasin Subdistrict\nMueang Kalasin, Kalasin 46000\nThailand", "99 หมู่ 5 ต.กาฬสินธุ์\nอ.เมืองกาฬสินธุ์ จ.กาฬสินธุ์ 46000\nประเทศไทย"),
    resolve: (ctx) => lines(ctx.customer.addressLines),
  }),

  // Money
  field({
    key: "money.subtotal",
    label: bn("Subtotal", "উপমোট", "ยอดรวมย่อย"),
    group: "money",
    scope: "order",
    categories: ALL,
    valueType: "money",
    sample: () => 4120,
    resolve: (ctx) => amount(ctx.money.subtotal),
  }),
  field({
    key: "money.discount",
    label: bn("Discount", "ছাড়", "ส่วนลด"),
    group: "money",
    scope: "order",
    categories: ALL,
    valueType: "money",
    sample: () => 200,
    resolve: (ctx) => amount(ctx.money.discount),
  }),
  field({
    key: "money.delivery",
    label: bn("Delivery charge", "ডেলিভারি চার্জ", "ค่าจัดส่ง"),
    group: "money",
    scope: "order",
    categories: ALL,
    valueType: "money",
    sample: () => 50,
    resolve: (ctx) => amount(ctx.money.delivery),
  }),
  field({
    key: "money.tax",
    label: bn("Tax", "কর", "ภาษี"),
    group: "money",
    scope: "order",
    categories: ALL,
    valueType: "money",
    sample: () => 0,
    resolve: (ctx) => amount(ctx.money.tax),
  }),
  field({
    key: "money.duty",
    label: bn("Import duty", "আমদানি শুল্ক", "อากรขาเข้า"),
    group: "money",
    scope: "order",
    categories: ALL,
    valueType: "money",
    sample: () => 0,
    resolve: (ctx) => amount(ctx.money.duty),
  }),
  field({
    key: "money.total",
    label: bn("Total", "মোট", "ยอดรวม"),
    group: "money",
    scope: "order",
    categories: ALL,
    valueType: "money",
    sample: () => 3970,
    resolve: (ctx) => amount(ctx.money.total),
  }),
  field({
    key: "money.paid",
    label: bn("Paid (advance)", "পরিশোধিত (অগ্রিম)", "ชำระแล้ว (มัดจำ)"),
    group: "money",
    scope: "order",
    categories: ALL,
    valueType: "money",
    sample: () => 0,
    resolve: (ctx) => amount(ctx.money.paid),
  }),
  field({
    key: "money.due",
    label: bn("Due", "বাকি", "ค้างชำระ"),
    group: "money",
    scope: "order",
    categories: ALL,
    valueType: "money",
    sample: () => 3970,
    resolve: (ctx) => amount(ctx.money.due),
  }),
  field({
    key: "money.cod",
    label: bn("Cash to collect", "নগদ আদায়", "ยอดเก็บเงินปลายทาง"),
    group: "money",
    scope: "order",
    categories: ALL,
    valueType: "money",
    sample: () => 3970,
    resolve: (ctx) => amount(ctx.money.cod),
  }),

  // Delivery
  field({
    key: "delivery.method",
    label: bn("Delivery method", "ডেলিভারির ধরন", "วิธีจัดส่ง"),
    group: "delivery",
    scope: "consignment",
    categories: ONLINE_AND_STICKER,
    valueType: "text",
    sample: (locale) => say(locale, "Standard delivery", "จัดส่งแบบมาตรฐาน"),
    resolve: (ctx) => text(ctx.delivery.method),
  }),
  field({
    key: "delivery.courier",
    label: bn("Courier", "কুরিয়ার", "ผู้ให้บริการขนส่ง"),
    group: "delivery",
    scope: "consignment",
    categories: ONLINE_AND_STICKER,
    valueType: "text",
    sample: () => "Kerry Express",
    resolve: (ctx) => text(ctx.delivery.courier),
  }),
  field({
    key: "delivery.service",
    label: bn("Courier service", "কুরিয়ার সার্ভিস", "บริการขนส่ง"),
    group: "delivery",
    scope: "consignment",
    categories: ONLINE_AND_STICKER,
    valueType: "text",
    sample: (locale) => say(locale, "Express", "ส่งด่วน"),
    resolve: (ctx) => text(ctx.delivery.service),
  }),
  field({
    key: "delivery.trackingNumber",
    label: bn("Tracking number", "ট্র্যাকিং নম্বর", "เลขพัสดุ"),
    group: "delivery",
    scope: "consignment",
    categories: ONLINE_AND_STICKER,
    valueType: "text",
    sample: () => "KEX0123456789",
    resolve: (ctx) => text(ctx.delivery.trackingNumber),
  }),
  field({
    key: "delivery.trackingUrl",
    label: bn("Tracking link", "ট্র্যাকিং লিংক", "ลิงก์ติดตามพัสดุ"),
    group: "delivery",
    scope: "consignment",
    categories: ONLINE_AND_STICKER,
    valueType: "url",
    sample: () => "https://example.com/track/KEX0123456789",
    resolve: (ctx) => text(ctx.delivery.trackingUrl),
  }),
  field({
    key: "delivery.seller",
    label: bn("Seller", "বিক্রেতা", "ผู้ขาย"),
    group: "delivery",
    scope: "consignment",
    categories: ONLINE_AND_STICKER,
    valueType: "text",
    sample: () => "Oh-K Shop | OTOP ฮักกาฬสินธุ์",
    resolve: (ctx) => text(ctx.delivery.seller),
  }),

  // Items (single-value summaries; per-line fields are columns)
  field({
    key: "items.names",
    label: bn("All product names", "সব পণ্যের নাম", "ชื่อสินค้าทั้งหมด"),
    group: "items",
    scope: "order",
    categories: ALL,
    valueType: "text",
    sample: (locale) => say(locale, "Praewa silk, Pha khao ma loincloth", "ผ้าไหมแพรวา, ผ้าขาวม้า"),
    resolve: (ctx) => itemsNames(ctx.items),
  }),
  field({
    key: "items.skuQtyList",
    label: bn("Product list (SKU × qty)", "পণ্য তালিকা (SKU × পরিমাণ)", "รายการสินค้า (SKU × จำนวน)"),
    group: "items",
    scope: "order",
    categories: ALL,
    valueType: "multiline",
    sample: () => "PRW-RED-2M × 1\nPKM-BLU × 2",
    resolve: (ctx) => itemsSkuQtyList(ctx.items),
  }),
  field({
    key: "items.summary",
    label: bn("Product list with qty and price", "পরিমাণ ও দামসহ পণ্য তালিকা", "รายการสินค้าพร้อมจำนวนและราคา"),
    group: "items",
    scope: "order",
    categories: ALL,
    valueType: "multiline",
    sample: (locale) =>
      say(locale, "Praewa silk × 1 — 3500\nPha khao ma loincloth × 2 — 500", "ผ้าไหมแพรวา × 1 — 3500\nผ้าขาวม้า × 2 — 500"),
    resolve: (ctx) => itemsSummary(ctx.items),
  }),
  field({
    key: "items.totalUnits",
    label: bn("Total units", "মোট ইউনিট", "จำนวนชิ้นรวม"),
    group: "items",
    scope: "order",
    categories: ALL,
    valueType: "number",
    sample: () => 3,
    resolve: (ctx) => itemsTotalUnits(ctx.items),
  }),

  // Store
  field({
    key: "store.name",
    label: bn("Store name", "দোকানের নাম", "ชื่อร้านค้า"),
    group: "store",
    scope: "store",
    categories: ALL,
    valueType: "text",
    sample: () => "Oh-K Shop | OTOP ฮักกาฬสินธุ์",
    resolve: (ctx) => text(ctx.store.name),
  }),
  field({
    key: "store.phone",
    label: bn("Store phone", "দোকানের ফোন", "เบอร์โทรร้านค้า"),
    group: "store",
    scope: "store",
    categories: ALL,
    valueType: "text",
    sample: () => "043-811-234",
    resolve: (ctx) => text(ctx.store.phone),
  }),
  field({
    key: "store.email",
    label: bn("Store email", "দোকানের ইমেইল", "อีเมลร้านค้า"),
    group: "store",
    scope: "store",
    categories: ALL,
    valueType: "text",
    sample: () => "shop@example.com",
    resolve: (ctx) => text(ctx.store.email),
  }),
  field({
    key: "store.address",
    label: bn("Store address", "দোকানের ঠিকানা", "ที่อยู่ร้านค้า"),
    group: "store",
    scope: "store",
    categories: ALL,
    valueType: "multiline",
    sample: (locale) => say(locale, "123 Kalasin Rd, Mueang Kalasin, Kalasin 46000", "123 ถ.กาฬสินธุ์ อ.เมืองกาฬสินธุ์ จ.กาฬสินธุ์ 46000"),
    resolve: (ctx) => text(ctx.store.address),
  }),
  field({
    key: "store.logo",
    label: bn("Store logo", "দোকানের লোগো", "โลโก้ร้านค้า"),
    group: "store",
    scope: "store",
    categories: ALL,
    valueType: "image",
    sample: () => "/logo.png",
    resolve: (ctx) => text(ctx.store.logo),
  }),
  field({
    key: "store.website",
    label: bn("Website", "ওয়েবসাইট", "เว็บไซต์"),
    group: "store",
    scope: "store",
    categories: ALL,
    valueType: "url",
    sample: () => "https://example.com",
    resolve: (ctx) => text(ctx.store.website),
  }),
  field({
    key: "store.facebook",
    label: bn("Facebook page", "ফেসবুক পেজ", "เพจ Facebook"),
    group: "store",
    scope: "store",
    categories: ALL,
    valueType: "url",
    sample: () => "https://facebook.com/example",
    resolve: (ctx) => text(ctx.store.facebook),
  }),
  field({
    key: "store.taxId",
    label: bn("Tax registration", "কর নিবন্ধন", "เลขประจำตัวผู้เสียภาษี"),
    group: "store",
    scope: "store",
    categories: ALL,
    valueType: "text",
    sample: (locale) => say(locale, "Tax ID 0465512345678", "เลขประจำตัวผู้เสียภาษี 0465512345678"),
    resolve: (ctx) => text(ctx.store.taxId),
  }),

  // POS
  field({
    key: "pos.counter",
    label: bn("Counter", "কাউন্টার", "เคาน์เตอร์"),
    group: "pos",
    scope: "pos",
    categories: POS_ONLY,
    valueType: "text",
    sample: (locale) => say(locale, "Kalasin counter", "เคาน์เตอร์กาฬสินธุ์"),
    resolve: (ctx) => text(ctx.pos?.counter),
  }),
  field({
    key: "pos.cashier",
    label: bn("Cashier", "ক্যাশিয়ার", "แคชเชียร์"),
    group: "pos",
    scope: "pos",
    categories: POS_ONLY,
    valueType: "text",
    sample: (locale) => say(locale, "Somchai Srisuk", "สมชาย ศรีสุข"),
    resolve: (ctx) => text(ctx.pos?.cashier),
  }),
  field({
    key: "pos.tenders",
    label: bn("Payments (tender by tender)", "পেমেন্ট (প্রতিটি মাধ্যম)", "การชำระเงิน (แยกตามช่องทาง)"),
    group: "pos",
    scope: "pos",
    categories: POS_ONLY,
    valueType: "multiline",
    sample: (locale) => say(locale, "Card: 1000\nCash: 610", "บัตร: 1000\nเงินสด: 610"),
    resolve: (ctx) => tendersText(ctx.pos?.tenders ?? []),
  }),
  field({
    key: "pos.cashTendered",
    label: bn("Cash tendered", "নগদ প্রদান", "รับเงินสด"),
    group: "pos",
    scope: "pos",
    categories: POS_ONLY,
    valueType: "money",
    sample: () => 1200,
    resolve: (ctx) => amount(ctx.pos?.cashTendered),
  }),
  field({
    key: "pos.change",
    label: bn("Change", "ফেরত", "เงินทอน"),
    group: "pos",
    scope: "pos",
    categories: POS_ONLY,
    valueType: "money",
    sample: () => 45,
    resolve: (ctx) => amount(ctx.pos?.change),
  }),
  field({
    key: "pos.taxExemptReason",
    label: bn("Tax exemption reason", "কর অব্যাহতির কারণ", "เหตุผลการยกเว้นภาษี"),
    group: "pos",
    scope: "pos",
    categories: POS_ONLY,
    valueType: "text",
    sample: (locale) => say(locale, "Diplomatic mission (EX-221)", "คณะผู้แทนทางการทูต (EX-221)"),
    resolve: (ctx) => text(ctx.pos?.taxExemptReason),
  }),

  // Page
  field({
    key: "page.number",
    label: bn("Page number", "পৃষ্ঠা নম্বর", "เลขหน้า"),
    group: "page",
    scope: "page",
    categories: ALL,
    valueType: "number",
    sample: () => 1,
    resolve: (ctx) => ctx.page.number,
  }),
  field({
    key: "page.count",
    label: bn("Page count", "মোট পৃষ্ঠা", "จำนวนหน้า"),
    group: "page",
    scope: "page",
    categories: ALL,
    valueType: "number",
    sample: () => 1,
    resolve: (ctx) => ctx.page.count,
  }),
  field({
    key: "page.label",
    label: bn("Page label", "পৃষ্ঠা লেবেল", "ป้ายเลขหน้า"),
    group: "page",
    scope: "page",
    categories: ALL,
    valueType: "text",
    sample: (locale) => pageLabel({ number: 1, count: 3 }, locale),
    resolve: (ctx) => pageLabel(ctx.page, ctx.locale),
  }),
];

const itemField = (definition: ItemFieldDefinition): ItemFieldDefinition => definition;

export const ITEM_FIELDS: readonly ItemFieldDefinition[] = [
  itemField({
    key: "item.name",
    label: bn("Name", "নাম", "ชื่อ"),
    valueType: "text",
    sample: (locale) => say(locale, "Praewa silk", "ผ้าไหมแพรวา"),
    resolve: (item) => text(item.name),
  }),
  itemField({
    key: "item.variant",
    label: bn("Variant", "ভ্যারিয়েন্ট", "ตัวเลือกสินค้า"),
    valueType: "text",
    sample: (locale) => say(locale, "Red / 2 m", "แดง / 2 เมตร"),
    resolve: (item) => text(item.variant),
  }),
  itemField({
    key: "item.colour",
    label: bn("Colour", "রং", "สี"),
    valueType: "text",
    sample: (locale) => say(locale, "Red", "แดง"),
    resolve: (item) => text(item.colour),
  }),
  itemField({
    key: "item.size",
    label: bn("Size", "সাইজ", "ขนาด"),
    valueType: "text",
    sample: (locale) => say(locale, "2 m", "2 เมตร"),
    resolve: (item) => text(item.size),
  }),
  itemField({
    key: "item.sku",
    label: bn("SKU", "SKU", "SKU"),
    valueType: "text",
    sample: () => "PRW-RED-2M",
    resolve: (item) => text(item.sku),
  }),
  itemField({
    key: "item.qty",
    label: bn("Quantity", "পরিমাণ", "จำนวน"),
    valueType: "number",
    sample: () => 2,
    resolve: (item) => amount(item.qty),
  }),
  itemField({
    key: "item.unitPrice",
    label: bn("Unit price", "একক মূল্য", "ราคาต่อหน่วย"),
    valueType: "money",
    sample: () => 3500,
    resolve: (item) => amount(item.unitPrice),
  }),
  itemField({
    key: "item.compareAtPrice",
    label: bn("Original price", "আসল মূল্য", "ราคาเดิม"),
    valueType: "money",
    sample: () => 4200,
    resolve: (item) => amount(item.compareAtPrice),
  }),
  itemField({
    key: "item.lineDiscount",
    label: bn("Line discount", "লাইন ছাড়", "ส่วนลดรายการ"),
    valueType: "money",
    sample: () => 100,
    resolve: (item) => amount(item.lineDiscount),
  }),
  itemField({
    key: "item.lineTotal",
    label: bn("Line total", "লাইন মোট", "รวมรายการ"),
    valueType: "money",
    sample: () => 6900,
    resolve: (item) => amount(item.lineTotal),
  }),
  itemField({
    key: "item.image",
    label: bn("Image", "ছবি", "รูปภาพ"),
    valueType: "image",
    sample: () => "/placeholder-product.png",
    resolve: (item) => text(item.image),
  }),
  itemField({
    key: "item.weight",
    label: bn("Weight", "ওজন", "น้ำหนัก"),
    valueType: "text",
    sample: () => "0.5 kg",
    resolve: (item) => text(item.weight),
  }),
  itemField({
    key: "item.note",
    label: bn("Line note", "লাইন নোট", "หมายเหตุรายการ"),
    valueType: "text",
    sample: (locale) => say(locale, "Gift wrap", "ห่อของขวัญ"),
    resolve: (item) => text(item.note),
  }),
  itemField({
    key: "item.taxRate",
    label: bn("Tax rate (%)", "করের হার (%)", "อัตราภาษี (%)"),
    valueType: "number",
    sample: () => 7,
    resolve: (item) => amount(item.taxRate),
  }),
  itemField({
    key: "item.tax",
    label: bn("Tax", "কর", "ภาษี"),
    valueType: "money",
    sample: () => 483,
    resolve: (item) => amount(item.tax),
  }),
  itemField({
    key: "item.totalWithTax",
    label: bn("Total with tax", "করসহ মোট", "ยอดรวมรวมภาษี"),
    valueType: "money",
    sample: () => 7383,
    resolve: (item) => amount(item.totalWithTax),
  }),
];

const FIELD_BY_KEY: ReadonlyMap<FieldKey, FieldDefinition> = new Map(FIELDS.map((entry) => [entry.key, entry]));
const ITEM_FIELD_BY_KEY: ReadonlyMap<ItemFieldKey, ItemFieldDefinition> = new Map(
  ITEM_FIELDS.map((entry) => [entry.key, entry]),
);

if (FIELD_BY_KEY.size !== FIELD_KEYS.length || ITEM_FIELD_BY_KEY.size !== ITEM_FIELD_KEYS.length) {
  throw new Error("invoice-templates: the field registry and field-keys.ts disagree");
}

export function getField(key: FieldKey): FieldDefinition {
  return FIELD_BY_KEY.get(key)!;
}

export function getItemField(key: ItemFieldKey): ItemFieldDefinition {
  return ITEM_FIELD_BY_KEY.get(key)!;
}

/**
 * Whether a design prints the staff-only internal note (§4.14): a text
 * element bound to `order.internalNote`, or a Notes block reading it. The
 * admin print-context route puts the note into the context only then; the
 * vendor route never does.
 */
export function designUsesInternalNote(design: Pick<TemplateDesign, "elements"> | null | undefined): boolean {
  return (design?.elements ?? []).some(
    (element) =>
      (element.binding?.mode === "field" && element.binding.field === "order.internalNote") ||
      (element.type === "notes" && element.config.source === "internalNote"),
  );
}

/** Whether a field is valid for a category (the picker hides the rest). */
export function isFieldAvailable(key: FieldKey, category: TemplateCategory): boolean {
  return getField(key).categories.includes(category);
}

/** The fields the picker offers for a category, in registry order. */
export function fieldsForCategory(category: TemplateCategory): FieldDefinition[] {
  return FIELDS.filter((entry) => entry.categories.includes(category));
}

/**
 * The value a field prints for a context, or `null`. A key that is not valid
 * for the context's category still resolves (the Review tab warns instead).
 */
export function resolveField(key: FieldKey, context: PrintContext): FieldValue {
  const value = getField(key).resolve(context);
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  return value ?? null;
}

export function resolveItemField(key: ItemFieldKey, item: ContextItem, context: PrintContext): FieldValue {
  const value = getItemField(key).resolve(item, context);
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  return value ?? null;
}

/** Every field with its value, for the Review tab and tests. */
export function resolveAllFields(context: PrintContext): Record<FieldKey, FieldValue> {
  const out = {} as Record<FieldKey, FieldValue>;
  for (const key of FIELD_KEYS) out[key] = resolveField(key, context);
  return out;
}

export function resolveAllItemFields(item: ContextItem, context: PrintContext): Record<ItemFieldKey, FieldValue> {
  const out = {} as Record<ItemFieldKey, FieldValue>;
  for (const key of ITEM_FIELD_KEYS) out[key] = resolveItemField(key, item, context);
  return out;
}
