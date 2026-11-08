/**
 * Product review clips ("คลิปรีวิวสินค้า"): shared constants and wire shapes.
 * Client-safe — no server imports.
 */

export const SHORT_CLIP_STATUSES = ["draft", "published", "hidden"] as const;
export type ShortClipStatus = (typeof SHORT_CLIP_STATUSES)[number];

export const SHORT_CLIP_LIMITS = {
  title: 120,
  caption: 2200,
  products: 10,
  /** The storefront feed's page. */
  feedPage: 6,
  comment: 300,
  commentsPage: 20,
} as const;

/** What a shopper can do to a clip besides watching it. */
export interface ClipEngagement {
  likeCount: number;
  commentCount: number;
  saveCount: number;
  shareCount: number;
}

/** The signed-in shopper's own marks on a clip. */
export interface ClipViewerState {
  liked: boolean;
  saved: boolean;
}

export interface ClipComment {
  id: string;
  name: string;
  text: string;
  /** Written by the store that made the clip. */
  creator: boolean;
  /** The reader wrote it (and may delete it). */
  mine: boolean;
  at: string;
}

/** A pinned product as the dashboard editor lists it. */
export interface ClipProductSummary {
  id: string;
  name: string;
  slug: string;
  image?: string;
  price: number;
  status?: string;
}

/** A clip as the dashboards (store and admin) list and edit it. */
export interface ClipDashboardItem {
  id: string;
  vendorId: string;
  vendorName: string;
  vendorDistrict?: string;
  title: string;
  caption: string;
  videoUrl: string;
  videoMimeType: string;
  posterUrl: string;
  products: ClipProductSummary[];
  status: ShortClipStatus;
  hiddenReason: string;
  viewCount: number;
  publishedAt: string | null;
  updatedAt: string;
}

/** A pinned product as the shopper's feed shows it. */
export interface ClipFeedProduct {
  id: string;
  name: string;
  slug: string;
  image?: string;
  price: number;
  comparePrice?: number;
  /** Add straight to the cart: no option to choose, sold at a price, in stock. */
  quickAdd: boolean;
  /** The one variant to add, when the product has exactly one. */
  variantId?: string;
  variantName?: string;
  available: boolean;
}

/** A clip as the storefront feed plays it. */
export interface ClipFeedItem extends ClipEngagement {
  id: string;
  title: string;
  caption: string;
  videoUrl: string;
  videoMimeType: string;
  posterUrl: string;
  viewCount: number;
  publishedAt: string | null;
  store: {
    name: string;
    slug: string;
    logo?: string;
    district?: string;
    /** The marketplace's own store has no store page. */
    hasPage: boolean;
  };
  products: ClipFeedProduct[];
}
