/**
 * Invoice PDF — A4, Thai-first with English sub-labels, drawn with
 * @react-pdf/renderer. Thai text handling (font, wrapping, SARA AM) lives in
 * lib/pdf/thai-pdf.ts.
 */

import { fetchStoredFile, readCappedBody } from "@/lib/storage/fetch-stored-file";
import sharp from "sharp";
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import {
  PDF_FONT,
  bahtText,
  isThailand,
  localityLine,
  pdfMoney,
  printablePhone,
  thaiDate,
  tx,
} from "@/lib/pdf/thai-pdf";

// ============================================
// Types
// ============================================

export interface InvoiceItem {
  name: string;
  description?: string;
  /** SKU or variant, printed small under the name. */
  sku?: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface InvoiceAddress {
  name: string;
  street: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
  phone?: string;
  email?: string;
}

export interface InvoiceData {
  invoiceNumber: string;
  status: "Paid" | "Partially paid" | "Pending" | "Overdue" | "Cancelled";
  dateCreated: string;
  /** Left off the page when there is no real date to print. */
  dueDate?: string;
  /** ISO dates; when given they are printed in Thai (6 พ.ย. 2569). */
  issuedAt?: string;
  dueAt?: string;
  paidAt?: string;
  /** How it was paid, already worded (e.g. "พร้อมเพย์"). */
  paymentMethodLabel?: string;
  from: InvoiceAddress;
  to: InvoiceAddress;
  /** Where the goods go, when that differs from who is billed. */
  shipTo?: InvoiceAddress;
  items: InvoiceItem[];
  subtotal: number;
  shipping: number;
  discount: number;
  tax: number;
  /** Import duties collected at checkout (DDP); part of `total`. */
  duty?: number;
  total: number;
  /**
   * What has been paid and what is still owed, for an order that is not
   * settled in one payment (a deposit pre-order). Absent, the total already
   * says it.
   */
  payment?: {
    /** Everything that arrived, before any refund. */
    amountPaid: number;
    amountRefunded: number;
    balanceDue: number;
  };
  currency: string;
  locale?: string;
  notes?: string;
  supportEmail?: string;
  supportPhone?: string;
  logoUrl?: string;
  storeName?: string;
  /** Brand colour for the accents; a deep green when unset. */
  accentColor?: string;
}

// ============================================
// Styles
// ============================================

const C = {
  ink: "#0F172A",
  text: "#334155",
  muted: "#64748B",
  faint: "#94A3B8",
  line: "#E2E8F0",
  soft: "#F8FAFC",
  white: "#FFFFFF",
};

const STATUS: Record<InvoiceData["status"], { th: string; en: string; bg: string; fg: string }> = {
  Paid: { th: "ชำระแล้ว", en: "PAID", bg: "#DCFCE7", fg: "#15803D" },
  "Partially paid": { th: "ชำระบางส่วน", en: "PARTIALLY PAID", bg: "#E0F2FE", fg: "#0369A1" },
  Pending: { th: "รอชำระเงิน", en: "UNPAID", bg: "#FEF3C7", fg: "#B45309" },
  Overdue: { th: "เกินกำหนดชำระ", en: "OVERDUE", bg: "#FEE2E2", fg: "#B91C1C" },
  Cancelled: { th: "ยกเลิก / คืนเงิน", en: "VOID", bg: "#F1F5F9", fg: "#475569" },
};

const styles = StyleSheet.create({
  page: {
    fontFamily: PDF_FONT,
    fontSize: 9.5,
    color: C.text,
    backgroundColor: C.white,
    paddingTop: 0,
    paddingBottom: 70,
    paddingHorizontal: 0,
  },
  accentBar: { height: 6 },
  body: { paddingHorizontal: 40, paddingTop: 26 },

  // Header
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  brand: { maxWidth: 270 },
  logo: { maxWidth: 150, maxHeight: 50, objectFit: "contain", marginBottom: 8 },
  storeName: { fontSize: 15, fontWeight: 800, color: C.ink, lineHeight: 1.25 },
  storeLine: { fontSize: 8.5, color: C.muted, lineHeight: 1.45 },
  titleBox: { alignItems: "flex-end" },
  title: { fontSize: 24, fontWeight: 800, color: C.ink, lineHeight: 1.1 },
  titleEn: { fontSize: 8, fontWeight: 700, color: C.faint, letterSpacing: 3, marginTop: 1 },
  statusPill: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  statusText: { fontSize: 9, fontWeight: 700 },
  statusEn: { fontSize: 6.5, fontWeight: 700, marginLeft: 5, letterSpacing: 0.6 },

  // Meta strip
  meta: {
    flexDirection: "row",
    marginTop: 20,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 8,
    backgroundColor: C.soft,
  },
  metaCell: { flex: 1, paddingVertical: 8, paddingHorizontal: 11 },
  metaCellBorder: { borderLeftWidth: 1, borderLeftColor: C.line },
  metaLabel: { fontSize: 7.5, color: C.muted, fontWeight: 600 },
  metaValue: { fontSize: 10, color: C.ink, fontWeight: 700, marginTop: 1 },

  // Parties
  parties: { flexDirection: "row", marginTop: 16 },
  party: { flex: 1, paddingRight: 14 },
  partyHead: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  partyDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  partyLabel: { fontSize: 8, fontWeight: 700, color: C.muted, letterSpacing: 0.4 },
  partyName: { fontSize: 11.5, fontWeight: 700, color: C.ink, lineHeight: 1.3 },
  partyLine: { fontSize: 9, color: C.text, lineHeight: 1.45 },

  // Items table
  table: { marginTop: 18, borderRadius: 8, overflow: "hidden", borderWidth: 1, borderColor: C.line },
  thead: { flexDirection: "row", paddingVertical: 7, paddingHorizontal: 10 },
  th: { fontSize: 8, fontWeight: 700, color: C.white },
  row: { flexDirection: "row", paddingVertical: 7, paddingHorizontal: 10, borderTopWidth: 1, borderTopColor: C.line },
  rowAlt: { backgroundColor: C.soft },
  td: { fontSize: 9.5, color: C.text },
  colNo: { width: "6%" },
  colDesc: { width: "50%", paddingRight: 8 },
  colQty: { width: "10%", textAlign: "center" },
  colUnit: { width: "16%", textAlign: "right" },
  colTotal: { width: "18%", textAlign: "right" },
  itemName: { fontSize: 9.5, fontWeight: 600, color: C.ink, lineHeight: 1.35 },
  itemSub: { fontSize: 7.5, color: C.muted, marginTop: 1 },

  // Summary
  summaryWrap: { flexDirection: "row", marginTop: 14 },
  words: { flex: 1, paddingRight: 18 },
  wordsBox: { borderRadius: 8, backgroundColor: C.soft, paddingVertical: 8, paddingHorizontal: 11 },
  wordsLabel: { fontSize: 7.5, color: C.muted, fontWeight: 600 },
  wordsValue: { fontSize: 10, fontWeight: 700, color: C.ink, marginTop: 1 },
  payBox: { marginTop: 8, borderRadius: 8, borderWidth: 1, borderColor: C.line, paddingVertical: 8, paddingHorizontal: 11 },
  payRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 1 },
  summary: { width: 215 },
  sumRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  sumLabel: { fontSize: 9.5, color: C.muted },
  sumValue: { fontSize: 9.5, color: C.ink, fontWeight: 600 },
  totalBox: {
    marginTop: 6,
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 11,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel: { fontSize: 10, fontWeight: 700, color: C.white },
  totalLabelEn: { fontSize: 6.5, fontWeight: 700, color: C.white, opacity: 0.75, letterSpacing: 0.6 },
  totalValue: { fontSize: 16, fontWeight: 800, color: C.white },
  balanceRow: {
    marginTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    borderRadius: 8,
    borderWidth: 1.5,
    paddingVertical: 6,
    paddingHorizontal: 11,
  },

  // Notes
  notes: { marginTop: 20, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 12, flexDirection: "row" },
  noteCol: { flex: 1, paddingRight: 16 },
  noteLabel: { fontSize: 8, fontWeight: 700, color: C.muted, letterSpacing: 0.4, marginBottom: 2 },
  noteText: { fontSize: 9, color: C.text, lineHeight: 1.5 },
  signCol: { width: 180, alignItems: "center", paddingTop: 26 },
  signLine: { width: 160, borderBottomWidth: 1, borderBottomColor: C.faint, borderStyle: "dashed" },
  signLabel: { fontSize: 8, color: C.muted, marginTop: 4 },
  signStore: { fontSize: 8.5, fontWeight: 700, color: C.ink, marginTop: 1 },

  // Footer
  footer: {
    position: "absolute",
    bottom: 22,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: C.line,
    paddingTop: 8,
  },
  footerText: { fontSize: 7.5, color: C.faint },
  thanks: { fontSize: 9, fontWeight: 700 },
});

// ============================================
// Pieces
// ============================================

function addressLines(addr: InvoiceAddress, withContact = true) {
  const lines: string[] = [];
  if (addr.street) lines.push(addr.street);
  const locality = localityLine(addr.city, addr.state);
  const place = [locality, addr.postalCode].filter(Boolean).join(" ");
  if (place) lines.push(place);
  if (addr.country && !isThailand(addr.country)) lines.push(addr.country);
  if (withContact) {
    const phone = printablePhone(addr.phone);
    if (phone) lines.push(`โทร\u00A0${phone}`);
    if (addr.email) lines.push(addr.email);
  }
  return lines.map((l) => tx(l));
}

function Party({
  th,
  en,
  color,
  addr,
}: {
  th: string;
  en: string;
  color: string;
  addr: InvoiceAddress;
}) {
  return (
    <View style={styles.party}>
      <View style={styles.partyHead}>
        <View style={[styles.partyDot, { backgroundColor: color }]} />
        <Text style={styles.partyLabel}>{tx(`${th} · ${en}`)}</Text>
      </View>
      <Text style={styles.partyName}>{tx(addr.name)}</Text>
      {addressLines(addr).map((line, i) => (
        <Text key={i} style={styles.partyLine}>
          {line}
        </Text>
      ))}
    </View>
  );
}

function sameAddress(a?: InvoiceAddress, b?: InvoiceAddress) {
  if (!a || !b) return true;
  return [a.street, a.city, a.state, a.postalCode].join("|") === [b.street, b.city, b.state, b.postalCode].join("|");
}

// ============================================
// Invoice Document Component
// ============================================

function InvoiceDocument({
  data,
  logoDataUri,
}: {
  data: InvoiceData;
  logoDataUri?: string;
}) {
  const accent = data.accentColor || "#0B7A55";
  const money = (amount: number) => pdfMoney(amount, data.currency);
  const status = STATUS[data.status] ?? STATUS.Pending;
  const issued = data.issuedAt ? thaiDate(data.issuedAt) : data.dateCreated;
  const due = data.dueAt ? thaiDate(data.dueAt) : data.dueDate;
  const isPaid = data.status === "Paid";
  const storeName = data.storeName || data.from.name || "";
  const storeLines = addressLines(data.from);
  const showShipTo = data.shipTo && !sameAddress(data.shipTo, data.to);
  const amountForWords = data.payment ? data.payment.balanceDue : data.total;
  const thb = (data.currency || "THB").toUpperCase() === "THB";

  return (
    <Document title={tx(`ใบแจ้งหนี้ ${data.invoiceNumber}`)} author={storeName}>
      <Page size="A4" style={styles.page}>
        <View style={[styles.accentBar, { backgroundColor: accent }]} fixed />

        <View style={styles.body}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.brand}>
              {logoDataUri ? (
                // eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer's Image has no alt prop
                <Image src={logoDataUri} style={styles.logo} />
              ) : null}
              <Text style={styles.storeName}>{tx(storeName)}</Text>
              {storeLines.map((line, i) => (
                <Text key={i} style={styles.storeLine}>
                  {line}
                </Text>
              ))}
            </View>
            <View style={styles.titleBox}>
              <Text style={[styles.title, { color: accent }]}>
                {tx(isPaid ? "ใบเสร็จรับเงิน" : "ใบแจ้งหนี้")}
              </Text>
              <Text style={styles.titleEn}>{isPaid ? "RECEIPT / INVOICE" : "INVOICE"}</Text>
              <View style={[styles.statusPill, { backgroundColor: status.bg }]}>
                <Text style={[styles.statusText, { color: status.fg }]}>{tx(status.th)}</Text>
                <Text style={[styles.statusEn, { color: status.fg }]}>{status.en}</Text>
              </View>
            </View>
          </View>

          {/* Meta strip */}
          <View style={styles.meta}>
            <View style={styles.metaCell}>
              <Text style={styles.metaLabel}>{tx("เลขที่ · No.")}</Text>
              <Text style={styles.metaValue}>{data.invoiceNumber}</Text>
            </View>
            <View style={[styles.metaCell, styles.metaCellBorder]}>
              <Text style={styles.metaLabel}>{tx("วันที่ออก · Date")}</Text>
              <Text style={styles.metaValue}>{tx(issued)}</Text>
            </View>
            {isPaid && data.paidAt ? (
              <View style={[styles.metaCell, styles.metaCellBorder]}>
                <Text style={styles.metaLabel}>{tx("วันที่ชำระ · Paid on")}</Text>
                <Text style={styles.metaValue}>{tx(thaiDate(data.paidAt))}</Text>
              </View>
            ) : due ? (
              <View style={[styles.metaCell, styles.metaCellBorder]}>
                <Text style={styles.metaLabel}>{tx("ครบกำหนด · Due")}</Text>
                <Text style={styles.metaValue}>{tx(due)}</Text>
              </View>
            ) : null}
            {data.paymentMethodLabel ? (
              <View style={[styles.metaCell, styles.metaCellBorder]}>
                <Text style={styles.metaLabel}>{tx("ชำระโดย · Payment")}</Text>
                <Text style={styles.metaValue}>{tx(data.paymentMethodLabel)}</Text>
              </View>
            ) : null}
          </View>

          {/* Parties */}
          <View style={styles.parties}>
            <Party th="ลูกค้า" en="BILL TO" color={accent} addr={data.to} />
            {showShipTo && data.shipTo ? (
              <Party th="ที่อยู่จัดส่ง" en="SHIP TO" color={C.faint} addr={{ ...data.shipTo, email: undefined }} />
            ) : null}
          </View>

          {/* Items */}
          <View style={styles.table}>
            <View style={[styles.thead, { backgroundColor: accent }]} fixed>
              <Text style={[styles.th, styles.colNo]}>#</Text>
              <Text style={[styles.th, styles.colDesc]}>{tx("รายการ · Description")}</Text>
              <Text style={[styles.th, styles.colQty]}>{tx("จำนวน")}</Text>
              <Text style={[styles.th, styles.colUnit]}>{tx("ราคา/หน่วย")}</Text>
              <Text style={[styles.th, styles.colTotal]}>{tx("จำนวนเงิน")}</Text>
            </View>
            {data.items.map((item, index) => (
              <View key={index} style={[styles.row, index % 2 === 1 ? styles.rowAlt : {}]} wrap={false}>
                <Text style={[styles.td, styles.colNo]}>{index + 1}</Text>
                <View style={styles.colDesc}>
                  <Text style={styles.itemName}>{tx(item.name)}</Text>
                  {item.sku || item.description ? (
                    <Text style={styles.itemSub}>{tx([item.sku, item.description].filter(Boolean).join(" · "))}</Text>
                  ) : null}
                </View>
                <Text style={[styles.td, styles.colQty]}>{item.quantity}</Text>
                <Text style={[styles.td, styles.colUnit]}>{money(item.unitPrice)}</Text>
                <Text style={[styles.td, styles.colTotal, { color: C.ink, fontWeight: 600 }]}>{money(item.total)}</Text>
              </View>
            ))}
          </View>

          {/* Words + totals */}
          <View style={styles.summaryWrap} wrap={false}>
            <View style={styles.words}>
              {thb ? (
                <View style={styles.wordsBox}>
                  <Text style={styles.wordsLabel}>{tx(data.payment ? "ยอดคงค้าง (ตัวอักษร)" : "จำนวนเงิน (ตัวอักษร)")}</Text>
                  <Text style={styles.wordsValue}>{tx(`(${bahtText(amountForWords)})`)}</Text>
                </View>
              ) : null}
              {data.payment ? (
                <View style={styles.payBox}>
                  <View style={styles.payRow}>
                    <Text style={styles.sumLabel}>{tx("ชำระแล้ว")}</Text>
                    <Text style={styles.sumValue}>{money(data.payment.amountPaid)}</Text>
                  </View>
                  {data.payment.amountRefunded > 0 ? (
                    <View style={styles.payRow}>
                      <Text style={styles.sumLabel}>{tx("คืนเงิน")}</Text>
                      <Text style={styles.sumValue}>-{money(data.payment.amountRefunded)}</Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>

            <View style={styles.summary}>
              <View style={styles.sumRow}>
                <Text style={styles.sumLabel}>{tx("รวมเป็นเงิน")}</Text>
                <Text style={styles.sumValue}>{money(data.subtotal)}</Text>
              </View>
              {data.discount > 0 ? (
                <View style={styles.sumRow}>
                  <Text style={styles.sumLabel}>{tx("ส่วนลด")}</Text>
                  <Text style={[styles.sumValue, { color: "#B91C1C" }]}>-{money(data.discount)}</Text>
                </View>
              ) : null}
              {data.shipping !== 0 ? (
                <View style={styles.sumRow}>
                  <Text style={styles.sumLabel}>{tx("ค่าจัดส่ง")}</Text>
                  <Text style={styles.sumValue}>{money(data.shipping)}</Text>
                </View>
              ) : null}
              {data.tax > 0 ? (
                <View style={styles.sumRow}>
                  <Text style={styles.sumLabel}>{tx("ภาษี")}</Text>
                  <Text style={styles.sumValue}>{money(data.tax)}</Text>
                </View>
              ) : null}
              {(data.duty ?? 0) > 0 ? (
                <View style={styles.sumRow}>
                  <Text style={styles.sumLabel}>{tx("อากรขาเข้า")}</Text>
                  <Text style={styles.sumValue}>{money(data.duty ?? 0)}</Text>
                </View>
              ) : null}
              <View style={[styles.totalBox, { backgroundColor: accent }]}>
                <View>
                  <Text style={styles.totalLabel}>{tx("ยอดรวมทั้งสิ้น")}</Text>
                  <Text style={styles.totalLabelEn}>GRAND TOTAL</Text>
                </View>
                <Text style={styles.totalValue}>{money(data.total)}</Text>
              </View>
              {data.payment ? (
                <View style={[styles.balanceRow, { borderColor: accent }]}>
                  <Text style={[styles.sumLabel, { color: C.ink, fontWeight: 700 }]}>{tx("ยอดคงค้าง")}</Text>
                  <Text style={[styles.sumValue, { fontSize: 11, fontWeight: 800, color: accent }]}>
                    {money(data.payment.balanceDue)}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Notes */}
          <View style={styles.notes} wrap={false}>
            <View style={styles.noteCol}>
              <Text style={styles.noteLabel}>{tx("หมายเหตุ · NOTES")}</Text>
              <Text style={styles.noteText}>
                {tx(
                  data.notes ||
                    (isPaid
                      ? "ได้รับชำระเงินเรียบร้อยแล้ว ขอบคุณที่อุดหนุนสินค้าชุมชน OTOP"
                      : "กรุณาชำระเงินภายในวันครบกำหนด หากชำระแล้วโปรดเก็บหลักฐานการโอนไว้"),
                )}
              </Text>
            </View>
            <View style={styles.signCol}>
              <View style={styles.signLine} />
              <Text style={styles.signLabel}>{tx(isPaid ? "ผู้รับเงิน · Received by" : "ผู้มีอำนาจลงนาม · Authorized")}</Text>
              <Text style={styles.signStore}>{tx(storeName)}</Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={[styles.thanks, { color: accent }]}>{tx("ขอบคุณที่ใช้บริการ")}</Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) => tx(`${data.invoiceNumber} · หน้า ${pageNumber}/${totalPages}`)}
          />
        </View>
      </Page>
    </Document>
  );
}

// ============================================
// PDF Generation Helper
// ============================================

/** A logo far past this is not a logo. */
const MAX_LOGO_BYTES = 5 * 1024 * 1024;

/** The two formats @react-pdf draws. */
export interface DrawableLogo {
  data: Buffer;
  type: "image/png" | "image/jpeg";
}

/**
 * The size another format is redrawn at: the header's 120 × 40 pt box, five
 * times over, so it stays sharp in print.
 */
const LOGO_PX = { width: 600, height: 200 };

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff]);

/** A store's logo, kept a few minutes: every confirmation email draws it. */
const LOGO_TTL_MS = 5 * 60 * 1000;
const logoCache = new Map<
  string,
  { expires: number; logo: Promise<DrawableLogo | undefined> }
>();

function fetchLogo(url?: string): Promise<DrawableLogo | undefined> {
  if (!url) return Promise.resolve(undefined);
  const cached = logoCache.get(url);
  if (cached && cached.expires > Date.now()) return cached.logo;
  const logo = readLogoBuffer(url).then((raw) =>
    raw ? drawableLogo(raw, url) : undefined,
  );
  logoCache.set(url, { expires: Date.now() + LOGO_TTL_MS, logo });
  return logo;
}

/**
 * A logo as @react-pdf can draw it. PNG and JPEG go in as they are; any other
 * format sharp reads (SVG, WebP, AVIF, GIF's first frame) is redrawn as a PNG
 * that fits LOGO_PX. An SVG is drawn at the density that fits it there, so a
 * small one is not blurred and a huge one not drawn at full size first.
 * Undefined when the bytes are not an image.
 */
export async function drawableLogo(
  raw: Buffer,
  url = "",
): Promise<DrawableLogo | undefined> {
  if (raw.subarray(0, 4).equals(PNG_SIGNATURE)) return { data: raw, type: "image/png" };
  if (raw.subarray(0, 3).equals(JPEG_SIGNATURE)) return { data: raw, type: "image/jpeg" };
  try {
    const { format, width, height } = await sharp(raw).metadata();
    const density =
      format === "svg" && width && height
        ? Math.min(2400, Math.max(1, 72 * Math.min(LOGO_PX.width / width, LOGO_PX.height / height)))
        : undefined;
    const data = await sharp(raw, density ? { density } : {})
      .resize({ ...LOGO_PX, fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();
    return { data, type: "image/png" };
  } catch (err) {
    console.warn(`[invoice-pdf] Logo could not be drawn: ${url}`, err);
    return undefined;
  }
}

async function readLogoBuffer(url: string): Promise<Buffer | undefined> {
  try {
    const absoluteUrl =
      url.startsWith("http://") || url.startsWith("https://")
        ? url
        : `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}${url.startsWith("/") ? "" : "/"}${url}`;

    // No redirect followed, a deadline and a size cap — the logo address is
    // a setting, and this runs on the server (lib/storage/fetch-stored-file.ts).
    const res = await fetchStoredFile(absoluteUrl, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      console.error(
        `[invoice-pdf] Logo fetch failed: ${res.status} for ${absoluteUrl}`
      );
      await res.body?.cancel().catch(() => undefined);
      return undefined;
    }

    return await readCappedBody(res, MAX_LOGO_BYTES);
  } catch (err) {
    console.error("[invoice-pdf] Logo fetch error:", err);
    return undefined;
  }
}

export async function generateInvoicePdf(data: InvoiceData): Promise<Buffer> {
  const logo = await fetchLogo(data.logoUrl);
  const logoDataUri = logo
    ? `data:${logo.type};base64,${logo.data.toString("base64")}`
    : undefined;

  return renderToBuffer(
    <InvoiceDocument data={data} logoDataUri={logoDataUri} />
  );
}
