import "server-only";

import sharp from "sharp";
import { createAIAuthoringOpenAIClient } from "./openai";
import { aiSourceFile } from "./source-image";
import type { ResolvedAIImageConfig } from "./settings";

/**
 * One image from whichever provider Settings → AI picks for images: OpenAI's
 * Images API, or Gemini's image models through generateContent. Both return
 * the bytes in the format asked for, so storage and the callers never need to
 * know who drew it.
 */

export type ImageSize = "auto" | "1024x1024" | "1024x1536" | "1536x1024";
export type ImageFormat = "png" | "webp" | "jpeg";

export interface CreateImageInput {
  image: ResolvedAIImageConfig;
  prompt: string;
  size?: ImageSize;
  quality?: "auto" | "medium" | "high";
  format?: ImageFormat;
  /** OpenAI only; Gemini always paints an opaque background. */
  background?: "transparent" | "opaque" | "auto";
  /** Present for an edit: the picture to change. */
  source?: { buffer: Buffer; mimeType?: string };
}

const GEMINI_API = "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_TIMEOUT_MS = 120_000;

const ASPECT: Record<Exclude<ImageSize, "auto">, string> = {
  "1024x1024": "1:1",
  "1024x1536": "2:3",
  "1536x1024": "3:2",
};

type OpenAIImageResponse = { data?: Array<{ b64_json?: string }> };

async function openAIImage(input: CreateImageInput): Promise<Buffer> {
  const client = createAIAuthoringOpenAIClient(input.image.apiKey);
  const common = {
    model: input.image.model,
    prompt: input.prompt,
    size: input.size || "1024x1024",
    quality: input.quality || "high",
    output_format: input.format || "png",
    background: input.background || "auto",
  };
  const response = (input.source
    ? await client.images.edit({
        ...common,
        image: await aiSourceFile(input.source.buffer, "source"),
      } as never)
    : await client.images.generate(common as never)) as OpenAIImageResponse;
  const encoded = response.data?.find((item) => item.b64_json)?.b64_json;
  if (!encoded) throw new Error("The image provider returned no image");
  return Buffer.from(encoded, "base64");
}

type GeminiPart = { text?: string; inlineData?: { mimeType?: string; data?: string }; inline_data?: { mime_type?: string; data?: string } };
type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: GeminiPart[] }; finishReason?: string }>;
  promptFeedback?: { blockReason?: string };
  error?: { message?: string; status?: string };
};

async function geminiImage(input: CreateImageInput): Promise<Buffer> {
  const apiKey = input.image.apiKey?.trim();
  if (!apiKey) throw new Error("The Gemini API key is not configured");

  const parts: Array<Record<string, unknown>> = [{ text: input.prompt }];
  if (input.source) {
    // Gemini takes PNG/JPEG/WebP; normalise anything else (and strip EXIF).
    const png = await sharp(input.source.buffer).rotate().png().toBuffer();
    parts.push({ inlineData: { mimeType: "image/png", data: png.toString("base64") } });
  }
  const aspectRatio = input.size && input.size !== "auto" ? ASPECT[input.size] : undefined;

  const response = await fetch(
    `${GEMINI_API}/models/${encodeURIComponent(input.image.model)}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
          ...(aspectRatio ? { imageConfig: { aspectRatio } } : {}),
        },
      }),
      signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
      cache: "no-store",
    },
  );
  const body = (await response.json().catch(() => null)) as GeminiResponse | null;
  if (!response.ok) {
    throw new Error(body?.error?.message ? `Gemini: ${body.error.message}` : `Gemini answered ${response.status}`);
  }
  const image = body?.candidates
    ?.flatMap((candidate) => candidate.content?.parts ?? [])
    .map((part) => part.inlineData?.data ?? part.inline_data?.data)
    .find((data): data is string => Boolean(data));
  if (!image) {
    const reason = body?.promptFeedback?.blockReason || body?.candidates?.[0]?.finishReason;
    throw new Error(reason ? `Gemini returned no image (${reason})` : "Gemini returned no image");
  }
  return Buffer.from(image, "base64");
}

/** Re-encode to the requested format (Gemini answers PNG or JPEG as it likes). */
async function inFormat(buffer: Buffer, format: ImageFormat): Promise<Buffer> {
  const pipeline = sharp(buffer);
  if (format === "webp") return pipeline.webp({ quality: 92 }).toBuffer();
  if (format === "jpeg") return pipeline.jpeg({ quality: 92, mozjpeg: true }).toBuffer();
  return pipeline.png().toBuffer();
}

export async function createImage(input: CreateImageInput): Promise<Buffer> {
  if (input.image.provider === "gemini") {
    return inFormat(await geminiImage(input), input.format || "png");
  }
  return openAIImage(input);
}
