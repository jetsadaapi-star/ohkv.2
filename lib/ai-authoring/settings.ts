import type { IAIAuthoringSettings } from "@/models/settings.model";
import {
  resolveAITextProviderKey,
  resolveOpenAICredentials,
} from "@/lib/settings/credentials";
import {
  AI_EXTRA_TEXT_PROVIDERS,
  AI_TEXT_PROVIDER_INFO,
  effectiveTextModel,
  isAITextProvider,
  isPlausibleModelId,
  modelReadsImages,
  textProviderBaseURL,
  type AITextProvider,
} from "@/lib/ai-authoring/text-providers";
import {
  AI_IMAGE_MODELS,
  effectiveImageModel,
  isAIImageProvider,
  type AIImageProvider,
} from "@/lib/ai-authoring/image-providers";

const AI_AUTHORING_TEXT_MODEL_IDS = AI_TEXT_PROVIDER_INFO.openai.models.map((model) => model.id);
const AI_AUTHORING_IMAGE_MODEL_IDS = AI_IMAGE_MODELS.openai.models.map((model) => model.id);
const GEMINI_IMAGE_MODEL_IDS = AI_IMAGE_MODELS.gemini.models.map((model) => model.id);

const DEFAULT_AI_AUTHORING_TEXT_MODEL = AI_TEXT_PROVIDER_INFO.openai.defaultModel;
const DEFAULT_AI_AUTHORING_IMAGE_MODEL = AI_IMAGE_MODELS.openai.defaultModel;

export const DEFAULT_AI_AUTHORING_SETTINGS: IAIAuthoringSettings = {
  enabled: true,
  textModel: "",
  imageModel: "",
  surfaces: {
    products: true,
    categories: true,
    collections: true,
    brands: true,
    blogPosts: true,
    contentPages: true,
    reviews: true,
    heroBanner: true,
  },
  imageDefaults: { size: "auto", quality: "high" },
  brandVoice: { tone: "", instructions: "", imageStyle: "" },
  brandKit: { primaryColor: "", secondaryColor: "", logoUrl: "" },
  access: { staffEnabled: true, vendorsEnabled: true },
  limits: { textPerUserPerDay: 0, imagePerUserPerDay: 0 },
};

function toPlain(value: unknown): Partial<IAIAuthoringSettings> {
  if (!value || typeof value !== "object") return {};
  const maybeDoc = value as { toObject?: () => unknown };
  if (typeof maybeDoc.toObject === "function") {
    const obj = maybeDoc.toObject();
    return obj && typeof obj === "object"
      ? (obj as Partial<IAIAuthoringSettings>)
      : {};
  }
  return value as Partial<IAIAuthoringSettings>;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function cappedCount(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.min(Math.round(parsed), 100000);
}

/** Normalize a stored color to a lowercase #rrggbb hex, or "" if invalid. */
function normalizeHexColor(value: unknown): string {
  if (typeof value !== "string") return "";
  const hex = value.trim().replace(/^#/, "");
  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((c) => c + c)
          .join("")
      : hex;
  return /^[0-9a-fA-F]{6}$/.test(full) ? `#${full.toLowerCase()}` : "";
}

/**
 * Fill gaps and drop unknown enum values so the rest of the code can rely on
 * a complete, well-typed settings object regardless of what the DB holds.
 * Mirrors the aiSalesAgent settings normalizer.
 */
export function normalizeAIAuthoringSettings(
  raw: unknown,
): IAIAuthoringSettings {
  const value = toPlain(raw);
  const defaults = DEFAULT_AI_AUTHORING_SETTINGS;

  const textModel = (AI_AUTHORING_TEXT_MODEL_IDS as readonly string[]).includes(
    value.textModel as string,
  )
    ? (value.textModel as string)
    : "";
  const imageModel = (
    AI_AUTHORING_IMAGE_MODEL_IDS as readonly string[]
  ).includes(value.imageModel as string)
    ? (value.imageModel as string)
    : "";

  const surfaces: Partial<IAIAuthoringSettings["surfaces"]> =
    value.surfaces || {};
  const imageDefaults: Partial<IAIAuthoringSettings["imageDefaults"]> =
    value.imageDefaults || {};
  const brandVoice: Partial<IAIAuthoringSettings["brandVoice"]> =
    value.brandVoice || {};
  const brandKit: Partial<IAIAuthoringSettings["brandKit"]> =
    value.brandKit || {};
  const access: Partial<IAIAuthoringSettings["access"]> = value.access || {};
  const limits: Partial<IAIAuthoringSettings["limits"]> = value.limits || {};

  const rawKeys = (value.providerKeys || {}) as Record<string, unknown>;
  const rawModels = (value.providerModels || {}) as Record<string, unknown>;
  const providerKeys: NonNullable<IAIAuthoringSettings["providerKeys"]> = {};
  const providerModels: NonNullable<IAIAuthoringSettings["providerModels"]> = {};
  for (const id of AI_EXTRA_TEXT_PROVIDERS) {
    const key = rawKeys[id];
    if (typeof key === "string" && key.trim()) providerKeys[id] = key;
    const model = rawModels[id];
    providerModels[id] = isPlausibleModelId(model) ? (model as string).trim() : "";
  }

  return {
    enabled: bool(value.enabled, defaults.enabled),
    ...(typeof value.apiKey === "string" && value.apiKey.trim()
      ? { apiKey: value.apiKey }
      : {}),
    textProvider: isAITextProvider(value.textProvider) ? value.textProvider : "openai",
    providerKeys,
    providerModels,
    glmRegion: value.glmRegion === "china" ? "china" : "global",
    imageProvider: isAIImageProvider(value.imageProvider) ? value.imageProvider : "openai",
    geminiImageModel: GEMINI_IMAGE_MODEL_IDS.includes(value.geminiImageModel as string)
      ? (value.geminiImageModel as string)
      : "",
    salesAgentProvider: value.salesAgentProvider === "gemini" ? "gemini" : "openai",
    textModel,
    imageModel,
    surfaces: {
      products: bool(surfaces.products, true),
      categories: bool(surfaces.categories, true),
      collections: bool(surfaces.collections, true),
      brands: bool(surfaces.brands, true),
      blogPosts: bool(surfaces.blogPosts, true),
      contentPages: bool(surfaces.contentPages, true),
      reviews: bool(surfaces.reviews, true),
      heroBanner: bool(surfaces.heroBanner, true),
    },
    imageDefaults: {
      size: ["auto", "1024x1024", "1024x1536", "1536x1024"].includes(
        imageDefaults.size as string,
      )
        ? (imageDefaults.size as IAIAuthoringSettings["imageDefaults"]["size"])
        : defaults.imageDefaults.size,
      quality: ["auto", "medium", "high"].includes(
        imageDefaults.quality as string,
      )
        ? (imageDefaults.quality as IAIAuthoringSettings["imageDefaults"]["quality"])
        : defaults.imageDefaults.quality,
    },
    brandVoice: {
      tone: ["friendly", "professional", "luxury", "playful", "supportive"].includes(
        brandVoice.tone as string,
      )
        ? (brandVoice.tone as string)
        : "",
      instructions:
        typeof brandVoice.instructions === "string"
          ? brandVoice.instructions.slice(0, 2000)
          : "",
      imageStyle:
        typeof brandVoice.imageStyle === "string"
          ? brandVoice.imageStyle.slice(0, 1000)
          : "",
    },
    brandKit: {
      primaryColor: normalizeHexColor(brandKit.primaryColor),
      secondaryColor: normalizeHexColor(brandKit.secondaryColor),
      logoUrl:
        typeof brandKit.logoUrl === "string"
          ? brandKit.logoUrl.slice(0, 2048)
          : "",
    },
    access: {
      staffEnabled: bool(access.staffEnabled, true),
      vendorsEnabled: bool(access.vendorsEnabled, true),
    },
    limits: {
      textPerUserPerDay: cappedCount(limits.textPerUserPerDay, 0),
      imagePerUserPerDay: cappedCount(limits.imagePerUserPerDay, 0),
    },
  };
}

/** The configured brand palette as a compact, gap-free hex list. */
export function brandColorsOf(settings: IAIAuthoringSettings): string[] {
  return [
    settings.brandKit.primaryColor,
    settings.brandKit.secondaryColor,
  ].filter(Boolean);
}

/** Who writes the text, and how to reach them. */
export type ResolvedAITextConfig = {
  provider: AITextProvider;
  apiKey?: string;
  /** Unset for OpenAI (the SDK's own); the provider's OpenAI-compatible endpoint otherwise. */
  baseURL?: string;
  model: string;
  /** Whether the provider reads images (alt text); otherwise OpenAI is used for it. */
  supportsVision: boolean;
};

/** Who draws images, and how to reach them. */
export type ResolvedAIImageConfig = {
  provider: AIImageProvider;
  apiKey?: string;
  model: string;
};

export type ResolvedAIAuthoringConfig = {
  settings: IAIAuthoringSettings;
  /** Resolved via credentials: DB value wins, OPENAI_API_KEY env fallback. */
  apiKey?: string;
  textModel: string;
  imageModel: string;
  /** The text provider in effect (OpenAI unless another is picked). */
  text: ResolvedAITextConfig;
  /** The image provider in effect (images, edits, hero banners). */
  image: ResolvedAIImageConfig;
  /**
   * A provider that can read an image, for alt text: the text provider when
   * its model can, else Gemini, else OpenAI — whichever has a key. Absent
   * when none can.
   */
  vision?: ResolvedAITextConfig;
};

/**
 * Resolve the effective runtime config from a stored settings block: the
 * shared OpenAI key and models with their env fallbacks
 * (OPENAI_AUTHORING_TEXT_MODEL / OPENAI_AUTHORING_IMAGE_MODEL) applied.
 */
export function resolveAIAuthoringConfig(
  raw: unknown,
): ResolvedAIAuthoringConfig {
  const settings = normalizeAIAuthoringSettings(raw);
  const apiKey = resolveOpenAICredentials(settings).apiKey;
  const textModel =
    settings.textModel ||
    process.env.OPENAI_AUTHORING_TEXT_MODEL?.trim() ||
    DEFAULT_AI_AUTHORING_TEXT_MODEL;
  const imageModel = effectiveImageModel(
    "openai",
    settings.imageModel || process.env.OPENAI_AUTHORING_IMAGE_MODEL?.trim() || DEFAULT_AI_AUTHORING_IMAGE_MODEL,
  );
  const geminiKey = resolveAITextProviderKey(settings, "gemini");

  const chatConfig = (provider: Exclude<AITextProvider, "openai">, model: string): ResolvedAITextConfig => ({
    provider,
    apiKey: resolveAITextProviderKey(settings, provider),
    baseURL: textProviderBaseURL(provider, settings.glmRegion),
    model,
    supportsVision: modelReadsImages(provider, model),
  });
  const provider = settings.textProvider ?? "openai";
  const text: ResolvedAITextConfig =
    provider === "openai"
      ? { provider, apiKey, model: textModel, supportsVision: true }
      : chatConfig(provider, effectiveTextModel(provider, settings.providerModels?.[provider]));

  const imageProvider = settings.imageProvider ?? "openai";
  const image: ResolvedAIImageConfig =
    imageProvider === "gemini"
      ? { provider: "gemini", apiKey: geminiKey, model: effectiveImageModel("gemini", settings.geminiImageModel) }
      : { provider: "openai", apiKey, model: imageModel };

  const vision: ResolvedAITextConfig | undefined =
    text.apiKey && text.supportsVision
      ? text
      : geminiKey
        ? chatConfig("gemini", effectiveTextModel("gemini", settings.providerModels?.gemini))
        : apiKey
          ? { provider: "openai", apiKey, model: textModel, supportsVision: true }
          : undefined;

  return {
    settings,
    apiKey,
    text,
    image,
    vision,
    textModel,
    imageModel: image.model,
  };
}
