/**
 * POST /api/admin/settings/test-ai
 * Verify an AI provider's API key works: OpenAI, or one of AI Studio's other
 * text providers (Gemini, DeepSeek, GLM). Tests the key from the request body
 * when provided (the unsaved form value); otherwise the stored/env-resolved
 * key. Listing the provider's models costs nothing. Never echoes any key back.
 */

import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getSettings } from "@/models/settings.model";
import {
  resolveAITextProviderKey,
  resolveOpenAICredentials,
} from "@/lib/settings/credentials";
import {
  AI_TEXT_PROVIDERS,
  AI_TEXT_PROVIDER_INFO,
  GLM_REGIONS,
  textProviderBaseURL,
} from "@/lib/ai-authoring/text-providers";
import * as z from "zod";
import { withApi } from "@/lib/api/handler";

const TestAiSchema = z.object({
  apiKey: z.string().max(500).optional(),
  provider: z.enum(AI_TEXT_PROVIDERS).optional(),
  glmRegion: z.enum(GLM_REGIONS).optional(),
});

export const POST = withApi(
  {
    auth: "admin",
    demo: "block-mutations",
    // Every test reaches an outside service (or sends real mail), so it is
    // throttled like test-carrier rather than left to the admin's patience.
    rateLimit: { action: "admin:settings:test-ai", preset: "strict" },
  },
  async ({ request }) => {
    let body: z.infer<typeof TestAiSchema> = {};
    try {
      body = TestAiSchema.parse(await request.json());
    } catch {
      // Empty body is fine — test OpenAI's stored key.
    }
    const provider = body.provider ?? "openai";
    const info = AI_TEXT_PROVIDER_INFO[provider];

    try {
      let apiKey = body.apiKey?.trim() || "";
      if (!apiKey) {
        const settings = await getSettings();
        apiKey =
          (provider === "openai"
            ? resolveOpenAICredentials(settings.aiAuthoring).apiKey
            : resolveAITextProviderKey(settings.aiAuthoring, provider)) || "";
      }
      if (!apiKey) {
        return NextResponse.json(
          {
            success: false,
            message: `No API key to test. Enter a key or set ${info.envKeys[0]} in the environment.`,
          },
          { status: 400 },
        );
      }

      const client = new OpenAI({
        apiKey,
        baseURL: textProviderBaseURL(provider, body.glmRegion),
        timeout: 15000,
        maxRetries: 0,
      });
      await client.models.list();

      return NextResponse.json({
        success: true,
        message: `Connection successful. The ${info.name} key is valid.`,
      });
    } catch (error) {
      const code =
        typeof error === "object" && error !== null
          ? (error as { status?: number }).status
          : undefined;
      // Gemini answers a bad key 400 INVALID_ARGUMENT; the rest 401.
      const rejected =
        code === 401 || code === 403 || (provider === "gemini" && code === 400);
      const message = rejected
        ? `${info.name} rejected the key. Check that it is correct and active${
            provider === "glm" ? ", and that the region matches the account" : ""
          }.`
        : `Could not reach ${info.name}. Check the key and your network, then try again.`;
      return NextResponse.json({ success: false, message }, { status: rejected ? 400 : 502 });
    }
  },
);
