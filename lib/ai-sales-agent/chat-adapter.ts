import type OpenAI from "openai";

/**
 * Runs one Responses-API-shaped turn of the sales agent on a Chat Completions
 * provider (Gemini's OpenAI-compatible endpoint), so the engine's tool loop,
 * cards and token accounting stay exactly as they are for OpenAI.
 *
 * In:  { model, instructions, input: Responses items, tools, reasoning?, temperature? }
 * Out: { output_text, output: [message?, ...function_call], usage }
 *
 * Gemini attaches a "thought signature" to each tool call (extra_content); it
 * must travel back with the call on the next turn, so it is kept on the item.
 */

type ResponsesTool = {
  type: "function";
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
};

type InputItem = Record<string, unknown>;

export type ChatTurnResult = {
  output_text: string;
  output: Array<Record<string, unknown>>;
  usage: { input_tokens: number; output_tokens: number; total_tokens: number };
};

type ChatMessage = Record<string, unknown>;

function textOf(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string" ? (part as { text: string }).text : ""))
      .join("");
  }
  return "";
}

/** Responses input items as chat messages, tool calls grouped per assistant turn. */
export function toChatMessages(instructions: string, input: InputItem[]): ChatMessage[] {
  const messages: ChatMessage[] = [{ role: "system", content: instructions }];
  for (const item of input) {
    if (item.type === "function_call") {
      const call = {
        id: String(item.call_id),
        type: "function",
        function: { name: String(item.name), arguments: typeof item.arguments === "string" ? item.arguments : "{}" },
        ...(item.extra_content ? { extra_content: item.extra_content } : {}),
      };
      const last = messages[messages.length - 1];
      if (last?.role === "assistant" && Array.isArray(last.tool_calls)) {
        (last.tool_calls as unknown[]).push(call);
      } else if (last?.role === "assistant" && !last.tool_calls) {
        last.tool_calls = [call];
      } else {
        messages.push({ role: "assistant", content: null, tool_calls: [call] });
      }
      continue;
    }
    if (item.type === "function_call_output") {
      messages.push({ role: "tool", tool_call_id: String(item.call_id), content: String(item.output ?? "") });
      continue;
    }
    if (item.type === "message" || typeof item.role === "string") {
      const role = item.role === "developer" ? "system" : item.role === "assistant" ? "assistant" : item.role === "system" ? "system" : "user";
      const content = textOf(item.content);
      if (content || role !== "assistant") messages.push({ role, content });
    }
  }
  return messages;
}

function toChatTools(tools: ResponsesTool[]) {
  return tools.map((tool) => ({
    type: "function" as const,
    function: { name: tool.name, description: tool.description, parameters: tool.parameters },
  }));
}

type ToolCallDraft = { id?: string; name: string; arguments: string; extra_content?: unknown };

export async function createChatTurn(
  client: OpenAI,
  params: {
    model: string;
    instructions: string;
    input: InputItem[];
    tools: ResponsesTool[];
    reasoning?: { effort?: string };
    temperature?: number;
  },
  onDelta?: (text: string) => void,
): Promise<ChatTurnResult> {
  const request: Record<string, unknown> = {
    model: params.model,
    messages: toChatMessages(params.instructions, params.input),
    tools: toChatTools(params.tools),
    tool_choice: "auto",
  };
  if (params.reasoning?.effort) request.reasoning_effort = params.reasoning.effort;
  else if (typeof params.temperature === "number") request.temperature = params.temperature;

  let content = "";
  const calls: ToolCallDraft[] = [];
  let usage = { prompt_tokens: 0, completion_tokens: 0 };

  if (onDelta) {
    const stream = (await client.chat.completions.create({
      ...request,
      stream: true,
      stream_options: { include_usage: true },
    } as never)) as unknown as AsyncIterable<{
      choices?: Array<{ delta?: { content?: string | null; tool_calls?: Array<{ index?: number; id?: string; function?: { name?: string; arguments?: string }; extra_content?: unknown }> } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number } | null;
    }>;
    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta;
      if (delta?.content) {
        content += delta.content;
        onDelta(delta.content);
      }
      for (const part of delta?.tool_calls ?? []) {
        const index = part.index ?? calls.length;
        const draft = (calls[index] ??= { name: "", arguments: "" });
        if (part.id) draft.id = part.id;
        if (part.function?.name) draft.name += part.function.name;
        if (part.function?.arguments) draft.arguments += part.function.arguments;
        if (part.extra_content) draft.extra_content = part.extra_content;
      }
      if (chunk.usage) {
        usage = { prompt_tokens: chunk.usage.prompt_tokens ?? 0, completion_tokens: chunk.usage.completion_tokens ?? 0 };
      }
    }
  } else {
    const completion = (await client.chat.completions.create(request as never)) as unknown as {
      choices?: Array<{ message?: { content?: string | null; tool_calls?: Array<{ id?: string; function?: { name?: string; arguments?: string }; extra_content?: unknown }> } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const message = completion.choices?.[0]?.message;
    content = message?.content ?? "";
    for (const call of message?.tool_calls ?? []) {
      calls.push({
        id: call.id,
        name: call.function?.name ?? "",
        arguments: call.function?.arguments ?? "{}",
        extra_content: call.extra_content,
      });
    }
    usage = { prompt_tokens: completion.usage?.prompt_tokens ?? 0, completion_tokens: completion.usage?.completion_tokens ?? 0 };
  }

  const stamp = Date.now().toString(36);
  const output: Array<Record<string, unknown>> = [];
  if (content.trim()) {
    output.push({ type: "message", role: "assistant", content: [{ type: "output_text", text: content }] });
  }
  calls
    .filter((call) => call && call.name)
    .forEach((call, index) => {
      output.push({
        type: "function_call",
        name: call.name,
        arguments: call.arguments || "{}",
        call_id: call.id || `call_${stamp}_${index}`,
        ...(call.extra_content ? { extra_content: call.extra_content } : {}),
      });
    });

  return {
    output_text: content.trim(),
    output,
    usage: {
      input_tokens: usage.prompt_tokens,
      output_tokens: usage.completion_tokens,
      total_tokens: usage.prompt_tokens + usage.completion_tokens,
    },
  };
}
