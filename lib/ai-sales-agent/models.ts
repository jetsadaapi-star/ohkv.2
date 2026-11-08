/**
 * A model the AI Sales Agent can run on. Which ones are offered depends on
 * Settings → AI → "AI Sales Agent" provider; IDs as each provider's model
 * list served them on 2026-11-09.
 */
export type AISalesAgentModel = string;

export type AISalesAgentProvider = "openai" | "gemini";
export type AISalesAgentReasoningEffort =
  | "minimal"
  | "low"
  | "medium"
  | "high";

export type AISalesAgentTone =
  | "friendly"
  | "professional"
  | "playful"
  | "luxury";

export const AI_SALES_AGENT_MODELS: ReadonlyArray<{
  id: AISalesAgentModel;
  label: string;
  provider: AISalesAgentProvider;
  reasoning: boolean;
}> = [
  { id: "gpt-6-luna", label: "GPT-6 Luna — fast, low cost", provider: "openai", reasoning: true },
  { id: "gpt-6.1-terra", label: "GPT-6.1 Terra — balanced", provider: "openai", reasoning: true },
  { id: "gpt-6.1-sol", label: "GPT-6.1 Sol", provider: "openai", reasoning: true },
  { id: "gpt-6-astra", label: "GPT-6 Astra — best", provider: "openai", reasoning: true },
  { id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite — fast, low cost", provider: "gemini", reasoning: true },
  { id: "gemini-3.8-flash", label: "Gemini 3.8 Flash — balanced", provider: "gemini", reasoning: true },
  { id: "gemini-4-argon", label: "Gemini 4 Argon — best", provider: "gemini", reasoning: true },
];

/** Retired models a store may have saved; they run as the provider default. */
export const LEGACY_AI_SALES_AGENT_MODELS = ["gpt-5", "gpt-5-mini", "gpt-5-nano", "gpt-4.1-mini"] as const;

export const AI_SALES_AGENT_MODEL_IDS = [
  ...AI_SALES_AGENT_MODELS.map((model) => model.id),
  ...LEGACY_AI_SALES_AGENT_MODELS,
] as ReadonlyArray<AISalesAgentModel>;

export const DEFAULT_AI_SALES_AGENT_MODELS: Record<AISalesAgentProvider, AISalesAgentModel> = {
  openai: "gpt-6-luna",
  gemini: "gemini-3.8-flash",
};

export function salesAgentModelsFor(provider: AISalesAgentProvider) {
  return AI_SALES_AGENT_MODELS.filter((model) => model.provider === provider);
}

/** The model to run: the saved one when it belongs to the provider, else its default. */
export function effectiveSalesAgentModel(provider: AISalesAgentProvider, saved: string | undefined): AISalesAgentModel {
  return AI_SALES_AGENT_MODELS.some((model) => model.id === saved && model.provider === provider)
    ? (saved as AISalesAgentModel)
    : DEFAULT_AI_SALES_AGENT_MODELS[provider];
}

export const AI_SALES_AGENT_REASONING_EFFORTS: ReadonlyArray<AISalesAgentReasoningEffort> =
  ["minimal", "low", "medium", "high"];

export const AI_SALES_AGENT_TONES: ReadonlyArray<AISalesAgentTone> = [
  "friendly",
  "professional",
  "playful",
  "luxury",
];

export const DEFAULT_AI_SALES_AGENT_MODEL: AISalesAgentModel = DEFAULT_AI_SALES_AGENT_MODELS.openai;

export function isReasoningModel(model: string): boolean {
  return AI_SALES_AGENT_MODELS.some(
    (entry) => entry.id === model && entry.reasoning,
  );
}
