import OpenAI from "openai";

type OpenAIMessageContent = {
  text?: string;
};

type OpenAIMessageItem = {
  type?: string;
  content?: OpenAIMessageContent[];
};

type OpenAIResponseLike = {
  output_text?: string;
  output?: OpenAIMessageItem[];
};

/**
 * Build the OpenAI client from a resolved key (Settings → AI, DB wins with
 * OPENAI_API_KEY env fallback). Callers that already ran the authoring gate
 * pass the runtime's key; the env-only default keeps older paths working.
 */
export function createAIAuthoringOpenAIClient(resolvedApiKey?: string): OpenAI {
  const apiKey = resolvedApiKey?.trim() || process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OpenAI API key is not configured");
  return new OpenAI({ apiKey });
}

/**
 * A client for whichever provider writes AI Studio's text. Gemini, DeepSeek
 * and GLM speak the OpenAI Chat Completions protocol at their own base URL.
 */
export function createAITextClient(text: { apiKey?: string; baseURL?: string }): OpenAI {
  const apiKey = text.apiKey?.trim();
  if (!apiKey) throw new Error("The AI text provider's API key is not configured");
  // One provider call may not hold a request open for minutes.
  return new OpenAI({ apiKey, baseURL: text.baseURL, timeout: 120_000, maxRetries: 1 });
}

/**
 * The JSON object inside a chat reply: as sent, or wrapped in a code fence or
 * a sentence, which models without a strict JSON mode sometimes do.
 */
export function extractJsonText(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const body = fenced ? fenced[1] : trimmed;
  if (body.startsWith("{")) return body;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  return start >= 0 && end > start ? body.slice(start, end + 1) : body;
}

export function extractOutputText(response: unknown): string {
  const candidate = response as OpenAIResponseLike;
  if (typeof candidate?.output_text === "string" && candidate.output_text.trim()) {
    return candidate.output_text.trim();
  }

  const chunks: string[] = [];
  for (const item of candidate?.output || []) {
    if (item?.type !== "message") continue;
    for (const content of item.content || []) {
      if (typeof content?.text === "string") chunks.push(content.text);
    }
  }

  return chunks.join("\n").trim();
}
