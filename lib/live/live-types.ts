/**
 * Live selling — the shapes the dashboards and the storefront share.
 * Client-safe: no server imports.
 */

export const LIVE_STATUSES = ["scheduled", "live", "ended"] as const;
export type LiveStatus = (typeof LIVE_STATUSES)[number];

export const LIVE_LIMITS = {
  title: 120,
  description: 1000,
  products: 30,
  chatText: 200,
  /** Highest live-only discount a store may set, in percent. */
  maxDiscount: 90,
  /** Messages a poll returns at most. */
  chatPage: 50,
  /** Hearts one request may add (the client batches taps). */
  likeBatch: 30,
} as const;

/** How often the storefront and the studio ask for the room's state (ms). */
export const LIVE_POLL_MS = 2000;

/** A product in a live as the store's dashboard sees it. */
export interface LiveProductSummary {
  id: string;
  name: string;
  slug: string;
  image?: string;
  /** The product's regular price (before the live discount). */
  price: number;
  /** Live-only discount, percent; 0 for none. */
  discountPercent: number;
  status?: string;
}

export interface LiveDashboardItem {
  id: string;
  vendorId: string;
  vendorName: string;
  vendorDistrict?: string;
  title: string;
  description: string;
  coverUrl: string;
  status: LiveStatus;
  scheduledAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  products: LiveProductSummary[];
  pinnedProductId: string | null;
  likeCount: number;
  giftCount: number;
  peakViewers: number;
  totalViews: number;
  endedReason: string;
  updatedAt: string;
}

/** Only the store's own studio is given these. */
export interface LiveStudioCredentials {
  streamKey: string;
  /** WHIP endpoint the studio publishes the camera to. */
  whipUrl: string;
  /** For OBS: server and stream key fields. */
  rtmpServer: string;
  rtmpStreamKey: string;
}

/** A product as the shopper sees it in the live. */
export interface LiveShopProduct {
  id: string;
  name: string;
  slug: string;
  image?: string;
  /** What it sells for right now (the live price while the live is on). */
  price: number;
  /** The price before the live discount, when there is one. */
  comparePrice?: number;
  discountPercent: number;
  quickAdd: boolean;
  variantId?: string;
  variantName?: string;
  available: boolean;
}

export interface LiveStoreInfo {
  name: string;
  slug: string;
  logo?: string;
  district?: string;
  hasPage: boolean;
}

/** A live in the storefront's lists. */
export interface LiveCard {
  id: string;
  title: string;
  coverUrl: string;
  status: LiveStatus;
  scheduledAt: string | null;
  startedAt: string | null;
  viewers: number;
  /** Everyone who has watched it. */
  totalViews: number;
  likeCount: number;
  productCount: number;
  productImages: string[];
  store: LiveStoreInfo;
}

export interface LiveChatItem {
  id: string;
  kind: "chat" | "system" | "gift";
  name: string;
  text: string;
  host: boolean;
  at: string;
  /** For a gift line: which gift and how many. */
  gift?: { id: string; count: number };
}

/** A viewer who sent the most gifts in this live. */
export interface LiveSupporter {
  name: string;
  count: number;
}

/** What a viewer's poll returns. */
export interface LiveRoomState {
  id: string;
  status: LiveStatus;
  /** The media server has the store's camera right now. */
  onAir: boolean;
  viewers: number;
  likeCount: number;
  /** Gifts sent in this live, all kinds together. */
  giftCount: number;
  /** Who sent the most, best first. */
  supporters: LiveSupporter[];
  pinnedProductId: string | null;
  messages: LiveChatItem[];
  /** Changes whenever the products or their prices change. */
  productsVersion: string;
  products?: LiveShopProduct[];
}

export interface LiveRoom extends LiveCard {
  description: string;
  /** WHEP endpoint the viewer plays from. */
  whepUrl: string;
  products: LiveShopProduct[];
  pinnedProductId: string | null;
}
