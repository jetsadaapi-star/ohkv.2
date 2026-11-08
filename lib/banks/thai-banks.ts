import banksJson from "../../public/banks/banks.json";

/**
 * Thai banks and e-wallets (public/banks/banks.json + public/banks/icons/*):
 * short and long Thai names, English name, brand colour and logo.
 */
export interface ThaiBank {
  symbol: string;
  name: string;
  nameLong: string;
  nameEN: string;
  color: string;
  icon: string;
}

/** E-wallet "banks" whose account number is a phone or ID number. */
const WALLETS = new Set(["PromptPay", "TrueMoney"]);

/** The common banks first, the rest after, then the wallets. */
const ORDER = ["KBANK", "SCB", "BBL", "KTB", "BAY", "TTB", "GSB", "BAAC", "GHB", "UOB", "CIMB", "KKP", "TISCO", "LHB", "TCRB", "IBANK", "ICBC", "CITI", "HSBC", "PromptPay", "TrueMoney"];

export const THAI_BANKS: ThaiBank[] = Object.values(banksJson as Record<string, ThaiBank>).sort(
  (a, b) => (ORDER.indexOf(a.symbol) + 1 || 99) - (ORDER.indexOf(b.symbol) + 1 || 99),
);

export function isWallet(bank?: ThaiBank | null) {
  return Boolean(bank && WALLETS.has(bank.symbol));
}

const norm = (value: string) => value.toLowerCase().replace(/\s+/g, "").replace(/^ธนาคาร|^ธ\./, "").replace(/bank$|ธนาคาร/g, "");

/**
 * The bank a saved free-text `bankName` names — the long Thai name the
 * editor writes, or anything a person typed before: "กสิกร", "KBank",
 * "Kasikorn", "ธ.กรุงเทพ"…
 */
export function findThaiBank(value?: string | null): ThaiBank | null {
  if (!value?.trim()) return null;
  const v = norm(value);
  const exact = THAI_BANKS.find(
    (b) => [b.symbol, b.name, b.nameLong, b.nameEN].some((x) => norm(x) === v),
  );
  if (exact) return exact;
  const ALIASES: Record<string, string[]> = {
    KBANK: ["kasikorn", "กสิกร"],
    SCB: ["siamcommercial", "ไทยพาณิช"],
    BBL: ["bangkokbank", "bualuang", "บัวหลวง"],
    KTB: ["krungthai", "กรุงไทย"],
    BAY: ["krungsri", "กรุงศรี", "ayudhya"],
    TTB: ["tmb", "thanachart", "ทหารไทย", "ธนชาต", "ttb"],
    GSB: ["government savings", "ออมสิน"],
    BAAC: ["ธกส", "baac"],
    GHB: ["ธอส", "อาคารสงเคราะห์"],
    PromptPay: ["promptpay", "พร้อมเพย์"],
    TrueMoney: ["truemoney", "ทรูมันนี่", "truewallet"],
  };
  for (const bank of THAI_BANKS) {
    const keys = [bank.name, bank.nameEN, ...(ALIASES[bank.symbol] ?? [])].map(norm).filter((k) => k.length >= 3);
    if (keys.some((k) => v.includes(k) || k.includes(v))) return bank;
  }
  return null;
}

/** "123-4-56789-0" for a 10-digit account; phone / ID shapes for wallets. */
export function formatAccountNumber(raw: string, bank?: ThaiBank | null) {
  const d = raw.replace(/\D/g, "");
  if (!d) return raw;
  if (isWallet(bank)) {
    if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
    if (d.length === 13) return `${d.slice(0, 1)}-${d.slice(1, 5)}-${d.slice(5, 10)}-${d.slice(10, 12)}-${d.slice(12)}`;
    return d;
  }
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 4)}-${d.slice(4, 9)}-${d.slice(9)}`;
  if (d.length === 12) return `${d.slice(0, 4)}-${d.slice(4, 8)}-${d.slice(8)}`;
  return d.replace(/(\d{4})(?=\d)/g, "$1-");
}

/** A darker shade of a hex colour, for the card gradient. */
export function shade(hex: string, amount = -0.35) {
  const n = hex.replace("#", "");
  const full = n.length === 3 ? n.split("").map((c) => c + c).join("") : n;
  const num = parseInt(full, 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c + (amount < 0 ? c * amount : (255 - c) * amount))));
  const r = f((num >> 16) & 255), g = f((num >> 8) & 255), b = f(num & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/** Whether white text reads on this colour (yellow Krungsri gets dark text). */
export function isLight(hex: string) {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 170;
}
