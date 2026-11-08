"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  AtSign,
  CheckCircle2,
  ChevronDown,
  Eye,
  ExternalLink,
  Link2,
  Mail,
  Plus,
  Share2,
  Trash2,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import type {
  CustomShareButton,
  Settings,
  SocialShareSettings,
} from "@/components/admin/settings/types";
import { resolveShareSettings } from "@/lib/site-config/share-config";
import {
  SOCIAL_PROFILE_PLATFORMS,
  socialLinkStatus,
  type SocialPlatformId,
} from "@/lib/site-config/social-platforms";
import { SocialBrandTile, SocialGlyph } from "@/components/icons/social-brand-icons";
import { SectionTitle } from "@/components/admin/form-sections";
import { cn } from "@/lib/utils";
import {
  MediaUploader,
  type UploadedMedia,
} from "@/components/ui/media-uploader";
import { SettingsTabHeader } from "./settings-tab-header";
import { StickySaveFooter } from "./sticky-save-footer";
import { useFallbackTranslator } from "@/hooks/use-fallback-translator";

type ShareToggleKey = Exclude<keyof SocialShareSettings, "custom">;

function createCustomId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function SocialSettingsTab(props: {
  settings: Settings;
  isSaving: boolean;
  isDirty: boolean;
  updateNestedField: (path: string, value: unknown) => void;
  onSave: () => void | Promise<unknown>;
}) {
  const t = useTranslations();
  const tS = useTranslations("admin.settings.social");
  const { settings, isSaving, isDirty, updateNestedField, onSave } = props;

  const tr = useFallbackTranslator(t);

  const social = (settings.social ?? {}) as Record<string, unknown>;
  const linkOf = (key: string) => (typeof social[key] === "string" ? (social[key] as string) : "");
  const linked = SOCIAL_PROFILE_PLATFORMS.filter((platform) => linkOf(platform.key).trim());

  const share = resolveShareSettings(settings.social?.share);
  const setShare = (key: ShareToggleKey, value: boolean) =>
    updateNestedField(`social.share.${key}`, value);

  const customButtons = share.custom;
  const setCustom = (next: CustomShareButton[]) =>
    updateNestedField("social.share.custom", next);
  const addCustom = () =>
    setCustom([
      ...customButtons,
      { id: createCustomId(), label: "", urlTemplate: "", enabled: true },
    ]);
  const updateCustom = (index: number, patch: Partial<CustomShareButton>) =>
    setCustom(
      customButtons.map((item, i) =>
        i === index ? { ...item, ...patch } : item,
      ),
    );
  const removeCustom = (index: number) =>
    setCustom(customButtons.filter((_, i) => i !== index));

  const channels: Array<{
    key: Exclude<ShareToggleKey, "enabled" | "copyLink" | "email">;
    label: string;
    brand: SocialPlatformId;
  }> = [
    { key: "facebook", label: tr("admin.settings.social.share.facebook", "Facebook"), brand: "facebook" },
    { key: "twitter", label: tr("admin.settings.social.share.twitter", "X / Twitter"), brand: "x" },
    { key: "whatsapp", label: tr("admin.settings.social.share.whatsapp", "WhatsApp"), brand: "whatsapp" },
    { key: "telegram", label: tr("admin.settings.social.share.telegram", "Telegram"), brand: "telegram" },
    { key: "pinterest", label: tr("admin.settings.social.share.pinterest", "Pinterest"), brand: "pinterest" },
    { key: "linkedin", label: tr("admin.settings.social.share.linkedin", "LinkedIn"), brand: "linkedin" },
  ];

  const disabledCls = share.enabled
    ? "opacity-100"
    : "pointer-events-none select-none opacity-50";

  // What the product page's share row will hold, in its order.
  const shareRow: Array<{ id: string; label: string; node: React.ReactNode }> = share.enabled
    ? [
        ...(share.copyLink
          ? [{ id: "copy", label: tr("admin.settings.social.share.copyLink", "Copy link"), node: <Link2 className="size-4" /> }]
          : []),
        ...channels
          .filter((channel) => share[channel.key])
          .map((channel) => ({ id: channel.key, label: channel.label, node: <SocialBrandTile platform={channel.brand} className="size-8 rounded-full" glyphClassName="size-4" /> })),
        ...(share.email
          ? [{ id: "email", label: tr("admin.settings.social.share.email", "Email"), node: <Mail className="size-4" /> }]
          : []),
        ...customButtons
          .filter((item) => item.enabled && item.label.trim())
          .map((item) => ({
            id: item.id,
            label: item.label,
            node: item.icon ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.icon} alt="" className="size-5 object-contain" />
            ) : (
              <Share2 className="size-4" />
            ),
          })),
      ]
    : [];

  return (
    <div className="space-y-4 pb-24">
      <SettingsTabHeader
        icon={<Share2 />}
        tone="indigo"
        title={t("admin.settings.social.title")}
        description={t("admin.settings.social.description")}
        meta={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 text-xs font-medium text-indigo-700 dark:text-indigo-300">
            <AtSign className="h-3.5 w-3.5" />
            {tS("linkedCount", { count: linked.length, total: SOCIAL_PROFILE_PLATFORMS.length })}
          </span>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] lg:items-start">
        <Card>
          <CardHeader>
            <SectionTitle icon={<AtSign />} tone="indigo">
              {tS("profilesTitle")}
            </SectionTitle>
            <CardDescription>{tS("profilesHint")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2.5">
            {SOCIAL_PROFILE_PLATFORMS.map((platform) => {
              const value = linkOf(platform.key);
              const status = socialLinkStatus(platform, value);
              return (
                <div
                  key={platform.key}
                  className={cn(
                    "rounded-xl border p-3 transition-colors",
                    status === "ok" && "border-emerald-500/30 bg-emerald-500/[0.03]",
                    status === "otherHost" && "border-amber-500/40 bg-amber-500/[0.04]",
                    status === "invalid" && "border-destructive/40 bg-destructive/[0.03]",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <SocialBrandTile platform={platform.id} muted={status === "empty"} />
                    <div className="min-w-0 flex-1 space-y-1">
                      <Label htmlFor={platform.key} className="text-sm font-semibold">
                        {platform.label}
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id={platform.key}
                          type="url"
                          inputMode="url"
                          value={value}
                          onChange={(e) => updateNestedField(`social.${platform.key}`, e.target.value)}
                          placeholder={platform.placeholder}
                          className="h-9"
                          aria-invalid={status === "invalid" || undefined}
                        />
                        {status === "ok" || status === "otherHost" ? (
                          <Button
                            asChild
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="shrink-0 text-muted-foreground"
                          >
                            <a href={value.trim()} target="_blank" rel="noopener noreferrer" aria-label={tS("openLink")} title={tS("openLink")}>
                              <ExternalLink className="size-4" />
                            </a>
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    {status === "ok" ? (
                      <CheckCircle2 className="size-4 shrink-0 text-emerald-500" aria-hidden />
                    ) : null}
                  </div>
                  {status === "otherHost" ? (
                    <p className="mt-2 flex items-center gap-1.5 pl-12 text-xs text-amber-700 dark:text-amber-400">
                      <TriangleAlert className="size-3.5 shrink-0" />
                      {tS("statusOtherHost", { name: platform.label })}
                    </p>
                  ) : status === "invalid" ? (
                    <p className="mt-2 flex items-center gap-1.5 pl-12 text-xs text-destructive">
                      <TriangleAlert className="size-3.5 shrink-0" />
                      {tS("statusInvalid")}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="lg:sticky lg:top-20">
          <CardHeader>
            <SectionTitle icon={<Eye />} tone="sky">
              {tS("previewTitle")}
            </SectionTitle>
            <CardDescription>{tS("previewHint")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-2xl border bg-muted/30 p-4">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {tS("previewFollow")}
              </p>
              {linked.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {linked.map((platform) => (
                    <span
                      key={platform.key}
                      title={platform.label}
                      className="inline-flex size-9 items-center justify-center rounded-full bg-foreground text-background"
                    >
                      <SocialGlyph platform={platform.id} />
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">{tS("previewEmpty")}</p>
              )}
            </div>
            <div className="rounded-2xl border bg-muted/30 p-4">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {tS("sharePreview")}
              </p>
              {shareRow.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {shareRow.map((item) => (
                    <span
                      key={item.id}
                      title={item.label}
                      className="inline-flex size-8 items-center justify-center overflow-hidden rounded-full border bg-background text-foreground"
                    >
                      {item.node}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">{tS("sharePreviewOff")}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <SectionTitle icon={<Share2 />} tone="emerald">
            {tr("admin.settings.social.share.title", "Share Buttons")}
          </SectionTitle>
          <CardDescription>
            {tr(
              "admin.settings.social.share.description",
              "Choose which share buttons appear on your product pages.",
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div
            className={cn(
              "flex items-center justify-between gap-4 rounded-xl border p-4",
              share.enabled ? "border-emerald-500/30 bg-emerald-500/[0.05]" : "border-dashed",
            )}
          >
            <div className="space-y-1">
              <h4 className="font-semibold">
                {tr(
                  "admin.settings.social.share.enable",
                  "Enable share buttons",
                )}
              </h4>
              <p className="text-sm text-muted-foreground">
                {tr(
                  "admin.settings.social.share.enableDesc",
                  "Show a row of share buttons on product detail pages.",
                )}
              </p>
            </div>
            <Switch
              checked={share.enabled}
              onCheckedChange={(value) => setShare("enabled", value)}
            />
          </div>

          <div
            className={cn("space-y-6 transition-opacity", disabledCls)}
            aria-disabled={!share.enabled}
          >
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {tr("admin.settings.social.share.linkGroup", "Link")}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <ShareToggleRow
                  icon={Link2}
                  label={tr("admin.settings.social.share.copyLink", "Copy link")}
                  description={tr(
                    "admin.settings.social.share.copyLinkDesc",
                    "A button that copies the product link to the clipboard.",
                  )}
                  checked={share.copyLink}
                  disabled={!share.enabled}
                  onChange={(value) => setShare("copyLink", value)}
                />
                <ShareToggleRow
                  icon={Mail}
                  label={tr("admin.settings.social.share.email", "Email")}
                  checked={Boolean(share.email)}
                  disabled={!share.enabled}
                  onChange={(value) => setShare("email", value)}
                />
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {tr(
                  "admin.settings.social.share.socialGroup",
                  "Social networks",
                )}
              </p>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {channels.map((channel) => (
                  <ShareToggleRow
                    key={channel.key}
                    brand={channel.brand}
                    label={channel.label}
                    checked={Boolean(share[channel.key])}
                    disabled={!share.enabled}
                    onChange={(value) => setShare(channel.key, value)}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {tr(
                    "admin.settings.social.share.customGroup",
                    "Custom platforms",
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {tr(
                    "admin.settings.social.share.customHint",
                    "Add any other platform with its own share link.",
                  )}
                </p>
              </div>
              {customButtons.length > 0 ? (
                <div className="space-y-3">
                  {customButtons.map((item, index) => (
                    <CustomShareRow
                      key={item.id || index}
                      item={item}
                      disabled={!share.enabled}
                      labelLabel={tr(
                        "admin.settings.social.share.customLabel",
                        "Label",
                      )}
                      labelPlaceholder={tr(
                        "admin.settings.social.share.customLabelPlaceholder",
                        "e.g. Reddit",
                      )}
                      untitledLabel={tr(
                        "admin.settings.social.share.customUntitled",
                        "Untitled platform",
                      )}
                      urlLabel={tr(
                        "admin.settings.social.share.customUrl",
                        "Share link",
                      )}
                      iconLabel={tr(
                        "admin.settings.social.share.customIcon",
                        "Icon",
                      )}
                      iconHint={tr(
                        "admin.settings.social.share.customIconHint",
                        "Optional. Upload a square image, or paste an image URL. Falls back to a generic share icon.",
                      )}
                      hintPrefix={tr(
                        "admin.settings.social.share.customUrlHint",
                        "Insert the product link and title with the tokens:",
                      )}
                      removeLabel={tr(
                        "admin.settings.social.share.customRemove",
                        "Remove platform",
                      )}
                      onChange={(patch) => updateCustom(index, patch)}
                      onRemove={() => removeCustom(index)}
                    />
                  ))}
                </div>
              ) : null}

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full"
                disabled={!share.enabled}
                onClick={addCustom}
              >
                <Plus className="h-4 w-4" />
                {tr("admin.settings.social.share.customAdd", "Add platform")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <StickySaveFooter
        label={t("admin.settings.social.save")}
        isSaving={isSaving}
        isDirty={isDirty}
        onSave={onSave}
      />
    </div>
  );
}

function ShareToggleRow(props: {
  icon?: LucideIcon;
  brand?: SocialPlatformId;
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  const { icon: Icon, brand, label, description, checked, disabled, onChange } = props;
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-xl border p-3 transition-colors",
        checked && "border-emerald-500/30 bg-emerald-500/[0.04]",
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        {brand ? (
          <SocialBrandTile platform={brand} muted={!checked} />
        ) : (
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-xl",
              checked ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground",
            )}
          >
            {Icon ? <Icon className="h-4 w-4" /> : null}
          </span>
        )}
        <div className="min-w-0 space-y-0.5">
          <p className="truncate text-sm font-medium text-foreground">
            {label}
          </p>
          {description ? (
            <p className="text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
      <Switch
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
      />
    </div>
  );
}

function CustomShareRow(props: {
  item: CustomShareButton;
  disabled?: boolean;
  labelLabel: string;
  labelPlaceholder: string;
  untitledLabel: string;
  urlLabel: string;
  iconLabel: string;
  iconHint: string;
  hintPrefix: string;
  removeLabel: string;
  onChange: (patch: Partial<CustomShareButton>) => void;
  onRemove: () => void;
}) {
  const {
    item,
    disabled,
    labelLabel,
    labelPlaceholder,
    untitledLabel,
    urlLabel,
    iconLabel,
    iconHint,
    hintPrefix,
    removeLabel,
    onChange,
    onRemove,
  } = props;

  // New/unnamed platforms open in edit mode; configured ones collapse to a
  // compact row that mirrors the social-network toggles above.
  const [expanded, setExpanded] = useState(() => !item.label.trim());
  const hasLabel = Boolean(item.label.trim());

  return (
    <div className="overflow-hidden rounded-xl border">
      <div className="flex items-center justify-between gap-3 p-3">
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted text-muted-foreground">
            {item.icon ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.icon}
                alt=""
                className="h-full w-full object-contain"
                aria-hidden
              />
            ) : (
              <Share2 className="h-4 w-4" />
            )}
          </span>
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-sm font-medium",
              hasLabel ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {hasLabel ? item.label : untitledLabel}
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              expanded && "rotate-180",
            )}
          />
        </button>
        <div className="flex items-center gap-1">
          <Switch
            checked={item.enabled}
            disabled={disabled}
            onCheckedChange={(value) => onChange({ enabled: value })}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={disabled}
            aria-label={removeLabel}
            title={removeLabel}
            onClick={onRemove}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {expanded ? (
        <div className="space-y-3 border-t p-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              {labelLabel}
            </Label>
            <Input
              value={item.label}
              disabled={disabled}
              placeholder={labelPlaceholder}
              onChange={(e) => onChange({ label: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{urlLabel}</Label>
            <Input
              value={item.urlTemplate}
              disabled={disabled}
              placeholder="https://example.com/share?url={url}&title={title}"
              onChange={(e) => onChange({ urlTemplate: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              {hintPrefix}{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-[11px]">
                {"{url}"}
              </code>{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-[11px]">
                {"{title}"}
              </code>
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">{iconLabel}</Label>
            <MediaUploader
              maxFiles={1}
              acceptTypes={["image"]}
              disabled={disabled}
              previewFit="contain"
              value={
                item.icon
                  ? [
                      {
                        _id: `custom-share-icon-${item.id}`,
                        url: item.icon,
                        type: "image",
                        mimeType: "image/*",
                        alt: item.label || iconLabel,
                        position: 0,
                      } as UploadedMedia,
                    ]
                  : []
              }
              onChange={(items) => {
                const icon = items.find((entry) => entry.type === "image");
                onChange({ icon: icon?.url || "" });
              }}
            />
            <p className="text-xs text-muted-foreground">{iconHint}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
