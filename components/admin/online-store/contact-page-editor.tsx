"use client";

import Link from "@/components/language/link";
import { useTranslations } from "next-intl";
import { AppImage } from "@/components/ui/app-image";
import { useEffect, useMemo, useState } from "react";
import {
  ExternalLink,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Save,
  Clock3,
  type LucideIcon,
} from "lucide-react";
import { toast } from "@/components/ui/toast-notification";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AdminFormStickyHeader } from "@/components/admin/admin-form-sticky-header";
import { ImageUploadField } from "@/components/admin/settings/fields/image-upload-field";
import {
  CONTENT_PAGE_META,
  normalizeContentPagesSettings,
  type ContactPageData,
} from "@/lib/site-config/content-pages-config";
import { FieldRow, SwitchRow } from "@/components/admin/online-store/editor-fields";
import { PageEditorSkeleton } from "@/components/admin/online-store/online-store-skeletons";
import { isRecord } from "@/lib/utils";

type SettingsResponse = {
  success?: boolean;
  data?: {
    contentPages?: unknown;
  };
};

function cloneContact(value: ContactPageData): ContactPageData {
  return { ...value };
}

export function ContactPageEditor({ locale }: { locale: string }) {
  const t = useTranslations("admin.hc.contactPageEditor");
  const pageMeta = CONTENT_PAGE_META.contact;
  const [contact, setContact] = useState<ContactPageData | null>(null);
  const [initialContact, setInitialContact] = useState<ContactPageData | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        const response = await fetch("/api/admin/settings", { method: "GET" });
        const payload = (await response.json()) as SettingsResponse;

        if (
          !response.ok ||
          payload.success !== true ||
          !isRecord(payload.data)
        ) {
          throw new Error("Failed to load settings");
        }

        const normalized = normalizeContentPagesSettings(
          payload.data.contentPages,
        );
        setContact(cloneContact(normalized.contact));
        setInitialContact(cloneContact(normalized.contact));
      } catch {
        toast.error(t("loadFailed"));
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, []);

  const isDirty = useMemo(
    () => JSON.stringify(contact) !== JSON.stringify(initialContact),
    [contact, initialContact],
  );

  const updateField = <K extends keyof ContactPageData>(
    field: K,
    value: ContactPageData[K],
  ) => {
    setContact((current) =>
      current ? { ...current, [field]: value } : current,
    );
  };

  const save = async () => {
    if (!contact) return;

    try {
      setIsSaving(true);
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: "contentPages",
          data: {
            contact,
          },
        }),
      });

      const payload = (await response.json()) as SettingsResponse;
      if (!response.ok || payload.success !== true || !isRecord(payload.data)) {
        throw new Error("Failed to save");
      }

      const normalized = normalizeContentPagesSettings(
        payload.data.contentPages,
      );
      setContact(cloneContact(normalized.contact));
      setInitialContact(cloneContact(normalized.contact));
      toast.success(t("saved"));
    } catch {
      toast.error(t("saveFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  const openPreview = () => {
    window.open(
      `/${locale}${pageMeta.publicPath}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  // Same placeholder as `pages/contact/loading.tsx`.
  if (isLoading || !contact) return <PageEditorSkeleton />;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <AdminFormStickyHeader
        className="!mx-0 -mt-2 border-b-0 px-0 shadow-none md:px-0"
        title={t("headerTitle")}
        description={t("headerDescription")}
        status={
          <Badge variant={isDirty ? "secondary" : "default"}>
            {isDirty ? t("unsaved") : t("live")}
          </Badge>
        }
        actions={
          <>
            <Button asChild type="button" variant="outline" size="sm">
              <Link href="/admin/online-store/pages">{t("backToPages")}</Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={openPreview}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              {t("preview")}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={save}
              disabled={!isDirty || isSaving}
            >
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {t("save")}
            </Button>
          </>
        }
      />

      <ContactPreview contact={contact} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-4">
          <Card className="gap-4">
            <CardHeader>
              <CardTitle>{t("heroTitle")}</CardTitle>
              <CardDescription>
                {t("heroDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <FieldRow label={t("pageTitle")}>
                <Input
                  value={contact.title}
                  onChange={(event) => updateField("title", event.target.value)}
                  placeholder={t("pageTitlePlaceholder")}
                />
              </FieldRow>
              <FieldRow label={t("pageDescription")}>
                <Textarea
                  value={contact.description}
                  onChange={(event) =>
                    updateField("description", event.target.value)
                  }
                  rows={4}
                />
              </FieldRow>
              <ImageUploadField
                id="contact-hero-image"
                label={t("heroImage")}
                value={contact.heroImageUrl}
                onChange={(value) => updateField("heroImageUrl", value)}
                previewAlt={t("heroImageAlt")}
                previewClassName="h-full w-full object-cover"
              />
              <SwitchRow
                label={t("visible")}
                description={t("visibleDescription")}
                checked={contact.visible}
                onChange={(value) => updateField("visible", value)}
              />
            </CardContent>
          </Card>

          <Card className="gap-4">
            <CardHeader>
              <CardTitle>{t("getInTouchTitle")}</CardTitle>
              <CardDescription>
                {t("getInTouchDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <FieldRow label={t("sectionTitle")}>
                <Input
                  value={contact.getInTouchTitle}
                  onChange={(event) =>
                    updateField("getInTouchTitle", event.target.value)
                  }
                />
              </FieldRow>
              <FieldRow label={t("sectionDescription")}>
                <Textarea
                  value={contact.getInTouchDescription}
                  onChange={(event) =>
                    updateField("getInTouchDescription", event.target.value)
                  }
                  rows={3}
                />
              </FieldRow>
              <div className="grid gap-3 md:grid-cols-2">
                <FieldRow label={t("addressLabel")}>
                  <Input
                    value={contact.headOfficeTitle}
                    onChange={(event) =>
                      updateField("headOfficeTitle", event.target.value)
                    }
                  />
                </FieldRow>
                <FieldRow label={t("emailLabel")}>
                  <Input
                    value={contact.emailTitle}
                    onChange={(event) =>
                      updateField("emailTitle", event.target.value)
                    }
                  />
                </FieldRow>
                <FieldRow label={t("phoneLabel")}>
                  <Input
                    value={contact.phoneTitle}
                    onChange={(event) =>
                      updateField("phoneTitle", event.target.value)
                    }
                  />
                </FieldRow>
                <FieldRow label={t("hoursLabel")}>
                  <Input
                    value={contact.hoursTitle}
                    onChange={(event) =>
                      updateField("hoursTitle", event.target.value)
                    }
                  />
                </FieldRow>
              </div>
              <FieldRow label={t("supportHours")}>
                <Input
                  value={contact.supportHours}
                  onChange={(event) =>
                    updateField("supportHours", event.target.value)
                  }
                />
              </FieldRow>
              <SwitchRow
                label={t("showSocialLinks")}
                description={t("showSocialLinksDescription")}
                checked={contact.showSocialLinks}
                onChange={(value) => updateField("showSocialLinks", value)}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="gap-4">
            <CardHeader>
              <CardTitle>{t("messageFormTitle")}</CardTitle>
              <CardDescription>
                {t("messageFormDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <FieldRow label={t("formTitle")}>
                <Input
                  value={contact.formTitle}
                  onChange={(event) =>
                    updateField("formTitle", event.target.value)
                  }
                />
              </FieldRow>
              <FieldRow label={t("formDescription")}>
                <Textarea
                  value={contact.formDescription}
                  onChange={(event) =>
                    updateField("formDescription", event.target.value)
                  }
                  rows={4}
                />
              </FieldRow>
            </CardContent>
          </Card>

          <Card className="gap-4">
            <CardHeader>
              <CardTitle>{t("mapTitleCard")}</CardTitle>
              <CardDescription>
                {t("mapDescriptionCard")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <SwitchRow
                label={t("showMap")}
                description={t("showMapDescription")}
                checked={contact.showMap}
                onChange={(value) => updateField("showMap", value)}
              />
              <FieldRow label={t("mapTitle")}>
                <Input
                  value={contact.mapTitle}
                  onChange={(event) =>
                    updateField("mapTitle", event.target.value)
                  }
                />
              </FieldRow>
              <FieldRow label={t("mapDescription")}>
                <Textarea
                  value={contact.mapDescription}
                  onChange={(event) =>
                    updateField("mapDescription", event.target.value)
                  }
                  rows={4}
                />
              </FieldRow>
              <FieldRow label={t("mapProvider")}>
                <Select
                  value={contact.mapProvider}
                  onValueChange={(value) =>
                    updateField(
                      "mapProvider",
                      value as ContactPageData["mapProvider"],
                    )
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      value="google"
                      description={t("googleDescription")}
                    >
                      Google Maps
                    </SelectItem>
                    <SelectItem
                      value="openstreetmap"
                      description={t("osmDescription")}
                    >
                      OpenStreetMap
                    </SelectItem>
                    <SelectItem
                      value="custom"
                      description={t("customDescription")}
                    >
                      {t("customEmbed")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </FieldRow>
              <FieldRow label={t("mapAddress")}>
                <Input
                  value={contact.mapAddress}
                  onChange={(event) =>
                    updateField("mapAddress", event.target.value)
                  }
                  placeholder={t("mapAddressPlaceholder")}
                />
              </FieldRow>
              <div className="grid gap-3 md:grid-cols-2">
                <FieldRow label={t("latitude")}>
                  <Input
                    value={contact.mapLatitude}
                    onChange={(event) =>
                      updateField("mapLatitude", event.target.value)
                    }
                    placeholder="40.7128"
                  />
                </FieldRow>
                <FieldRow label={t("longitude")}>
                  <Input
                    value={contact.mapLongitude}
                    onChange={(event) =>
                      updateField("mapLongitude", event.target.value)
                    }
                    placeholder="-74.0060"
                  />
                </FieldRow>
                <FieldRow label={t("zoomLevel")}>
                  <NumberInput
                    min={1}
                    max={20}
                    step={1}
                    value={contact.mapZoom}
                    whenEmpty="keep"
                    normalize={Math.trunc}
                    onValueChange={(next) => {
                      if (next !== undefined) updateField("mapZoom", next);
                    }}
                  />
                </FieldRow>
                <FieldRow label={t("mapHeight")}>
                  <NumberInput
                    min={220}
                    max={720}
                    step={1}
                    value={contact.mapHeight}
                    whenEmpty="keep"
                    normalize={Math.trunc}
                    onValueChange={(next) => {
                      if (next !== undefined) updateField("mapHeight", next);
                    }}
                  />
                </FieldRow>
              </div>
              <FieldRow label={t("customEmbedUrl")}>
                <Textarea
                  value={contact.mapEmbedUrl}
                  onChange={(event) =>
                    updateField("mapEmbedUrl", event.target.value)
                  }
                  placeholder="https://www.google.com/maps/embed?..."
                  rows={3}
                />
              </FieldRow>
              <FieldRow label={t("mapButtonLabel")}>
                <Input
                  value={contact.mapButtonLabel}
                  onChange={(event) =>
                    updateField("mapButtonLabel", event.target.value)
                  }
                  placeholder={t("mapButtonPlaceholder")}
                />
              </FieldRow>
            </CardContent>
          </Card>
        </div>
      </div>

      {!isDirty ? (
        <p className="text-sm text-muted-foreground">
          {t("allSaved")}
        </p>
      ) : null}
    </div>
  );
}

function ContactPreview({ contact }: { contact: ContactPageData }) {
  const t = useTranslations("admin.hc.contactPageEditor");
  return (
    <Card className="overflow-hidden p-0 rounded-sm border-border bg-card shadow-[0_3px_14px_rgba(15,23,42,0.06)]">
      <div className="relative h-52 overflow-hidden bg-slate-950">
        {contact.heroImageUrl ? (
          <AppImage
            src={contact.heroImageUrl}
            alt=""
            fill
            sizes="100vw"
            className="object-cover"
          />
        ) : null}
        <div className="absolute inset-0 bg-slate-950/70" />
        <div className="absolute inset-0 bg-primary/20 mix-blend-multiply" />
        <div className="relative z-10 flex h-full flex-col items-center justify-center px-5 text-center text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
            {t("livePreview")}
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">
            {contact.title || t("previewTitleFallback")}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">
            {contact.description || t("previewDescriptionFallback")}
          </p>
        </div>
      </div>

      <CardContent className="grid gap-5 p-5 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-md bg-muted/50 p-4">
          <h3 className="text-lg font-semibold">
            {contact.getInTouchTitle || t("previewGetInTouchFallback")}
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {contact.getInTouchDescription || t("previewContactHelperFallback")}
          </p>
          <div className="mt-5 space-y-3 text-sm">
            <PreviewRow
              icon={MapPin}
              title={contact.headOfficeTitle}
              value={t("storeAddress")}
            />
            <PreviewRow
              icon={Mail}
              title={contact.emailTitle}
              value="support@example.com"
            />
            <PreviewRow
              icon={Phone}
              title={contact.phoneTitle}
              value="+1 555 0100"
            />
            <PreviewRow
              icon={Clock3}
              title={contact.hoursTitle}
              value={contact.supportHours}
            />
          </div>
        </div>
        <div className="rounded-md border border-border p-4">
          <h3 className="text-lg font-semibold">
            {contact.formTitle || t("previewFormTitleFallback")}
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {contact.formDescription || t("previewFormHelperFallback")}
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="h-9 rounded-md border bg-muted/40" />
            <div className="h-9 rounded-md border bg-muted/40" />
            <div className="h-9 rounded-md border bg-muted/40 sm:col-span-2" />
            <div className="h-20 rounded-md border bg-muted/40 sm:col-span-2" />
          </div>
        </div>
        {contact.showMap ? (
          <div className="rounded-md border border-border bg-muted/30 p-4 lg:col-span-2">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold">
                  {contact.mapTitle || t("previewMapTitleFallback")}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {contact.mapDescription || t("previewMapHelperFallback")}
                </p>
              </div>
              <Badge variant="secondary" className="w-fit">
                {contact.mapProvider === "google"
                  ? "Google Maps"
                  : contact.mapProvider === "openstreetmap"
                    ? "OpenStreetMap"
                    : t("customEmbed")}
              </Badge>
            </div>
            <div
              className="mt-4 flex items-center justify-center rounded-md border border-dashed border-border bg-background text-center text-sm text-muted-foreground"
              style={{
                height: `${Math.min(240, Math.max(120, contact.mapHeight / 2))}px`,
              }}
            >
              <div className="px-4">
                <MapPin className="mx-auto mb-2 h-5 w-5 text-primary" />
                <p>
                  {contact.mapLatitude && contact.mapLongitude
                    ? `${contact.mapLatitude}, ${contact.mapLongitude}`
                    : contact.mapAddress || t("storeAddress")}
                </p>
                <p className="mt-1 text-xs">
                  {t("previewMapMeta", {
                    zoom: contact.mapZoom,
                    height: contact.mapHeight,
                  })}
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function PreviewRow({
  icon: Icon,
  title,
  value,
}: {
  icon: LucideIcon;
  title: string;
  value: string;
}) {
  const t = useTranslations("admin.hc.contactPageEditor");
  return (
    <div className="flex gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Icon className="h-4 w-4" />
      </span>
      <span>
        <span className="block font-medium">{title || t("labelFallback")}</span>
        <span className="text-muted-foreground">{value || t("valueFallback")}</span>
      </span>
    </div>
  );
}

