/**
 * The providers AI Studio can write text with. OpenAI is spoken to through its
 * Responses API (as it always was); Gemini, DeepSeek and GLM through their
 * OpenAI-compatible Chat Completions endpoints, so one SDK serves all four.
 *
 * Images stay with OpenAI (gpt-image): none of the three has an image API of
 * the same shape, so the OpenAI key remains what image generation and the AI
 * Sales Agent use, whichever provider writes the text.
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
  /** Reads an image (alt text). Without it, alt text falls back to OpenAI. */
  supportsVision: boolean;
  /** Where the key is made. */
  consoleUrl: string;
  keyPlaceholder: string;
  envKeys: readonly string[];
}

export const AI_TEXT_PROVIDER_INFO: Record<AITextProvider, AITextProviderInfo> = {
  openai: {
    id: "openai",
    name: "OpenAI",
    vendor: "ChatGPT",
    defaultModel: "gpt-4.1-mini",
    models: [
      { id: "gpt-4.1-mini", note: "fast" },
      { id: "gpt-4.1", note: "balanced" },
      { id: "gpt-5-mini" },
      { id: "gpt-5", note: "best" },
    ],
    supportsVision: true,
    consoleUrl: "https://platform.openai.com/api-keys",
    keyPlaceholder: "sk-...",
    envKeys: ["OPENAI_API_KEY"],
  },
  gemini: {
    id: "gemini",
    name: "Google Gemini",
    vendor: "Google AI Studio",
    defaultModel: "gemini-2.5-flash",
    models: [
      { id: "gemini-2.5-flash-lite", note: "fast" },
      { id: "gemini-2.5-flash", note: "balanced" },
      { id: "gemini-2.5-pro", note: "best" },
    ],
    supportsVision: true,
    consoleUrl: "https://aistudio.google.com/app/apikey",
    keyPlaceholder: "AIza...",
    envKeys: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
  },
  deepseek: {
    id: "deepseek",
    name: "DeepSeek",
    vendor: "DeepSeek Platform",
    defaultModel: "deepseek-chat",
    models: [
      { id: "deepseek-chat", note: "balanced" },
      { id: "deepseek-reasoner", note: "reasoning" },
    ],
    supportsVision: false,
    consoleUrl: "https://platform.deepseek.com/api_keys",
    keyPlaceholder: "sk-...",
    envKeys: ["DEEPSEEK_API_KEY"],
  },
  glm: {
    id: "glm",
    name: "GLM (Zhipu AI)",
    vendor: "Z.ai / BigModel",
    defaultModel: "glm-4.5-air",
    models: [
      { id: "glm-4.5-flash", note: "free" },
      { id: "glm-4.5-air", note: "balanced" },
      { id: "glm-4.6", note: "best" },
      { id: "glm-4.5v" },
    ],
    supportsVision: false,
    consoleUrl: "https://z.ai/manage-apikey/apikey-list",
    keyPlaceholder: "xxxxxxxx.xxxxxxxx",
    envKeys: ["GLM_API_KEY", "ZHIPU_API_KEY", "ZAI_API_KEY"],
  },
};

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
