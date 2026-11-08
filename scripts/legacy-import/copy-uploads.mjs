// Copies the legacy files the data references from the old site into MinIO.
// usage (in the app container): node --env-file=.env scripts/legacy-import/copy-uploads.mjs /tmp/legacy
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";

const dir = process.argv[2];
const list = JSON.parse(readFileSync(`${dir}/referenced-uploads.json`, "utf8"));
const mapPath = `${dir}/upload-map.json`;
const map = existsSync(mapPath) ? JSON.parse(readFileSync(mapPath, "utf8")) : {};
const OLD = "https://ohk-shop.com/public/";
const bucket = process.env.STORAGE_BUCKET;
const publicBase = process.env.STORAGE_PUBLIC_URL.replace(/\/+$/, "");
const s3 = new S3Client({
  region: process.env.STORAGE_REGION || "us-east-1",
  endpoint: process.env.STORAGE_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.STORAGE_ACCESS_KEY_ID,
    secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY,
  },
});
const MIME = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };
let done = 0, failed = [];

/** Nothing may hang the run: every network step gets a deadline. */
function withDeadline(promise, ms, label) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

async function copy(item) {
  if (map[item.id]) return;
  const name = item.file.split("/").pop();
  const key = `uploads/legacy/${name}`;
  try {
    await withDeadline(s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key })), 15000, "head");
    map[item.id] = `${publicBase}/${key}`;
    return;
  } catch {}
  // The old server takes a full minute to answer 404 for a file it no longer
  // has, so a short deadline and no retry on 404 keep the run moving.
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(OLD + item.file, { signal: AbortSignal.timeout(20000) });
      if (res.status === 404) {
        failed.push({ id: item.id, file: item.file, error: "404 not on the old server" });
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = Buffer.from(await withDeadline(res.arrayBuffer(), 90000, "download"));
      await withDeadline(s3.send(new PutObjectCommand({
        Bucket: bucket, Key: key, Body: body,
        ContentType: res.headers.get("content-type") || MIME[item.ext] || "application/octet-stream",
        CacheControl: "public, max-age=31536000, immutable",
      })), 60000, "upload");
      map[item.id] = `${publicBase}/${key}`;
      return;
    } catch (error) {
      if (attempt === 2) failed.push({ id: item.id, file: item.file, error: String(error.message || error) });
      else await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
}

const queue = [...list];
await Promise.all(Array.from({ length: 10 }, async () => {
  while (queue.length) {
    await copy(queue.shift());
    if (++done % 10 === 0) {
      writeFileSync(mapPath, JSON.stringify(map));
      console.log(`${done}/${list.length}`);
    }
  }
}));
writeFileSync(mapPath, JSON.stringify(map));
writeFileSync(`${dir}/upload-failed.json`, JSON.stringify(failed, null, 1));
console.log(`copied ${Object.keys(map).length}/${list.length}, failed ${failed.length}`);
