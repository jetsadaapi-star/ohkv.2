/**
 * Thai wording for the order timeline.
 *
 * The audit log stores each event as a finished English sentence
 * (lib/orders/audit-order.ts), so the record reads the same whatever the
 * viewer's language. On a Thai screen the known sentence shapes are reworded
 * here, at display time; anything not recognised is shown as stored.
 */

const STATUS_TH: Record<string, string> = {
  pending: "รอดำเนินการ",
  preordered: "พรีออร์เดอร์",
  processing: "กำลังเตรียมสินค้า",
  shipped: "จัดส่งแล้ว",
  delivered: "ได้รับสินค้าแล้ว",
  cancelled: "ยกเลิก",
  paid: "ชำระแล้ว",
  refunded: "คืนเงินแล้ว",
  partially_refunded: "คืนเงินบางส่วน",
};

const METHOD_TH: Record<string, string> = {
  promptpay: "พร้อมเพย์",
  bank_transfer: "โอนผ่านธนาคาร",
  cod: "เก็บเงินปลายทาง",
  card: "บัตร",
  stripe: "บัตร",
  store_credit: "เครดิตร้านค้า",
  cash: "เงินสด",
  manual: "ชำระกับร้าน",
};

const SOURCE_TH: Record<string, string> = {
  "the online store": "หน้าร้านออนไลน์",
  "the POS register": "เครื่อง POS",
  "the admin panel": "หลังร้าน",
  "the shopper app": "แอปลูกค้า",
};

const FIELD_TH: Record<string, string> = {
  status: "สถานะ",
  paymentStatus: "สถานะการชำระเงิน",
  paidAt: "วันที่ชำระ",
  subOrders: "รายการย่อย",
  customerId: "ลูกค้า",
  trackingNumber: "เลขพัสดุ",
  carrier: "ขนส่ง",
  notes: "หมายเหตุ",
  cancelReason: "เหตุผลการยกเลิก",
  cancelledAt: "วันที่ยกเลิก",
  shippingAddress: "ที่อยู่จัดส่ง",
  billingAddress: "ที่อยู่ใบเสร็จ",
  items: "รายการสินค้า",
  tags: "แท็ก",
  transferPayment: "การโอนเงิน",
};
// Bookkeeping fields nobody needs to read about.
const SILENT_FIELDS = new Set(["updatedAt", "statusChangedBy", "statusChangedAt", "__v"]);

const status = (s: string) => STATUS_TH[s.trim()] ?? s.replace(/_/g, " ");
const method = (m: string) => METHOD_TH[m.trim()] ?? m;
const money = (s: string) => s.replace(/^THB\s?/, "฿").replace(/\s?THB$/, " บาท");

const RULES: Array<[RegExp, (...m: string[]) => string]> = [
  [
    /^Order placed via (.+?)(?: for return (\S+))? — (\d+) items?, (.+?)(?: via (\S+))?$/,
    (_, source, ret, count, amount, via) =>
      `สั่งซื้อผ่าน${SOURCE_TH[source] ?? source}${ret ? ` (เปลี่ยนสินค้าจากการคืน ${ret})` : ""} — ${count} ชิ้น ${money(amount)}${via ? ` ชำระด้วย${method(via)}` : ""}`,
  ],
  [/^Shipment created for (.+?) — (.+)$/, (_, vendor, rest) => `สร้างพัสดุของ ${vendor} — ${shipmentParts(rest)}`],
  [/^Shipment created — (.+)$/, (_, rest) => `สร้างพัสดุ — ${shipmentParts(rest)}`],
  [/^Shipment created$/, () => "สร้างพัสดุ"],
  [
    /^Status changed from (\S+) to (\S+)(?: — (.+))?$/,
    (_, from, to, reason) => `เปลี่ยนสถานะจาก “${status(from)}” เป็น “${status(to)}”${reason ? ` — ${reason}` : ""}`,
  ],
  [
    /^Status overridden from (\S+) to (\S+) — (.+)$/,
    (_, from, to, reason) => `แก้สถานะจาก “${status(from)}” เป็น “${status(to)}” (ข้ามขั้นตอน) — ${reason}`,
  ],
  [
    /^(Payment|Deposit) of (.+?) received via (\S+?)(?:, with (.+?) of store credit)?$/,
    (_, kind, amount, via, credit) =>
      `ได้รับ${kind === "Deposit" ? "มัดจำ" : "ชำระเงิน"} ${money(amount)} ผ่าน${method(via)}${credit ? ` และเครดิตร้านค้า ${money(credit)}` : ""}`,
  ],
  [/^Paid with (.+?) of store credit$/, (_, amount) => `ชำระด้วยเครดิตร้านค้า ${money(amount)}`],
  [
    /^Order cancelled (automatically|by the customer|by staff)(?: — (.+))?$/,
    (_, by, reason) =>
      `ยกเลิกคำสั่งซื้อ${by === "automatically" ? "อัตโนมัติ" : by === "by the customer" ? "โดยลูกค้า" : "โดยพนักงาน"}${reason ? ` — ${reason}` : ""}`,
  ],
  [
    /^Refund of (.+?)(?: for return (\S+))? recorded as sent by (.+?)(?: \(ref (.+)\))?$/,
    (_, amount, ret, by, ref) =>
      `บันทึกการคืนเงิน ${money(amount)}${ret ? ` (คืนสินค้า ${ret})` : ""} ผ่าน${method(by)}${ref ? ` (อ้างอิง ${ref})` : ""}`,
  ],
  [
    /^Refund of (.+?) cancelled before it was sent(?: — (.+))?$/,
    (_, amount, reason) => `ยกเลิกการคืนเงิน ${money(amount)} ก่อนโอน${reason ? ` — ${reason}` : ""}`,
  ],
  [
    /^Updated order fields: (.+)$/,
    (_, list) => {
      const fields = list
        .split(",")
        .map((f) => f.trim())
        .filter((f) => f && !SILENT_FIELDS.has(f))
        .map((f) => FIELD_TH[f] ?? f);
      return fields.length ? `แก้ไขข้อมูลคำสั่งซื้อ: ${fields.join(", ")}` : "แก้ไขข้อมูลคำสั่งซื้อ";
    },
  ],
];

function shipmentParts(rest: string) {
  return rest
    .split(" · ")
    .map((part) => (part === "Internal fulfillment" ? "จัดส่งโดยร้านค้า" : part))
    .join(" · ");
}

/** The summary in Thai when its shape is known; otherwise as stored. */
export function timelineSummaryTh(summary: string): string {
  for (const [pattern, render] of RULES) {
    const match = summary.match(pattern);
    if (match) return render(...match.map((m) => m ?? ""));
  }
  return summary;
}
