"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Globe, ImageIcon, Search, Share2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { SectionTitle } from "@/components/admin/form-sections";
import type { Settings } from "@/components/admin/settings/types";
import { useFallbackTranslator } from "@/hooks/use-fallback-translator";
import { cn } from "@/lib/utils";
import { SettingsTabHeader } from "./settings-tab-header";
import { StickySaveFooter } from "./sticky-save-footer";

/** Roughly what Google shows before it cuts a title or a description off. */
const TITLE_LIMIT = 60;
const DESCRIPTION_LIMIT = 160;

const subscribeToNothing = () => () => {};
const readHost = () => window.location.host;
const readNoHost = () => "";

/**
 * Settings → SEO: the store's default title, description, keywords and share
 * image, with the two places they actually show — a Google result and a link
 * shared on LINE or Facebook — drawn live beside the fields, and a count that
 * turns amber where Google would cut the text off.
 */
export function SeoSettingsTab(props: {
  settings: Settings;
  isSaving: boolean;
  isDirty: boolean;
  updateNestedField: (path: string, value: unknown) => void;
  onSave: () => void | Promise<unknown>;
}) {
  const t = useTranslations();
  const tSafe = useFallbackTranslator(t);
  const { settings, isSaving, isDirty, updateNestedField, onSave } = props;
  const seo = settings.seo ?? {};
  const storeName = settings.general?.storeName || "";
  const host =
    useSyncExternalStore(subscribeToNothing, readHost, readNoHost) ||
    settings.general?.storeDomain?.replace(/^https?:\/\//, "") ||
    "";

  const title = seo.metaTitle?.trim() || storeName;
  const description = seo.metaDescription?.trim() || "";

  return (
    <div className="space-y-4">
      <SettingsTabHeader
        icon={<Search />}
        tone="sky"
        title={t("admin.settings.seo.title")}
        description={t("admin.settings.seo.description")}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-start">
        <Card>
          <CardHeader>
            <SectionTitle icon={<Globe />} tone="sky">
              {tSafe("admin.settings.seo.fieldsTitle", "Search and sharing")}
            </SectionTitle>
            <CardDescription>
              {tSafe(
                "admin.settings.seo.fieldsHint",
                "What the home page says about the store in search results and when a link to it is shared. Products and pages set their own.",
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <CountedField
              id="metaTitle"
              label={t("admin.settings.seo.metaTitle")}
              value={seo.metaTitle || ""}
              limit={TITLE_LIMIT}
              placeholder={t("admin.settings.seo.metaTitlePlaceholder")}
              onChange={(value) => updateNestedField("seo.metaTitle", value)}
            />
            <CountedField
              id="metaDescription"
              label={t("admin.settings.seo.metaDescription")}
              value={seo.metaDescription || ""}
              limit={DESCRIPTION_LIMIT}
              placeholder={t("admin.settings.seo.metaDescriptionPlaceholder")}
              onChange={(value) => updateNestedField("seo.metaDescription", value)}
              multiline
            />
            <div className="space-y-2">
              <Label htmlFor="metaKeywords">{t("admin.settings.seo.metaKeywords")}</Label>
              <Input
                id="metaKeywords"
                value={seo.metaKeywords || ""}
                onChange={(e) => updateNestedField("seo.metaKeywords", e.target.value)}
                placeholder={t("admin.settings.seo.metaKeywordsPlaceholder")}
              />
              <p className="text-muted-foreground text-xs">
                {tSafe(
                  "admin.settings.seo.metaKeywordsHint",
                  "Separate keywords with commas. Google no longer ranks on them; some other search engines still read them.",
                )}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ogImage">{t("admin.settings.seo.ogImage")}</Label>
              <Input
                id="ogImage"
                value={seo.ogImage || ""}
                onChange={(e) => updateNestedField("seo.ogImage", e.target.value)}
                placeholder={t("admin.settings.seo.ogImagePlaceholder")}
              />
              <p className="text-muted-foreground text-xs">
                {tSafe(
                  "admin.settings.seo.ogImageHint",
                  "An image address, ideally 1200 × 630 pixels — the picture shown when the store's link is shared.",
                )}
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4 lg:sticky lg:top-[calc(var(--dashboard-header-height,4rem)+1rem)]">
          <Card className="gap-3">
            <CardHeader>
              <SectionTitle icon={<Search />} tone="emerald">
                {tSafe("admin.settings.seo.googlePreview", "Google result")}
              </SectionTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border bg-white p-4 text-left dark:bg-white">
                <p className="truncate text-xs text-[#202124]">{storeName || host}</p>
                <p className="truncate text-xs text-[#4d5156]">{host ? `https://${host}` : ""}</p>
                <p className="mt-1 line-clamp-2 text-lg leading-snug text-[#1a0dab]">
                  {clip(title, TITLE_LIMIT) || tSafe("admin.settings.seo.previewNoTitle", "Your store's title")}
                </p>
                <p className="mt-1 line-clamp-3 text-sm leading-snug text-[#4d5156]">
                  {clip(description, DESCRIPTION_LIMIT) ||
                    tSafe("admin.settings.seo.previewNoDescription", "Add a description so Google shows your words, not text it picks from the page.")}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="gap-3">
            <CardHeader>
              <SectionTitle icon={<Share2 />} tone="violet">
                {tSafe("admin.settings.seo.sharePreview", "Shared link")}
              </SectionTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-xl border bg-card">
                <div className="flex aspect-[1200/630] items-center justify-center bg-muted">
                  {seo.ogImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={seo.ogImage} alt="" className="size-full object-cover" />
                  ) : (
                    <ImageIcon className="text-muted-foreground size-8" />
                  )}
                </div>
                <div className="space-y-0.5 p-3">
                  <p className="text-muted-foreground truncate text-[11px] uppercase">{host}</p>
                  <p className="truncate text-sm font-semibold">{title || "—"}</p>
                  <p className="text-muted-foreground line-clamp-2 text-xs">{description}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <StickySaveFooter
        label={t("admin.settings.seo.save")}
        isSaving={isSaving}
        isDirty={isDirty}
        onSave={onSave}
      />
    </div>
  );
}

function clip(text: string, limit: number) {
  return text.length > limit ? `${text.slice(0, limit - 1).trimEnd()}…` : text;
}

/** A field with a running count that turns amber past where Google cuts off. */
function CountedField(props: {
  id: string;
  label: string;
  value: string;
  limit: number;
  placeholder?: string;
  onChange: (value: string) => void;
  multiline?: boolean;
}) {
  const length = props.value.length;
  const over = length > props.limit;
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={props.id}>{props.label}</Label>
        <span
          className={cn(
            "text-xs tabular-nums",
            over ? "font-semibold text-amber-600 dark:text-amber-400" : "text-muted-foreground",
          )}
        >
          {length}/{props.limit}
        </span>
      </div>
      {props.multiline ? (
        <Textarea
          id={props.id}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          placeholder={props.placeholder}
          rows={3}
        />
      ) : (
        <Input
          id={props.id}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          placeholder={props.placeholder}
        />
      )}
    </div>
  );
}
