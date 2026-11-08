import { fetchSourceImage } from "@/lib/ai-authoring/media";
import { createImage } from "@/lib/ai-authoring/image-generation";
import type { ResolvedAIImageConfig } from "@/lib/ai-authoring/settings";

import { buildHeroBannerVisualPrompt } from "./prompt";
import type { HeroBannerBrief, HeroBannerRequest } from "./types";

export async function generateHeroBannerVisual(
  request: HeroBannerRequest,
  brief: HeroBannerBrief,
  runtime: { apiKey?: string; imageModel?: string; image?: ResolvedAIImageConfig } = {},
): Promise<Buffer> {
  const image: ResolvedAIImageConfig = runtime.image ?? {
    provider: "openai",
    apiKey: runtime.apiKey,
    model: runtime.imageModel || process.env.OPENAI_AUTHORING_IMAGE_MODEL || "gpt-image-2.6-flare",
  };
  const source =
    request.operation === "edit" ? { buffer: (await fetchSourceImage(request.sourceUrl!)).buffer } : undefined;
  return createImage({
    image,
    prompt: buildHeroBannerVisualPrompt(request, brief),
    size: "1536x1024",
    quality: "high",
    format: "png",
    background: "opaque",
    source,
  });
}
