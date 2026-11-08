import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import sharp from "sharp";
import { renderBarcodeSvg } from "@/lib/barcode/render";
import { formatCurrency } from "@/lib/intl/money";
import {
  PDF_FONT,
  isThailand as isDomestic,
  localityLine as thaiLocality,
  printablePhone,
  tx,
} from "@/lib/pdf/thai-pdf";

interface ShippingLabelAddress {
  name: string;
  street: string;
  apartment?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
}

interface ShippingLabelData {
  orderNumber: string;
  carrier: string;
  service?: string;
  trackingNumber: string;
  from: ShippingLabelAddress;
  to: ShippingLabelAddress;
  items: Array<{ name: string; sku?: string; quantity: number }>;
  parcel?: {
    weight?: number;
    weightUnit?: string;
  };
  internalLabel?: boolean;
  /**
   * Cash the courier collects at the door — `cashOnDeliveryDue` in
   * lib/shipping/carriers/build-request.ts, the figure a carrier booking sends.
   * Absent on a prepaid parcel.
   */
  cashOnDelivery?: { amount: number; currency: string };
}

// Thai text: font, word wrapping and SARA AM — see lib/pdf/thai-pdf.ts.

function txAddress(address: ShippingLabelAddress): ShippingLabelAddress {
  return {
    name: tx(address.name),
    street: tx(address.street),
    apartment: tx(address.apartment),
    city: tx(address.city),
    state: tx(address.state),
    postalCode: address.postalCode,
    country: tx(address.country),
    phone: address.phone,
  };
}

// ============================================
// Text helpers
// ============================================

const CARRIER_TH: Record<string, string> = {
  "internal fulfillment": "จัดส่งโดยร้านค้า",
};
const SERVICE_TH: Record<string, string> = {
  standard: "ส่งธรรมดา",
  express: "ส่งด่วน",
  economy: "ประหยัด",
  "same day": "ส่งภายในวัน",
  "next day": "ส่งวันถัดไป",
  pickup: "รับที่ร้าน",
};




function codAmount(amount: number, currency: string) {
  if (currency.toUpperCase() === "THB") {
    return `฿${new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)}`;
  }
  return formatCurrency(amount, currency, "en-US", { currencyDisplay: "code" });
}

// ============================================
// Styles — 4 × 6 in (288 × 432 pt), black on white for thermal printers
// ============================================

const INK = "#000";
const MUTED = "#444";

const styles = StyleSheet.create({
  page: {
    width: 288,
    height: 432,
    padding: 10,
    fontFamily: PDF_FONT,
    fontSize: 9,
    color: INK,
    backgroundColor: "#fff",
  },
  // Fixed height, so a long order trims its item list instead of pushing the
  // footer off the 4 × 6 sheet.
  frame: { height: 412, borderWidth: 1.5, borderColor: INK, borderRadius: 6, overflow: "hidden" },

  // Header band
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: INK,
    paddingVertical: 6,
    paddingHorizontal: 9,
  },
  carrier: { fontSize: 13, fontWeight: 800, color: "#fff", lineHeight: 1.15 },
  service: { fontSize: 8, fontWeight: 500, color: "#fff", opacity: 0.85 },
  orderBox: { alignItems: "flex-end" },
  orderLabel: { fontSize: 6.5, fontWeight: 600, color: "#fff", opacity: 0.8, letterSpacing: 0.4 },
  orderNumber: { fontSize: 11, fontWeight: 800, color: "#fff", letterSpacing: 0.4 },

  // COD
  cod: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginHorizontal: 8,
    marginTop: 6,
    paddingVertical: 3,
    paddingHorizontal: 9,
    borderWidth: 2,
    borderColor: INK,
    borderRadius: 5,
  },
  codTitle: { fontSize: 12, fontWeight: 800, lineHeight: 1.1 },
  codSub: { fontSize: 6.5, fontWeight: 600, letterSpacing: 0.4, color: MUTED },
  codAmount: { fontSize: 17, fontWeight: 800 },

  // Receiver
  to: { paddingHorizontal: 9, paddingTop: 5, paddingBottom: 5 },
  sectionHead: { flexDirection: "row", alignItems: "center", marginBottom: 2 },
  pill: {
    backgroundColor: INK,
    color: "#fff",
    fontSize: 7.5,
    fontWeight: 700,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  pillOutline: {
    borderWidth: 1,
    borderColor: INK,
    fontSize: 7,
    fontWeight: 700,
    paddingHorizontal: 4,
    paddingVertical: 0.5,
    borderRadius: 3,
  },
  pillEn: { fontSize: 6.5, fontWeight: 600, color: MUTED, marginLeft: 4, letterSpacing: 0.4 },
  toName: { fontSize: 14, fontWeight: 800, lineHeight: 1.2 },
  toLine: { fontSize: 10, lineHeight: 1.25 },
  toBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 2 },
  phone: { fontSize: 11, fontWeight: 700 },
  zipBox: { borderWidth: 1.5, borderColor: INK, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1, alignItems: "center" },
  zipLabel: { fontSize: 5.5, fontWeight: 700, color: MUTED, letterSpacing: 0.4 },
  zip: { fontSize: 17, fontWeight: 800, letterSpacing: 2.5, lineHeight: 1.05 },

  divider: { borderTopWidth: 1, borderTopColor: INK, borderStyle: "dashed", marginHorizontal: 8 },

  // Sender
  from: { paddingHorizontal: 9, paddingVertical: 4 },
  fromTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  fromName: { fontSize: 9, fontWeight: 700, lineHeight: 1.2, maxWidth: 170 },
  fromPhone: { fontSize: 8, fontWeight: 600 },
  fromLine: { fontSize: 7.5, lineHeight: 1.25, color: MUTED },

  // Barcode
  tracking: {
    alignItems: "center",
    paddingTop: 4,
    paddingBottom: 3,
    borderTopWidth: 1.5,
    borderTopColor: INK,
    borderBottomWidth: 1.5,
    borderBottomColor: INK,
  },
  barcode: { width: 230, height: 42, objectFit: "contain" },
  trackingText: { fontSize: 10.5, fontWeight: 700, letterSpacing: 2 },

  // Contents
  contents: { paddingHorizontal: 9, paddingTop: 4, flexGrow: 1, flexShrink: 1, overflow: "hidden" },
  contentHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 0.75,
    borderBottomColor: INK,
    paddingBottom: 1.5,
    marginBottom: 2,
  },
  contentTitle: { fontSize: 7.5, fontWeight: 700 },
  // Fixed width: Sarabun's shaped "ำ" is wider than the measure, which clipped
  // the last letter of a right-aligned heading.
  contentQtyTitle: { width: 36, textAlign: "right", fontSize: 7.5, fontWeight: 700 },
  itemRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 1 },
  itemName: { width: "82%", fontSize: 7.5, lineHeight: 1.25 },
  itemSku: { color: MUTED },
  itemQty: { width: "16%", textAlign: "right", fontSize: 8, fontWeight: 700 },
  more: { fontSize: 7, color: MUTED, marginTop: 1 },

  // Footer
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: INK,
    paddingHorizontal: 9,
    paddingVertical: 3.5,
  },
  footNote: { fontSize: 6.5, fontWeight: 600, color: MUTED, maxWidth: 190 },
  weight: { fontSize: 8, fontWeight: 700 },
});

function SectionHead({ th, en, outline }: { th: string; en: string; outline?: boolean }) {
  return (
    <View style={styles.sectionHead}>
      <Text style={outline ? styles.pillOutline : styles.pill}>{th}</Text>
      <Text style={styles.pillEn}>{en}</Text>
    </View>
  );
}

function ShippingLabelDocument({
  data,
  barcodeDataUrl,
}: {
  data: ShippingLabelData;
  barcodeDataUrl: string;
}) {
  const carrier = tx(CARRIER_TH[data.carrier.trim().toLowerCase()] ?? data.carrier);
  const service = tx(data.service ? SERVICE_TH[data.service.trim().toLowerCase()] ?? data.service : "");
  const to = txAddress(data.to);
  const from = txAddress(data.from);
  const items = data.items.map((item) => ({ ...item, name: tx(item.name) }));
  const toPhone = printablePhone(to.phone);
  const fromPhone = printablePhone(from.phone);
  const printedAt = new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  }).format(new Date());
  const maxItems = data.cashOnDelivery ? 3 : 5;

  return (
    <Document title={`ใบปะหน้า ${data.orderNumber}`}>
      <Page size={[288, 432]} style={styles.page}>
        <View style={styles.frame}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ maxWidth: 160 }}>
              <Text style={styles.carrier}>{carrier}</Text>
              {service ? <Text style={styles.service}>{service}</Text> : null}
            </View>
            <View style={styles.orderBox}>
              <Text style={styles.orderLabel}>{tx("เลขคำสั่งซื้อ · ORDER")}</Text>
              <Text style={styles.orderNumber}>{data.orderNumber}</Text>
            </View>
          </View>

          {/* Cash on delivery — the one thing the courier must not miss */}
          {data.cashOnDelivery ? (
            <View style={styles.cod}>
              <View>
                <Text style={styles.codTitle}>เก็บเงินปลายทาง</Text>
                <Text style={styles.codSub}>CASH ON DELIVERY · COLLECT</Text>
              </View>
              <Text style={styles.codAmount}>
                {codAmount(data.cashOnDelivery.amount, data.cashOnDelivery.currency)}
              </Text>
            </View>
          ) : null}

          {/* Receiver */}
          <View style={styles.to}>
            <SectionHead th="ผู้รับ" en="SHIP TO" />
            <Text style={styles.toName}>{to.name}</Text>
            <Text style={styles.toLine}>
              {[to.street, to.apartment].filter(Boolean).join(" ")}
            </Text>
            <Text style={styles.toLine}>{thaiLocality(to.city, to.state)}</Text>
            {!isDomestic(to.country) ? <Text style={styles.toLine}>{to.country}</Text> : null}
            <View style={styles.toBottom}>
              <Text style={styles.phone}>{toPhone ? `โทร\u00A0${toPhone}` : " "}</Text>
              {to.postalCode ? (
                <View style={styles.zipBox}>
                  <Text style={styles.zipLabel}>รหัสไปรษณีย์</Text>
                  <Text style={styles.zip}>{to.postalCode}</Text>
                </View>
              ) : null}
            </View>
          </View>

          <View style={styles.divider} />

          {/* Sender */}
          <View style={styles.from}>
            <SectionHead th="ผู้ส่ง" en="FROM" outline />
            <View style={styles.fromTop}>
              <Text style={styles.fromName}>{from.name}</Text>
              {fromPhone ? <Text style={styles.fromPhone}>{`โทร\u00A0${fromPhone}`}</Text> : null}
            </View>
            <Text style={styles.fromLine}>
              {[from.street, from.apartment, thaiLocality(from.city, from.state), from.postalCode]
                .filter(Boolean)
                .join(" ")}
              {!isDomestic(from.country) ? ` ${from.country}` : ""}
            </Text>
          </View>

          {/* Barcode */}
          <View style={styles.tracking}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer's Image has no alt prop */}
            <Image src={barcodeDataUrl} style={styles.barcode} />
            <Text style={styles.trackingText}>{data.trackingNumber}</Text>
          </View>

          {/* Contents */}
          <View style={styles.contents}>
            <View style={styles.contentHead}>
              <Text style={styles.contentTitle}>รายการสินค้า · CONTENTS</Text>
              <Text style={styles.contentQtyTitle}>{tx("จำนวน")}</Text>
            </View>
            {items.slice(0, maxItems).map((item, index) => (
              <View key={`${item.sku || item.name}-${index}`} style={styles.itemRow}>
                <Text style={styles.itemName}>
                  {item.name}
                  {item.sku ? <Text style={styles.itemSku}>{`  ${item.sku}`}</Text> : null}
                </Text>
                <Text style={styles.itemQty}>×{item.quantity}</Text>
              </View>
            ))}
            {items.length > maxItems ? (
              <Text style={styles.more}>{tx(`และอีก ${items.length - maxItems} รายการ`)}</Text>
            ) : null}
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footNote}>
              {data.internalLabel
                ? tx(`ใบปะหน้าจากร้านค้า ไม่ใช่ใบนำส่งของขนส่ง · พิมพ์ ${printedAt}`)
                : `พิมพ์ ${printedAt}`}
            </Text>
            <Text style={styles.weight}>
              {data.parcel?.weight ? `${data.parcel.weight} ${data.parcel.weightUnit || "kg"}` : ""}
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

export async function generateShippingLabelPdf(data: ShippingLabelData) {
  const barcodeSvg = renderBarcodeSvg(data.trackingNumber, {
    format: "code128",
    heightMm: 18,
    includeText: false,
    scale: 3,
    paddingMm: 2,
  });
  const barcodePng = await sharp(Buffer.from(barcodeSvg)).png().toBuffer();
  const barcodeDataUrl = `data:image/png;base64,${barcodePng.toString("base64")}`;
  return renderToBuffer(
    <ShippingLabelDocument data={data} barcodeDataUrl={barcodeDataUrl} />,
  );
}
