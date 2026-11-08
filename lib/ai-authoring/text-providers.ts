/**
 * The providers AI Studio can write text with. OpenAI is spoken to through its
 * Responses API (as it always was); Gemini, DeepSeek and GLM through their
 * OpenAI-compatible Chat Completions endpoints, so one SDK serves all four.
 *
 * Images and the AI Sales Agent pick their own provider (OpenAI or Gemini) in
 * Settings → AI; see image-providers.ts and lib/ai-sales-agent.
 *
 * Client-safe: the settings page reads the same list to draw its choices.
 */

export const AI_TEXT_PROVIDERS = ["openai", "gemini", "deepseek", "glm"] as const;
export type AITextProvider = (typeof AI_TEXT_PROVIDERS)[number];

/** The three that need a key of their own (OpenAI's is `aiAuthoring.apiKey`). */
export type AIExtraTextProvider = Exclude<AITextProvider, "openai">;
export const AI_EXTRA_TEXT_PROVIDERS: readonly AIExtraTextProvider[] = ["gemini", "deepseek", "glm"];

export const GLM_REGIONS = ["global", "china"] as const;
export type GlmRegion = (typeof GLM_REGIONS)[number];

export interface AITextProviderInfo {
  id: AITextProvider;
  name: string;
  /** Who runs it, for the card. */
  vendor: string;
  defaultModel: string;
  /** Offered in the model list; any other id the provider serves may be typed. */
  models: Array<{ id: string; note?: "fast" | "balanced" | "best" | "reasoning" | "free" }>;
  /** Some of its models read an image (alt text); otherwise alt text uses another provider. */
  supportsVision: boolean;
  /** When only some models read images, which ones. */
  visionModels?: readonly string[];
  /** Retired or deprecated IDs a store may have saved; they resolve to the default. */
  legacyModels: readonly string[];
  /** Where the key is made. */
  consoleUrl: string;
  keyPlaceholder: string;
  envKeys: readonly string[];
}

// Model IDs as each provider's own model list served them on 2026-11-09
// (OpenAI's models page; the Gemini and Z.ai `/models` endpoints; DeepSeek's
// pricing page). Retired IDs a store may still have saved are in
// `legacyModels` and resolve to the provider's default instead.
export const AI_TEXT_PROVIDER_INFO: Record<AITextProvider, AITextProviderInfo> = {
  openai: {
    id: "openai",
    name: "OpenAI",
    vendor: "ChatGPT",
    defaultModel: "gpt-6-luna",
    models: [
      { id: "gpt-6-luna", note: "fast" },
      { id: "gpt-6.1-terra", note: "balanced" },
      { id: "gpt-6.1-sol" },
      { id: "gpt-6-astra", note: "best" },
    ],
    legacyModels: ["gpt-4.1-mini", "gpt-4.1", "gpt-5-mini", "gpt-5", "gpt-5-nano"],
    supportsVision: true,
    consoleUrl: "https://platform.openai.com/api-keys",
    keyPlaceholder: "sk-...",
    envKeys: ["OPENAI_API_KEY"],
  },
  gemini: {
    id: "gemini",
    name: "Google Gemini",
    vendor: "Google AI Studio",
    defaultModel: "gemini-3.8-flash",
    models: [
      { id: "gemini-3.5-flash-lite", note: "fast" },
      { id: "gemini-3.8-flash", note: "balanced" },
      { id: "gemini-4-argon", note: "best" },
    ],
    // Deprecated: from 2026-12-01 Google reroutes them to newer models.
    legacyModels: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.5-flash-lite", "gemini-2.0-flash"],
    supportsVision: true,
    consoleUrl: "https://aistudio.google.com/app/apikey",
    keyPlaceholder: "AIza...",
    envKeys: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
  },
  deepseek: {
    id: "deepseek",
    name: "DeepSeek",
    vendor: "DeepSeek Platform",
    defaultModel: "deepseek-flash",
    models: [
      { id: "deepseek-flash", note: "balanced" },
      { id: "deepseek-v4-pro", note: "best" },
    ],
    // Discontinued 2026-07-24.
    legacyModels: ["deepseek-chat", "deepseek-reasoner"],
    supportsVision: true,
    // Only Flash reads images; V4 Pro is text-only.
    visionModels: ["deepseek-flash", "deepseek-v4-flash"],
    consoleUrl: "https://platform.deepseek.com/api_keys",
    keyPlaceholder: "sk-...",
    envKeys: ["DEEPSEEK_API_KEY"],
  },
  glm: {
    id: "glm",
    name: "GLM (Zhipu AI)",
    vendor: "Z.ai / BigModel",
    defaultModel: "glm-4.7",
    models: [
      { id: "glm-4.5-air", note: "fast" },
      { id: "glm-5-turbo", note: "fast" },
      { id: "glm-4.7", note: "balanced" },
      { id: "glm-5.3", note: "best" },
    ],
    legacyModels: [],
    supportsVision: false,
    consoleUrl: "https://z.ai/manage-apikey/apikey-list",
    keyPlaceholder: "xxxxxxxx.xxxxxxxx",
    envKeys: ["GLM_API_KEY", "ZHIPU_API_KEY", "ZAI_API_KEY"],
  },
};

/** The model a provider should be asked for: the saved one, unless retired. */
export function effectiveTextModel(provider: AITextProvider, saved: string | undefined): string {
  const info = AI_TEXT_PROVIDER_INFO[provider];
  const model = saved?.trim();
  if (!model || info.legacyModels.includes(model)) return info.defaultModel;
  return model;
}

/** Whether this provider reads images with this model (alt text). */
export function modelReadsImages(provider: AITextProvider, model: string): boolean {
  const info = AI_TEXT_PROVIDER_INFO[provider];
  if (!info.supportsVision) return false;
  return info.visionModels ? info.visionModels.includes(model) : true;
}

/** Each provider's OpenAI-compatible endpoint. */
export function textProviderBaseURL(provider: AITextProvider, glmRegion?: GlmRegion): string | undefined {
  switch (provider) {
    case "gemini":
      return "https://generativelanguage.googleapis.com/v1beta/openai/";
    case "deepseek":
      return "https://api.deepseek.com";
    case "glm":
      // Z.ai serves the world; BigModel serves mainland China. Same API.
      return glmRegion === "china" ? "https://open.bigmodel.cn/api/paas/v4/" : "https://api.z.ai/api/paas/v4/";
    default:
      return undefined;
  }
}

export function isAITextProvider(value: unknown): value is AITextProvider {
  return typeof value === "string" && (AI_TEXT_PROVIDERS as readonly string[]).includes(value);
}

/** A model id a provider could plausibly serve: letters, digits and . _ : / - only. */
export function isPlausibleModelId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,99}$/.test(value.trim());
}
