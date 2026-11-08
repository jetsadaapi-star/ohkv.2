import {
  AtSign,
  Copyright,
  CreditCard,
  Image as ImageIcon,
  Link2,
  Share2,
  Type,
  type LucideIcon,
} from "lucide-react";
import type { FooterItemKind } from "@/lib/site-config/footer-layout";
import type { TSafe } from "@/components/admin/online-store/t-safe";
import { translateFooterDefault } from "@/lib/site-config/footer-config";

/**
 * The palette, as DATA. One array drives the drawer chip, the canvas chip
 * and the drag overlay, so a kind cannot gain an icon in one place and keep
 * the old one in another — the header's own arrangement, for the same
 * reason.
 */
export interface FooterItemMeta {
  type: FooterItemKind;
  /** English fallback; the studio looks up a translation over this. */
  label: string;
  icon: LucideIcon;
}

export const FOOTER_ITEM_META: FooterItemMeta[] = [
  { type: "brand", label: "Logo", icon: ImageIcon },
  { type: "text", label: "Text", icon: Type },
  { type: "links", label: "Link column", icon: Link2 },
  { type: "contact", label: "Contact", icon: AtSign },
  { type: "social", label: "Social", icon: Share2 },
  { type: "payments", label: "Payment marks", icon: CreditCard },
  { type: "copyright", label: "Copyright", icon: Copyright },
];

/** Falls back to the first entry rather than throwing, as the header's does. */
export function footerItemMeta(type: FooterItemKind): FooterItemMeta {
  return FOOTER_ITEM_META.find((meta) => meta.type === type) ?? FOOTER_ITEM_META[0];
}

/** A one-line description of an item, for the canvas chip's subtitle. */
export function footerItemSummary(
  item: { type: FooterItemKind } & Record<string, unknown>,
  tSafe?: TSafe,
): string {
  const k = "admin.hc.layoutStyle";
  const tr = (key: string, fallback: string, values?: Record<string, string | number>) =>
    tSafe ? tSafe(`${k}.${key}`, fallback, values) : fallback.replace(/\{(\w+)\}/g, (m, name: string) => (values && name in values ? String(values[name]) : m));
  // Saved text that is still a shipped default reads in the admin's language.
  const shipped = (text: string) => {
    if (!tSafe) return text;
    const translate = tSafe;
    return translateFooterDefault(text, (key) => translate(`storeText.footerConfig.${key}`, text));
  };
  switch (item.type) {
    case "text":
      return typeof item.text === "string" && item.text.trim()
        ? item.text.trim().slice(0, 40)
        : tr("storeDescription", "Store description");
    case "links": {
      const title = typeof item.title === "string" ? shipped(item.title.trim()) : "";
      const menu = typeof item.menu === "string" ? item.menu.trim() : "";
      const count = Array.isArray(item.links) ? item.links.length : 0;
      if (menu) return tr("fromMenu", "{title} · from menu", { title: title || tr("menu", "Menu") });
      return tSafe
        ? tSafe(`${k}.linksCount`, `${title || "Untitled"} · ${count} link${count === 1 ? "" : "s"}`, { title: title || tr("untitled", "Untitled"), count })
        : `${title || "Untitled"} · ${count} link${count === 1 ? "" : "s"}`;
    }
    case "contact":
      return typeof item.title === "string" && item.title.trim()
        ? shipped(item.title.trim())
        : tr("contactSummary", "Phone, email, address");
    case "copyright":
      return typeof item.text === "string" && item.text.trim()
        ? shipped(item.text.trim()).slice(0, 40)
        : tr("copyrightSummary", "Year and store name");
    case "payments":
      return typeof item.imageUrl === "string" && item.imageUrl.trim()
        ? tr("artworkSet", "Artwork set")
        : tr("noArtwork", "No artwork yet");
    case "brand":
      return tr("storeLogo", "Store logo");
    case "social":
      return tr("socialSummary", "Icons from Branding");
  }
  return "";
}
