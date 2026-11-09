"use client";

/**
 * Sources: pictures and text stickers the store places over its camera, like
 * the sources of a desktop live studio. They are drawn into the stream, so
 * viewers see them; the store drags them about on its preview.
 *
 * Kept on the store's own device: the list in localStorage, the pictures in
 * IndexedDB (too big for localStorage). A device that refuses storage still
 * works — the sources last for the visit.
 *
 * Positions are fractions of the picture (x, y = the source's centre), so
 * they hold whatever quality the live is sent at.
 */

export const LIVE_SOURCE_LIMIT = 10;
export const LIVE_SOURCE_TEXT_MAX = 40;
/** Pictures are shrunk to this on the long side before they are kept. */
const IMAGE_MAX_SIDE = 1024;
const IMAGE_MAX_BYTES = 15 * 1024 * 1024;

export const LIVE_TEXT_STYLES = ["silk", "sale", "gold", "white", "outline"] as const;
export type LiveTextStyle = (typeof LIVE_TEXT_STYLES)[number];

interface SourceBase {
  id: string;
  name: string;
  /** Centre, as fractions of the picture's width and height. */
  x: number;
  y: number;
  /** 5–100: an image's width in % of the picture; a sticker's text size. */
  size: number;
  /** Degrees. */
  rotation: number;
  /** 10–100. */
  opacity: number;
  visible: boolean;
}

export interface LiveImageSource extends SourceBase {
  kind: "image";
  /** Key of the picture in IndexedDB. */
  imageKey: string;
  /** Width ÷ height. */
  aspect: number;
}

export interface LiveTextSource extends SourceBase {
  kind: "text";
  text: string;
  style: LiveTextStyle;
}

export type LiveSource = LiveImageSource | LiveTextSource;

/** Ready-made stickers a store sells with. */
export const LIVE_TEXT_PRESETS: Array<{ key: string; style: LiveTextStyle }> = [
  { key: "freeShipping", style: "silk" },
  { key: "otop", style: "gold" },
  { key: "flashSale", style: "sale" },
  { key: "new", style: "white" },
  { key: "limited", style: "sale" },
  { key: "handmade", style: "gold" },
];

export function newSourceId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** Coerce whatever storage held into a valid source, or drop it. */
function cleanSource(raw: unknown): LiveSource | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  const base = {
    id: typeof s.id === "string" ? s.id.slice(0, 40) : newSourceId(),
    name: typeof s.name === "string" ? s.name.slice(0, 60) : "",
    x: clamp(Number(s.x) || 0.5, 0, 1),
    y: clamp(Number(s.y) || 0.5, 0, 1),
    size: clamp(Number(s.size) || 30, 5, 100),
    rotation: clamp(Number(s.rotation) || 0, -180, 180),
    opacity: clamp(Number(s.opacity) || 100, 10, 100),
    visible: s.visible !== false,
  };
  if (s.kind === "image" && typeof s.imageKey === "string") {
    return { ...base, kind: "image", imageKey: s.imageKey, aspect: clamp(Number(s.aspect) || 1, 0.05, 20) };
  }
  if (s.kind === "text" && typeof s.text === "string") {
    const style = LIVE_TEXT_STYLES.includes(s.style as LiveTextStyle) ? (s.style as LiveTextStyle) : "silk";
    return { ...base, kind: "text", text: s.text.slice(0, LIVE_SOURCE_TEXT_MAX), style };
  }
  return null;
}

const LIST_KEY = "ohk-live-sources";

export function loadSourceList(): LiveSource[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(LIST_KEY) || "[]");
    return Array.isArray(raw)
      ? raw.map(cleanSource).filter((s): s is LiveSource => Boolean(s)).slice(0, LIVE_SOURCE_LIMIT)
      : [];
  } catch {
    return [];
  }
}

export function saveSourceList(list: LiveSource[]) {
  try {
    window.localStorage.setItem(LIST_KEY, JSON.stringify(list));
  } catch {
    // Storage full or blocked: the list lasts for this visit.
  }
}

/* ------------------------------------------------------------------ */
/* Pictures (IndexedDB)                                                */
/* ------------------------------------------------------------------ */

const DB_NAME = "ohk-live-studio";
const STORE = "images";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("no indexeddb"));
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = run(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

/** Pictures held in memory when the device won't store them. */
const memoryImages = new Map<string, Blob>();

export async function loadSourceImage(key: string): Promise<Blob | null> {
  if (memoryImages.has(key)) return memoryImages.get(key) ?? null;
  try {
    const blob = await withStore<Blob | undefined>("readonly", (store) => store.get(key) as IDBRequest<Blob | undefined>);
    return blob ?? null;
  } catch {
    return null;
  }
}

export async function deleteSourceImage(key: string) {
  memoryImages.delete(key);
  try {
    await withStore("readwrite", (store) => store.delete(key));
  } catch {
    // Nothing kept to remove.
  }
}

export class SourceImageError extends Error {
  constructor(readonly reason: "type" | "size" | "decode") {
    super(reason);
  }
}

/**
 * A picture the store picked: shrunk, kept, and returned ready to draw.
 * PNG keeps transparency (logos, stickers); photos go as WebP.
 */
export async function addSourceImage(file: File): Promise<{ key: string; bitmap: ImageBitmap; aspect: number }> {
  if (!/^image\/(png|jpe?g|webp|gif|avif)$/i.test(file.type)) throw new SourceImageError("type");
  if (file.size > IMAGE_MAX_BYTES) throw new SourceImageError("size");
  let source: ImageBitmap;
  try {
    source = await createImageBitmap(file);
  } catch {
    throw new SourceImageError("decode");
  }
  const k = Math.min(1, IMAGE_MAX_SIDE / Math.max(source.width, source.height));
  const w = Math.max(1, Math.round(source.width * k));
  const h = Math.max(1, Math.round(source.height * k));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")?.drawImage(source, 0, 0, w, h);
  source.close();
  const type = file.type === "image/jpeg" ? "image/webp" : "image/png";
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new SourceImageError("decode"))), type, 0.9),
  );
  const key = newSourceId();
  try {
    await withStore("readwrite", (store) => store.put(blob, key));
  } catch {
    memoryImages.set(key, blob);
  }
  return { key, bitmap: await createImageBitmap(blob), aspect: w / h };
}

/* ------------------------------------------------------------------ */
/* Drawing                                                             */
/* ------------------------------------------------------------------ */

/** The logical picture every source is laid out on (scaled to the real size). */
export const STAGE_W = 720;
export const STAGE_H = 1280;

export function textFontPx(size: number) {
  return Math.round(14 + size * 1.1);
}

function textFont(size: number, fontFamily: string) {
  return `800 ${textFontPx(size)}px ${fontFamily}`;
}

let measureCtx: CanvasRenderingContext2D | null = null;

/** A source's box on the stage, in stage pixels (before rotation). */
export function sourceBox(source: LiveSource, fontFamily: string): { w: number; h: number } {
  if (source.kind === "image") {
    const w = (source.size / 100) * STAGE_W;
    return { w, h: w / source.aspect };
  }
  measureCtx ??= document.createElement("canvas").getContext("2d");
  const px = textFontPx(source.size);
  let textW = px * source.text.length * 0.6;
  if (measureCtx) {
    measureCtx.font = textFont(source.size, fontFamily);
    textW = measureCtx.measureText(source.text || " ").width;
  }
  const padX = source.style === "outline" ? px * 0.2 : px * 0.7;
  const padY = source.style === "outline" ? px * 0.15 : px * 0.38;
  return { w: textW + padX * 2, h: px + padY * 2 };
}

const TEXT_STYLE: Record<
  LiveTextStyle,
  { fill?: [string, string]; border?: string; text: string; stroke?: string }
> = {
  silk: { fill: ["#8a2c1d", "#c0662b"], border: "#d9a441", text: "#ffffff" },
  sale: { fill: ["#dc2626", "#b91c1c"], border: "#fde68a", text: "#fde68a" },
  gold: { fill: ["#f3d58a", "#d9a441"], border: "#8a2c1d", text: "#5a1a10" },
  white: { fill: ["#ffffff", "#f5f5f4"], border: "rgba(0,0,0,0.08)", text: "#1c1917" },
  outline: { text: "#ffffff", stroke: "rgba(0,0,0,0.85)" },
};

export function drawTextSource(ctx: CanvasRenderingContext2D, source: LiveTextSource, fontFamily: string) {
  const { w, h } = sourceBox(source, fontFamily);
  const style = TEXT_STYLE[source.style];
  ctx.font = textFont(source.size, fontFamily);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (style.fill) {
    const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
    g.addColorStop(0, style.fill[0]);
    g.addColorStop(1, style.fill[1]);
    ctx.shadowBlur = 14;
    ctx.shadowColor = "rgba(0,0,0,0.3)";
    ctx.fillStyle = g;
    pill(ctx, -w / 2, -h / 2, w, h);
    ctx.fill();
    ctx.shadowBlur = 0;
    if (style.border) {
      ctx.lineWidth = Math.max(2, h * 0.05);
      ctx.strokeStyle = style.border;
      ctx.stroke();
    }
  }
  if (style.stroke) {
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(3, textFontPx(source.size) * 0.16);
    ctx.strokeStyle = style.stroke;
    ctx.strokeText(source.text, 0, 2);
  }
  ctx.fillStyle = style.text;
  ctx.fillText(source.text, 0, 2);
}

function pill(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const r = Math.min(h / 2, w / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Draw every visible source, first in the list at the back. */
export function drawSources(
  ctx: CanvasRenderingContext2D,
  sources: readonly LiveSource[],
  bitmaps: ReadonlyMap<string, ImageBitmap>,
  fontFamily: string,
) {
  for (const source of sources) {
    if (!source.visible) continue;
    ctx.save();
    ctx.globalAlpha = clamp(source.opacity, 10, 100) / 100;
    ctx.translate(source.x * STAGE_W, source.y * STAGE_H);
    if (source.rotation) ctx.rotate((source.rotation * Math.PI) / 180);
    if (source.kind === "image") {
      const bitmap = bitmaps.get(source.imageKey);
      if (bitmap) {
        const { w, h } = sourceBox(source, fontFamily);
        ctx.drawImage(bitmap, -w / 2, -h / 2, w, h);
      }
    } else if (source.text.trim()) {
      drawTextSource(ctx, source, fontFamily);
    }
    ctx.restore();
  }
}
