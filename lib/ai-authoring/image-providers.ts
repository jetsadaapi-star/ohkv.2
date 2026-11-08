/**
 * Who draws AI Studio's images and hero banners: OpenAI (gpt-image, through
 * the Images API) or Google Gemini (the "Nano Banana" image models, through
 * generateContent). Client-safe: the settings page reads the same lists.
 *
 * IDs as each provider's own model list served them on 2026-11-09.
 */

export const AI_IMAGE_PROVIDERS = ["openai", "gemini"] as const;
export type AIImageProvider = (typeof AI_IMAGE_PROVIDERS)[number];

export interface AIImageModelOption {
  id: string;
  note?: "fast" | "balanced" | "best";
}

export const AI_IMAGE_MODELS: Record<AIImageProvider, { defaultModel: string; models: AIImageModelOption[]; legacyModels: readonly string[] }> = {
  openai: {
    defaultModel: "gpt-image-2.6-flare",
    models: [
      { id: "gpt-image-2.6-flare", note: "fast" },
      { id: "gpt-image-2.6-sunburst", note: "best" },
    ],
    // gpt-image-1 shut down 2026-10-23; the rest shut down 2026-12-01.
    legacyModels: ["gpt-image-1", "gpt-image-1-mini", "gpt-image-1.5", "chatgpt-image-latest"],
  },
  gemini: {
    defaultModel: "gemini-nano-banana-2.1",
    models: [
      { id: "gemini-3.1-flash-lite-image", note: "fast" },
      { id: "gemini-nano-banana-2.1", note: "balanced" },
      { id: "gemini-3.1-flash-image" },
      { id: "gemini-3-pro-image", note: "best" },
    ],
    legacyModels: ["gemini-2.5-flash-image", "imagen-4.0-generate"],
  },
};

export function isAIImageProvider(value: unknown): value is AIImageProvider {
  return typeof value === "string" && (AI_IMAGE_PROVIDERS as readonly string[]).includes(value);
}

/** The saved model when it is one of the provider's current ones, else its default. */
export function effectiveImageModel(provider: AIImageProvider, saved: string | undefined): string {
  const entry = AI_IMAGE_MODELS[provider];
  return saved && entry.models.some((model) => model.id === saved) ? saved : entry.defaultModel;
}
