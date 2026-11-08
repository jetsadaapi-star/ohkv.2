"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Bot,
  CheckCircle2,
  ExternalLink,
  Gauge,
  ImageIcon,
  LayoutGrid,
  Loader2,
  Megaphone,
  MessagesSquare,
  Palette,
  Plug,
  Power,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { ColorSwatchPicker } from "@/components/admin/color-swatch-picker";
import { NumberInput } from "@/components/ui/number-input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Settings } from "@/components/admin/settings/types";
import { SecretInput } from "@/components/admin/settings/fields/secret-input";
import { credentialMeta } from "@/components/admin/settings/fields/use-credential-meta";
import { EnvSourceHint } from "@/components/admin/settings/fields/env-source-hint";
import { SectionTitle } from "@/components/admin/form-sections";
import { AIProviderMark } from "@/components/admin/settings/ai-provider-marks";
import Link from "@/components/language/link";
import {
  AI_IMAGE_MODELS,
  AI_IMAGE_PROVIDERS,
  effectiveImageModel,
  type AIImageProvider,
} from "@/lib/ai-authoring/image-providers";
import {
  AI_TEXT_PROVIDERS,
  AI_TEXT_PROVIDER_INFO,
  type AIExtraTextProvider,
  type AITextProvider,
} from "@/lib/ai-authoring/text-providers";
import { SettingsTabHeader } from "./settings-tab-header";
import { StickySaveFooter } from "./sticky-save-footer";
import { useFallbackTranslator } from "@/hooks/use-fallback-translator";

type AiAuthoringSettings = NonNullable<Settings["aiAuthoring"]>;

/** A model id, and what sets it apart (`admin.settings.ai.providerModelNotes`). */
type ModelOption = {
  value: string;
  note?: "fast" | "balanced" | "best" | "reasoning" | "free";
};

const TEXT_MODELS: ModelOption[] = AI_TEXT_PROVIDER_INFO.openai.models.map((model) => ({
  value: model.id,
  note: model.note,
}));

/** Sentinel for "inherit env/default" since Select can't hold "". */
const DEFAULT_MODEL_VALUE = "__default__";

const SURFACE_KEYS = [
  "products",
  "categories",
  "collections",
  "brands",
  "blogPosts",
  "contentPages",
  "reviews",
  "heroBanner",
] as const;

const TONES = ["friendly", "professional", "luxury", "playful", "supportive"];

/** The credential path of each provider's key. */
function keyPath(provider: AITextProvider): string {
  return provider === "openai" ? "aiAuthoring.apiKey" : `aiAuthoring.providerKeys.${provider}`;
}

type TestResult = { success: boolean; message: string };

/** Tests one provider's key: the typed value, else the saved/env one. */
function KeyTestButton({
  provider,
  apiKey,
  glmRegion,
}: {
  provider: AITextProvider;
  apiKey: string;
  glmRegion?: string;
}) {
  const t = useTranslations("admin.settings.ai");
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  const run = async () => {
    setTesting(true);
    setResult(null);
    try {
      const response = await fetch("/api/admin/settings/test-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey,
          provider,
          ...(provider === "glm" ? { glmRegion: glmRegion || "global" } : {}),
        }),
      });
      const body = (await response.json()) as { success?: boolean; message?: string };
      setResult({ success: Boolean(body.success), message: body.message || t("testFailed") });
    } catch {
      setResult({ success: false, message: t("testFailed") });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2 rounded-full"
        disabled={testing}
        onClick={run}
      >
        {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
        {t("testConnection")}
      </Button>
      {result ? (
        <span
          role="status"
          className={cn(
            "inline-flex items-center gap-1.5 text-sm",
            result.success ? "text-emerald-600 dark:text-emerald-400" : "text-destructive",
          )}
        >
          {result.success ? <CheckCircle2 className="size-4" /> : <TriangleAlert className="size-4" />}
          {result.message}
        </span>
      ) : null}
    </div>
  );
}

export function AiSettingsTab(props: {
  settings: Settings;
  isSaving: boolean;
  isDirty: boolean;
  updateNestedField: (path: string, value: unknown) => void;
  onSave: () => void | Promise<unknown>;
}) {
  const t = useTranslations();
  const tAi = useTranslations("admin.settings.ai");
  const { settings, isSaving, isDirty, updateNestedField, onSave } = props;
  const ai = (settings.aiAuthoring || {}) as Partial<AiAuthoringSettings>;
  const provider: AITextProvider = ai.textProvider ?? "openai";
  const info = AI_TEXT_PROVIDER_INFO[provider];
  const env = settings._meta?.envSources?.ai;

  /** Whether a provider has a key: typed now, saved, or in the environment. */
  const keyState = (id: AITextProvider) => {
    const meta = credentialMeta(settings, keyPath(id));
    const typed =
      id === "openai" ? ai.apiKey?.trim() : ai.providerKeys?.[id as AIExtraTextProvider]?.trim();
    const fromEnv = Boolean(id === "openai" ? env?.apiKey : env?.[id]);
    return { set: meta.set, hint: meta.hint, fromEnv, ready: meta.set || fromEnv || Boolean(typed) };
  };
  const configured = keyState(provider).ready;
  const imageProvider: AIImageProvider = ai.imageProvider === "gemini" ? "gemini" : "openai";
  const salesProvider: AIImageProvider = ai.salesAgentProvider === "gemini" ? "gemini" : "openai";
  const activeImageModel = effectiveImageModel(
    imageProvider,
    (imageProvider === "gemini" ? ai.geminiImageModel : ai.imageModel) || undefined,
  );
  // Each key field appears once: with the text provider, else on the first
  // card below that needs it.
  const keyHere = {
    image: imageProvider !== provider,
    sales: salesProvider !== provider && salesProvider !== imageProvider,
  };

  const tSafe = useFallbackTranslator(t);

  const modelLabel = (model: ModelOption) =>
    model.note ? `${model.value} — ${tAi(`providerModelNotes.${model.note}`)}` : model.value;

  const surfaceLabel = (key: (typeof SURFACE_KEYS)[number]) =>
    tSafe(
      `admin.settings.ai.surfaces.${key}`,
      {
        products: "Products",
        categories: "Categories",
        collections: "Collections",
        brands: "Brands",
        blogPosts: "Blog posts",
        contentPages: "Content pages",
        reviews: "Reviews & replies",
        heroBanner: "Hero banners",
      }[key],
    );

  /** The key field for a provider, with its env hint and test button. */
  const keyField = (id: AITextProvider, hint: string) => {
    const state = keyState(id);
    const meta = AI_TEXT_PROVIDER_INFO[id];
    const value =
      id === "openai" ? ai.apiKey || "" : ai.providerKeys?.[id as AIExtraTextProvider] || "";
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label htmlFor={`ai-key-${id}`}>{tAi("providerKey", { name: meta.name })}</Label>
          <a
            href={meta.consoleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-violet-600 hover:underline dark:text-violet-400"
          >
            {tAi("getKey")}
            <ExternalLink className="size-3" />
          </a>
        </div>
        <SecretInput
          id={`ai-key-${id}`}
          value={value}
          secretSet={state.set}
          maskedHint={state.hint}
          placeholderWhenSet={tAi("apiKeySetPlaceholder")}
          placeholderWhenUnset={meta.keyPlaceholder}
          onChange={(next: string) => updateNestedField(keyPath(id), next)}
          onClear={() => updateNestedField(keyPath(id), null)}
        />
        <EnvSourceHint show={state.fromEnv} />
        <p className="text-xs text-muted-foreground">{hint}</p>
        <KeyTestButton provider={id} apiKey={value} glmRegion={ai.glmRegion} />
      </div>
    );
  };

  const extraModel =
    provider === "openai" ? "" : ai.providerModels?.[provider as AIExtraTextProvider] || "";

  return (
    <div className="space-y-4">
      <SettingsTabHeader
        icon={<Sparkles />}
        tone="violet"
        title={tSafe("admin.settings.ai.title", "AI")}
        description={tSafe(
          "admin.settings.ai.description",
          "One place to configure AI Studio content, SEO, and image generation.",
        )}
        meta={
          configured ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {tSafe("admin.settings.ai.statusConfigured", "Configured")} · {info.name}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
              <TriangleAlert className="h-3.5 w-3.5" />
              {tSafe("admin.settings.ai.statusNotConfigured", "Not configured")}
            </span>
          )
        }
      />

      {/* Master switch */}
      <Card className={cn(ai.enabled === false ? "border-dashed" : "border-violet-500/30 bg-violet-500/[0.03]")}>
        <CardContent className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-xl [&_svg]:size-5",
                ai.enabled === false
                  ? "bg-muted text-muted-foreground"
                  : "bg-violet-500/10 text-violet-600 dark:text-violet-400",
              )}
            >
              <Power />
            </span>
            <div>
              <Label htmlFor="ai-enabled" className="text-sm font-semibold">
                {tAi("enabled")}
              </Label>
              <p className="mt-1 text-xs text-muted-foreground">{tAi("enabledHint")}</p>
            </div>
          </div>
          <Switch
            id="ai-enabled"
            checked={ai.enabled !== false}
            onCheckedChange={(checked) => updateNestedField("aiAuthoring.enabled", checked)}
          />
        </CardContent>
      </Card>

      {/* Text provider */}
      <Card>
        <CardHeader>
          <SectionTitle icon={<Bot />} tone="violet">
            {tAi("providerTitle")}
          </SectionTitle>
          <CardDescription>{tAi("providerHint")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div role="radiogroup" aria-label={tAi("providerTitle")} className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
            {AI_TEXT_PROVIDERS.map((id) => {
              const meta = AI_TEXT_PROVIDER_INFO[id];
              const active = id === provider;
              const ready = keyState(id).ready;
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => updateNestedField("aiAuthoring.textProvider", id)}
                  className={cn(
                    "group relative flex flex-col gap-3 rounded-2xl border p-3.5 text-left transition",
                    "hover:border-violet-400/60 hover:bg-violet-500/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50",
                    active && "border-violet-500 bg-violet-500/[0.06] ring-1 ring-violet-500/40",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <AIProviderMark provider={id} />
                    {active ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-violet-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                        <CheckCircle2 className="size-3" />
                        {tAi("selected")}
                      </span>
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold">{meta.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{tAi(`providerTag.${id}`)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                        ready
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      <span className={cn("size-1.5 rounded-full", ready ? "bg-emerald-500" : "bg-muted-foreground/50")} />
                      {ready ? tAi("keyReady") : tAi("keyMissing")}
                    </span>
                    {meta.supportsVision ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-700 dark:text-sky-400">
                        <ImageIcon className="size-3" />
                        {tAi("vision")}
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="space-y-4 rounded-2xl border bg-muted/20 p-4">
            <div className="flex items-center gap-2.5">
              <AIProviderMark provider={provider} className="size-8 rounded-lg text-[10px] [&_svg]:size-4" />
              <p className="text-sm font-semibold">{tAi("providerSetup", { name: info.name })}</p>
            </div>

            {provider === "openai" ? (
              <>
                {keyField("openai", tAi("apiKeyHint"))}
                <div className="space-y-2">
                  <Label>{tAi("textModel")}</Label>
                  <Select
                    value={
                      TEXT_MODELS.some((model) => model.value === ai.textModel)
                        ? (ai.textModel as string)
                        : DEFAULT_MODEL_VALUE
                    }
                    onValueChange={(value) =>
                      updateNestedField("aiAuthoring.textModel", value === DEFAULT_MODEL_VALUE ? "" : value)
                    }
                  >
                    <SelectTrigger className="w-full sm:max-w-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={DEFAULT_MODEL_VALUE}>{tAi("modelDefault")}</SelectItem>
                      {TEXT_MODELS.map((model) => (
                        <SelectItem key={model.value} value={model.value}>
                          {modelLabel(model)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : (
              <>
                {provider === "glm" ? (
                  <div className="space-y-2">
                    <Label>{tAi("glmRegion")}</Label>
                    <div className="inline-flex rounded-full border bg-background p-1">
                      {(["global", "china"] as const).map((region) => {
                        const active = (ai.glmRegion ?? "global") === region;
                        return (
                          <button
                            key={region}
                            type="button"
                            aria-pressed={active}
                            onClick={() => updateNestedField("aiAuthoring.glmRegion", region)}
                            className={cn(
                              "rounded-full px-3.5 py-1.5 text-xs font-semibold transition",
                              active ? "bg-violet-600 text-white shadow-sm" : "text-muted-foreground hover:text-foreground",
                            )}
                          >
                            {tAi(region === "global" ? "glmRegionGlobal" : "glmRegionChina")}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground">{tAi("glmRegionHint")}</p>
                    <p className="text-xs text-muted-foreground">{tAi("glmFreeNote")}</p>
                  </div>
                ) : null}

                {keyField(provider, tAi("providerKeyHint", { env: info.envKeys[0] }))}

                <div className="space-y-2">
                  <Label htmlFor={`ai-model-${provider}`}>{tAi("model")}</Label>
                  <Input
                    id={`ai-model-${provider}`}
                    className="font-mono sm:max-w-sm"
                    value={extraModel}
                    maxLength={100}
                    placeholder={info.defaultModel}
                    spellCheck={false}
                    autoComplete="off"
                    onChange={(event) =>
                      updateNestedField(
                        `aiAuthoring.providerModels.${provider}`,
                        event.target.value.replace(/[^A-Za-z0-9._:/-]/g, ""),
                      )
                    }
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {info.models.map((model) => {
                      const active = (extraModel || info.defaultModel) === model.id;
                      return (
                        <button
                          key={model.id}
                          type="button"
                          aria-pressed={active}
                          onClick={() =>
                            updateNestedField(
                              `aiAuthoring.providerModels.${provider}`,
                              model.id === info.defaultModel ? "" : model.id,
                            )
                          }
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-xs transition",
                            active
                              ? "border-violet-500 bg-violet-500/10 text-violet-700 dark:text-violet-300"
                              : "hover:border-violet-400/60",
                          )}
                        >
                          {model.id}
                          {model.note ? (
                            <span className="font-sans text-[10px] text-muted-foreground">
                              {tAi(`providerModelNotes.${model.note}`)}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {tAi("modelHint", { name: info.name, model: info.defaultModel })}
                  </p>
                </div>

                {!info.supportsVision ? (
                  <p className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                    <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                    {tAi("noVisionNote", { name: info.name })}
                  </p>
                ) : null}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Images and hero banners */}
      <Card>
        <CardHeader>
          <SectionTitle icon={<ImageIcon />} tone="sky">
            {tAi("imagesTitle")}
          </SectionTitle>
          <CardDescription>{tAi("imagesHint")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <ProviderChoice
            label={tAi("imageProviderLabel")}
            value={imageProvider}
            onChange={(next) => updateNestedField("aiAuthoring.imageProvider", next)}
            ready={(id) => keyState(id).ready}
          />

          {keyHere.image ? (
            <div className="rounded-2xl border bg-muted/20 p-4">
              {keyField(imageProvider, tAi("sharedKeyHint", { name: AI_TEXT_PROVIDER_INFO[imageProvider].name }))}
            </div>
          ) : (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle2
                className={cn("size-3.5", keyState(imageProvider).ready ? "text-emerald-500" : "text-muted-foreground")}
              />
              {tAi("keyShownAbove", { name: AI_TEXT_PROVIDER_INFO[imageProvider].name })}
            </p>
          )}

          <div className="space-y-2">
            <Label>{tAi("imageModel")}</Label>
            <div className="flex flex-wrap gap-1.5">
              {AI_IMAGE_MODELS[imageProvider].models.map((model) => {
                const active = activeImageModel === model.id;
                return (
                  <button
                    key={model.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() =>
                      updateNestedField(
                        imageProvider === "gemini" ? "aiAuthoring.geminiImageModel" : "aiAuthoring.imageModel",
                        model.id === AI_IMAGE_MODELS[imageProvider].defaultModel ? "" : model.id,
                      )
                    }
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-xs transition",
                      active
                        ? "border-sky-500 bg-sky-500/10 text-sky-700 dark:text-sky-300"
                        : "hover:border-sky-400/60",
                    )}
                  >
                    {model.id}
                    {model.note ? (
                      <span className="font-sans text-[10px] text-muted-foreground">
                        {tAi(`providerModelNotes.${model.note}`)}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{tAi("imageSize")}</Label>
              <Select
                value={ai.imageDefaults?.size || "auto"}
                onValueChange={(value) => updateNestedField("aiAuthoring.imageDefaults.size", value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["auto", "1024x1024", "1024x1536", "1536x1024"].map((size) => (
                    <SelectItem key={size} value={size}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {imageProvider === "openai" ? (
              <div className="space-y-2">
                <Label>{tAi("imageQuality")}</Label>
                <Select
                  value={ai.imageDefaults?.quality || "high"}
                  onValueChange={(value) => updateNestedField("aiAuthoring.imageDefaults.quality", value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["auto", "medium", "high"].map((quality) => (
                      <SelectItem key={quality} value={quality}>
                        {quality}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{tAi("imageQualityHint")}</p>
              </div>
            ) : (
              <p className="self-end rounded-xl border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                {tAi("geminiImageNote")}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* AI Sales Agent */}
      <Card>
        <CardHeader>
          <SectionTitle icon={<MessagesSquare />} tone="rose">
            {tAi("salesAgentTitle")}
          </SectionTitle>
          <CardDescription>{tAi("salesAgentHint")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <ProviderChoice
            label={tAi("salesAgentProviderLabel")}
            value={salesProvider}
            onChange={(next) => updateNestedField("aiAuthoring.salesAgentProvider", next)}
            ready={(id) => keyState(id).ready}
          />
          {keyHere.sales ? (
            <div className="rounded-2xl border bg-muted/20 p-4">
              {keyField(salesProvider, tAi("sharedKeyHint", { name: AI_TEXT_PROVIDER_INFO[salesProvider].name }))}
            </div>
          ) : (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle2
                className={cn("size-3.5", keyState(salesProvider).ready ? "text-emerald-500" : "text-muted-foreground")}
              />
              {tAi("keyShownAbove", { name: AI_TEXT_PROVIDER_INFO[salesProvider].name })}
            </p>
          )}
          <Button asChild variant="outline" size="sm" className="gap-2 rounded-full">
            <Link href="/admin/ai-sales-agent">
              <MessagesSquare className="size-4" />
              {tAi("salesAgentOpen")}
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* Surfaces */}
      <Card>
        <CardHeader>
          <SectionTitle icon={<LayoutGrid />} tone="emerald">
            {tSafe("admin.settings.ai.surfacesTitle", "Where AI is available")}
          </SectionTitle>
          <CardDescription>
            {tSafe(
                "admin.settings.ai.surfacesHint",
                "Turn AI generation off for specific areas of the dashboard.",
              )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2.5 sm:grid-cols-2">
            {SURFACE_KEYS.map((key) => (
              <div
                key={key}
                className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 transition-colors has-[[data-state=checked]]:border-emerald-500/30 has-[[data-state=checked]]:bg-emerald-500/[0.04]"
              >
                <Label htmlFor={`ai-surface-${key}`} className="text-sm">
                  {surfaceLabel(key)}
                </Label>
                <Switch
                  id={`ai-surface-${key}`}
                  checked={ai.surfaces?.[key] !== false}
                  onCheckedChange={(checked) =>
                    updateNestedField(`aiAuthoring.surfaces.${key}`, checked)
                  }
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Brand voice */}
      <Card>
        <CardHeader>
          <SectionTitle icon={<Megaphone />} tone="amber">
            {tSafe("admin.settings.ai.brandVoiceTitle", "Brand voice")}
          </SectionTitle>
          <CardDescription>
            {tSafe(
                "admin.settings.ai.brandVoiceHint",
                "Applied to every AI text generation unless a request overrides it.",
              )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{tSafe("admin.settings.ai.tone", "Default tone")}</Label>
              <Select
                value={ai.brandVoice?.tone || DEFAULT_MODEL_VALUE}
                onValueChange={(value) =>
                  updateNestedField(
                    "aiAuthoring.brandVoice.tone",
                    value === DEFAULT_MODEL_VALUE ? "" : value,
                  )
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={DEFAULT_MODEL_VALUE}>
                    {tSafe("admin.settings.ai.toneNone", "No default tone")}
                  </SelectItem>
                  {TONES.map((tone) => (
                    <SelectItem key={tone} value={tone}>
                      {tone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="ai-brand-instructions">
                {tSafe(
                  "admin.settings.ai.brandInstructions",
                  "Style guidance (optional)",
                )}
              </Label>
              <Textarea
                id="ai-brand-instructions"
                rows={3}
                maxLength={2000}
                value={ai.brandVoice?.instructions || ""}
                onChange={(event) =>
                  updateNestedField(
                    "aiAuthoring.brandVoice.instructions",
                    event.target.value,
                  )
                }
                placeholder={tSafe(
                  "admin.settings.ai.brandInstructionsPlaceholder",
                  'e.g. "Write for outdoor enthusiasts. Short sentences. Avoid superlatives."',
                )}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="ai-image-style">
                {tSafe(
                  "admin.settings.ai.imageStyle",
                  "Image style guidance (optional)",
                )}
              </Label>
              <Textarea
                id="ai-image-style"
                rows={2}
                maxLength={1000}
                value={ai.brandVoice?.imageStyle || ""}
                onChange={(event) =>
                  updateNestedField(
                    "aiAuthoring.brandVoice.imageStyle",
                    event.target.value,
                  )
                }
                placeholder={tSafe(
                  "admin.settings.ai.imageStylePlaceholder",
                  'e.g. "Soft natural light, warm neutral palette, minimal props."',
                )}
              />
              <p className="text-xs text-muted-foreground">
                {tSafe(
                  "admin.settings.ai.imageStyleHint",
                  "Applied to generated images (not edits) so product visuals stay on-brand.",
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Brand kit */}
      <Card>
        <CardHeader>
          <SectionTitle icon={<Palette />} tone="rose">
            {tSafe("admin.settings.ai.brandKitTitle", "Brand kit")}
          </SectionTitle>
          <CardDescription>
            {tSafe(
                "admin.settings.ai.brandKitHint",
                "Colors and logo used when generating images and exporting social sizes.",
              )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {(
              [
                ["primaryColor", "admin.settings.ai.primaryColor", "Primary brand color"],
                ["secondaryColor", "admin.settings.ai.secondaryColor", "Secondary brand color"],
              ] as const
            ).map(([field, key, fallback]) => (
              <div key={field} className="space-y-2">
                <Label htmlFor={`ai-brand-${field}`}>{tSafe(key, fallback)}</Label>
                <div className="flex items-center gap-2">
                  <ColorSwatchPicker
                    ariaLabel={tSafe(key, fallback)}
                    value={ai.brandKit?.[field] || "#000000"}
                    onChange={(hex) =>
                      updateNestedField(`aiAuthoring.brandKit.${field}`, hex)
                    }
                    alpha={false}
                  />
                  <Input
                    id={`ai-brand-${field}`}
                    value={ai.brandKit?.[field] || ""}
                    maxLength={9}
                    placeholder="#000000"
                    onChange={(event) =>
                      updateNestedField(
                        `aiAuthoring.brandKit.${field}`,
                        event.target.value,
                      )
                    }
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <Label htmlFor="ai-brand-logo">
              {tSafe("admin.settings.ai.logoUrl", "Brand logo URL")}
            </Label>
            <Input
              id="ai-brand-logo"
              value={ai.brandKit?.logoUrl || ""}
              placeholder="https://…/logo.png"
              onChange={(event) =>
                updateNestedField(
                  "aiAuthoring.brandKit.logoUrl",
                  event.target.value,
                )
              }
            />
            <p className="text-xs text-muted-foreground">
              {tSafe(
                "admin.settings.ai.logoUrlHint",
                "Upload your logo to the store, then paste its URL here. Used as an optional lockup on social exports.",
              )}
            </p>
            {ai.brandKit?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={ai.brandKit.logoUrl}
                alt=""
                className="mt-1 h-10 w-auto rounded border bg-muted/30 object-contain p-1"
              />
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* Access + limits */}
      <Card>
        <CardHeader>
          <SectionTitle icon={<Gauge />} tone="indigo">
            {tSafe("admin.settings.ai.accessTitle", "Access & daily limits")}
          </SectionTitle>
          <CardDescription>
            {tSafe(
                "admin.settings.ai.accessHint",
                "Limits are per user per day. 0 means unlimited.",
              )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2.5 sm:grid-cols-2">
            <div className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 transition-colors has-[[data-state=checked]]:border-emerald-500/30 has-[[data-state=checked]]:bg-emerald-500/[0.04]">
              <Label htmlFor="ai-access-staff" className="text-sm">
                {tSafe("admin.settings.ai.staffEnabled", "Allow staff accounts")}
              </Label>
              <Switch
                id="ai-access-staff"
                checked={ai.access?.staffEnabled !== false}
                onCheckedChange={(checked) =>
                  updateNestedField("aiAuthoring.access.staffEnabled", checked)
                }
              />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 transition-colors has-[[data-state=checked]]:border-emerald-500/30 has-[[data-state=checked]]:bg-emerald-500/[0.04]">
              <Label htmlFor="ai-access-vendors" className="text-sm">
                {tSafe(
                  "admin.settings.ai.vendorsEnabled",
                  "Allow vendor accounts",
                )}
              </Label>
              <Switch
                id="ai-access-vendors"
                checked={ai.access?.vendorsEnabled !== false}
                onCheckedChange={(checked) =>
                  updateNestedField(
                    "aiAuthoring.access.vendorsEnabled",
                    checked,
                  )
                }
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ai-limit-text">
                {tSafe(
                  "admin.settings.ai.textLimit",
                  "Text generations / user / day",
                )}
              </Label>
              <NumberInput
                id="ai-limit-text"
                min={0}
                max={100000}
                step={1}
                value={ai.limits?.textPerUserPerDay ?? 0}
                whenEmpty={0}
                normalize={Math.trunc}
                onValueChange={(next) =>
                  updateNestedField("aiAuthoring.limits.textPerUserPerDay", next ?? 0)
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ai-limit-image">
                {tSafe(
                  "admin.settings.ai.imageLimit",
                  "Image generations / user / day",
                )}
              </Label>
              <NumberInput
                id="ai-limit-image"
                min={0}
                max={100000}
                step={1}
                value={ai.limits?.imagePerUserPerDay ?? 0}
                whenEmpty={0}
                normalize={Math.trunc}
                onValueChange={(next) =>
                  updateNestedField("aiAuthoring.limits.imagePerUserPerDay", next ?? 0)
                }
              />
              <p className="text-xs text-muted-foreground">
                {tSafe(
                  "admin.settings.ai.imageLimitHint",
                  "Images cost the most — set a cap for shared stores.",
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <StickySaveFooter
        label={tSafe("admin.settings.saveChanges", "Save Changes")}
        isSaving={isSaving}
        isDirty={isDirty}
        onSave={onSave}
      />
    </div>
  );
}

/** OpenAI or Gemini, as two cards. */
function ProviderChoice({
  label,
  value,
  onChange,
  ready,
}: {
  label: string;
  value: AIImageProvider;
  onChange: (next: AIImageProvider) => void;
  ready: (id: AIImageProvider) => boolean;
}) {
  const tAi = useTranslations("admin.settings.ai");
  return (
    <div role="radiogroup" aria-label={label} className="grid gap-2.5 sm:grid-cols-2">
      {AI_IMAGE_PROVIDERS.map((id) => {
        const active = id === value;
        const isReady = ready(id);
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(id)}
            className={cn(
              "flex items-center gap-3 rounded-2xl border p-3 text-left transition",
              active ? "border-violet-500 bg-violet-500/[0.06] ring-1 ring-violet-500/40" : "hover:border-violet-400/60",
            )}
          >
            <AIProviderMark provider={id} className="size-9" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold">{AI_TEXT_PROVIDER_INFO[id].name}</span>
              <span
                className={cn(
                  "mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium",
                  isReady ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground",
                )}
              >
                <span className={cn("size-1.5 rounded-full", isReady ? "bg-emerald-500" : "bg-muted-foreground/50")} />
                {isReady ? tAi("keyReady") : tAi("keyMissing")}
              </span>
            </span>
            {active ? <CheckCircle2 className="size-5 shrink-0 text-violet-600" /> : null}
          </button>
        );
      })}
    </div>
  );
}
