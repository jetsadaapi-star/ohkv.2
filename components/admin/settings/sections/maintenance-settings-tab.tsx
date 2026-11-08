"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  CalendarClock,
  Construction,
  ImageIcon,
  Loader2,
  MessageSquareText,
  Plus,
  ShieldCheck,
  Store,
  TriangleAlert,
  Wifi,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast-notification";
import type { Settings } from "@/components/admin/settings/types";
import { normalizeAllowedIPs } from "@/lib/maintenance";
import { MAINTENANCE_COPY } from "@/lib/storefront/maintenance-copy";
import { DEFAULT_STORE_NAME } from "@/config/branding.config";
import { cn } from "@/lib/utils";
import { ImageUploadField } from "@/components/admin/settings/fields/image-upload-field";
import { SectionTitle } from "@/components/admin/form-sections";
import { SettingsTabHeader } from "./settings-tab-header";
import { StickySaveFooter } from "./sticky-save-footer";
import { useFallbackTranslator } from "@/hooks/use-fallback-translator";
import { useDateFormat } from "@/lib/intl/use-date-format";

function toDateTimeLocalValue(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function toIsoDateTime(value: string) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
}

/** A plausible IPv4 or IPv6 address — the allow-list matches exact addresses only. */
function looksLikeIp(value: string) {
  const v4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
  const v6 = /^[0-9a-f:]+$/i;
  return v4.test(value) || (value.includes(":") && v6.test(value));
}

export function MaintenanceSettingsTab(props: {
  settings: Settings;
  isSaving: boolean;
  isDirty: boolean;
  updateNestedField: (path: string, value: unknown) => void;
  onSave: () => void | Promise<unknown>;
}) {
  const fmtDate = useDateFormat();
  const t = useTranslations();
  const tM = useTranslations("admin.settings.maintenance");
  const { settings, isSaving, isDirty, updateNestedField, onSave } = props;
  const maintenance = settings.maintenance || { enabled: false };
  const translate = useFallbackTranslator(t);
  // What a visitor reads when the fields are left blank.
  const defaultTitle = MAINTENANCE_COPY.title(
    settings.general?.storeName?.trim() || DEFAULT_STORE_NAME,
  );
  const countdownDate = maintenance.countdownEndsAt
    ? new Date(maintenance.countdownEndsAt)
    : null;
  const countdownEndsAt =
    countdownDate && Number.isFinite(countdownDate.getTime())
      ? fmtDate(countdownDate, "longDateTime")
      : null;
  const backgroundImageUrl = maintenance.backgroundImageUrl?.trim() || "";
  const allowedIPs = maintenance.allowedIPs || [];

  const [ipDraft, setIpDraft] = useState("");
  const [ipError, setIpError] = useState<string | null>(null);
  const [myIp, setMyIp] = useState<string | null>(null);
  const [findingIp, setFindingIp] = useState(false);

  const setIPs = (next: string[]) =>
    updateNestedField("maintenance.allowedIPs", normalizeAllowedIPs(next));

  const addIps = (raw: string) => {
    const parts = raw
      .split(/[\s,]+/)
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    const bad = parts.find((part) => !looksLikeIp(part));
    if (bad) {
      setIpError(tM("ipInvalid", { ip: bad }));
      return;
    }
    setIPs([...allowedIPs, ...parts]);
    setIpDraft("");
    setIpError(null);
  };

  const addMyIp = async () => {
    setFindingIp(true);
    try {
      const response = await fetch("/api/admin/settings/my-ip", { cache: "no-store" });
      const body = (await response.json()) as { data?: { ip?: string | null } };
      const ip = body.data?.ip?.trim();
      if (!response.ok || !ip) throw new Error();
      setMyIp(ip);
      if (allowedIPs.includes(ip)) {
        toast.info(tM("myIpAlready", { ip }));
      } else {
        setIPs([...allowedIPs, ip]);
        toast.success(tM("myIpAdded", { ip }));
      }
    } catch {
      toast.error(tM("myIpFailed"));
    } finally {
      setFindingIp(false);
    }
  };

  const enabled = Boolean(maintenance.enabled);

  return (
    <div className="space-y-4 pb-24">
      <SettingsTabHeader
        icon={<Construction />}
        tone="amber"
        title={t("admin.settings.maintenance.title")}
        description={t("admin.settings.maintenance.description")}
        meta={
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
              enabled
                ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
            )}
          >
            <span className={cn("size-1.5 rounded-full", enabled ? "animate-pulse bg-amber-500" : "bg-emerald-500")} />
            {enabled ? tM("statusClosed") : tM("statusOpen")}
          </span>
        }
      />

      {/* The switch, as the state of the store. */}
      <Card
        className={cn(
          "overflow-hidden",
          enabled
            ? "border-amber-500/40 bg-[repeating-linear-gradient(135deg,rgba(245,158,11,0.07)_0_14px,transparent_14px_28px)]"
            : "border-emerald-500/30 bg-emerald-500/[0.03]",
        )}
      >
        <CardContent className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span
              className={cn(
                "flex size-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm [&_svg]:size-5",
                enabled ? "bg-amber-500" : "bg-emerald-600",
              )}
            >
              {enabled ? <Construction /> : <Store />}
            </span>
            <div className="space-y-1">
              <h4 className="font-semibold">{t("admin.settings.maintenance.enable")}</h4>
              <p className="text-sm text-muted-foreground">
                {enabled ? tM("enabledNow") : t("admin.settings.maintenance.enableDesc")}
              </p>
            </div>
          </div>
          <Switch
            checked={enabled}
            aria-label={t("admin.settings.maintenance.enable")}
            onCheckedChange={(value) => updateNestedField("maintenance.enabled", value)}
          />
        </CardContent>
      </Card>

      {!enabled ? (
        <p className="px-1 text-sm text-muted-foreground">{tM("prepareHint")}</p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.9fr)] lg:items-start">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <SectionTitle icon={<MessageSquareText />} tone="amber">
                {tM("messageTitle")}
              </SectionTitle>
              <CardDescription>{tM("messageHint")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="maintenanceTitle">
                  {translate("admin.settings.maintenance.titleLabel", "Headline")}
                </Label>
                <Input
                  id="maintenanceTitle"
                  value={maintenance.title || ""}
                  placeholder={defaultTitle}
                  onChange={(event) => updateNestedField("maintenance.title", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maintenanceMessage">{t("admin.settings.maintenance.message")}</Label>
                <Textarea
                  id="maintenanceMessage"
                  value={maintenance.message || ""}
                  onChange={(event) => updateNestedField("maintenance.message", event.target.value)}
                  placeholder={MAINTENANCE_COPY.message}
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <SectionTitle icon={<ImageIcon />} tone="violet">
                {translate("admin.settings.maintenance.backgroundImage", "Background image")}
              </SectionTitle>
              <CardDescription>
                {translate(
                  "admin.settings.maintenance.backgroundImageHint",
                  "When an image is set, visitors see it dimmed behind the maintenance text without the card.",
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ImageUploadField
                id="maintenanceBackgroundImageUrl"
                label={tM("imageFile")}
                value={maintenance.backgroundImageUrl || ""}
                onChange={(value) => updateNestedField("maintenance.backgroundImageUrl", value)}
                previewAlt={translate(
                  "admin.settings.maintenance.backgroundImagePreviewAlt",
                  "Maintenance background preview",
                )}
                previewClassName="h-full w-full object-cover"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1.5">
                  <SectionTitle icon={<CalendarClock />} tone="sky">
                    {translate("admin.settings.maintenance.countdown", "Show countdown")}
                  </SectionTitle>
                  <CardDescription>
                    {translate(
                      "admin.settings.maintenance.countdownDesc",
                      "Display a live countdown until the store is expected back online.",
                    )}
                  </CardDescription>
                </div>
                <Switch
                  checked={Boolean(maintenance.countdownEnabled)}
                  aria-label={translate("admin.settings.maintenance.countdown", "Show countdown")}
                  onCheckedChange={(value) => updateNestedField("maintenance.countdownEnabled", value)}
                />
              </div>
            </CardHeader>
            {maintenance.countdownEnabled ? (
              <CardContent className="space-y-2">
                <Label htmlFor="maintenanceCountdownEndsAt">
                  {translate("admin.settings.maintenance.countdownEndsAt", "Expected back online")}
                </Label>
                <Input
                  id="maintenanceCountdownEndsAt"
                  type="datetime-local"
                  className="sm:max-w-xs"
                  value={toDateTimeLocalValue(maintenance.countdownEndsAt)}
                  onChange={(event) =>
                    updateNestedField("maintenance.countdownEndsAt", toIsoDateTime(event.target.value))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  {translate(
                    "admin.settings.maintenance.countdownEndsAtHint",
                    "Set the local date and time customers should count down to.",
                  )}
                </p>
                {countdownDate && countdownDate.getTime() < Date.now() ? (
                  <p className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                    <TriangleAlert className="size-3.5" />
                    {tM("countdownPast")}
                  </p>
                ) : null}
              </CardContent>
            ) : null}
          </Card>

          <Card>
            <CardHeader>
              <SectionTitle icon={<ShieldCheck />} tone="emerald">
                {translate("admin.settings.maintenance.allowedIPs", "Allowlisted IP addresses")}
              </SectionTitle>
              <CardDescription>{tM("allowedIPsHint2")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {allowedIPs.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {allowedIPs.map((ip) => (
                    <span
                      key={ip}
                      className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 py-1 pl-3 pr-1 font-mono text-xs text-emerald-800 dark:text-emerald-300"
                    >
                      {ip}
                      {ip === myIp ? (
                        <span className="rounded-full bg-emerald-600 px-1.5 py-0.5 font-sans text-[10px] font-semibold text-white">
                          {tM("you")}
                        </span>
                      ) : null}
                      <button
                        type="button"
                        aria-label={tM("removeIp", { ip })}
                        onClick={() => setIPs(allowedIPs.filter((item) => item !== ip))}
                        className="rounded-full p-0.5 text-emerald-700/70 transition hover:bg-emerald-600/15 hover:text-emerald-900 dark:text-emerald-300/70"
                      >
                        <X className="size-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="rounded-xl border border-dashed px-3 py-2.5 text-xs text-muted-foreground">
                  {tM("noIps")}
                </p>
              )}
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="maintenanceAllowedIps"
                  value={ipDraft}
                  placeholder="203.0.113.10"
                  className="font-mono sm:max-w-xs"
                  aria-invalid={ipError ? true : undefined}
                  onChange={(event) => {
                    setIpDraft(event.target.value);
                    setIpError(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addIps(ipDraft);
                    }
                  }}
                />
                <Button type="button" variant="outline" className="gap-1.5 rounded-full" onClick={() => addIps(ipDraft)} disabled={!ipDraft.trim()}>
                  <Plus className="size-4" />
                  {tM("addIp")}
                </Button>
                <Button type="button" variant="ghost" className="gap-1.5 rounded-full text-emerald-700 hover:text-emerald-800 dark:text-emerald-400" onClick={() => void addMyIp()} disabled={findingIp}>
                  {findingIp ? <Loader2 className="size-4 animate-spin" /> : <Wifi className="size-4" />}
                  {tM("addMyIp")}
                </Button>
              </div>
              {ipError ? <p className="text-xs text-destructive">{ipError}</p> : null}
            </CardContent>
          </Card>
        </div>

        <div className="lg:sticky lg:top-20">
                <div
                  className={cn(
                    "relative overflow-hidden rounded-2xl border p-5 shadow-sm",
                    backgroundImageUrl
                      ? "min-h-[360px] border-transparent bg-slate-950 text-white"
                      : "bg-muted/30",
                  )}
                >
                  {backgroundImageUrl ? (
                    <>
                      <div
                        aria-hidden="true"
                        className="absolute inset-0 bg-contain bg-center bg-no-repeat opacity-55"
                        style={{
                          backgroundImage: `url(${JSON.stringify(backgroundImageUrl)})`,
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/25 to-slate-950/65" />
                    </>
                  ) : null}
                  <div className="relative">
                  <p
                    className={cn(
                      "text-xs font-semibold uppercase tracking-normal",
                      backgroundImageUrl ? "text-white/80" : "text-primary",
                    )}
                  >
                    {translate("admin.settings.maintenance.preview.label", "Live Preview")}
                  </p>
                  <div className="mt-4 space-y-4">
                    <div
                      className={cn(
                        "inline-flex rounded-full border px-3 py-1 text-xs font-medium",
                        backgroundImageUrl
                          ? "border-white/25 bg-white/10 text-white"
                          : "border-primary/15 bg-primary/10 text-primary",
                      )}
                    >
                      {MAINTENANCE_COPY.status}
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-2xl font-semibold leading-tight">
                        {maintenance.title?.trim() || defaultTitle}
                      </h3>
                      <p
                        className={cn(
                          "text-sm leading-6",
                          backgroundImageUrl
                            ? "text-white/85"
                            : "text-muted-foreground",
                        )}
                      >
                        {maintenance.message?.trim() || MAINTENANCE_COPY.message}
                      </p>
                    </div>

                    {maintenance.countdownEnabled ? (
                      <div
                        className={cn(
                          "rounded-lg border p-4",
                          backgroundImageUrl
                            ? "border-white/20 bg-white/10 backdrop-blur-sm"
                            : "bg-background",
                        )}
                      >
                        <p className="text-sm font-medium">
                          {MAINTENANCE_COPY.countdownLabel}
                        </p>
                        <p
                          className={cn(
                            "mt-2 text-sm",
                            backgroundImageUrl
                              ? "text-white/75"
                              : "text-muted-foreground",
                          )}
                        >
                          {countdownEndsAt ||
                            translate(
                              "admin.settings.maintenance.preview.countdownEmpty",
                              "Choose a return time to start the countdown.",
                            )}
                        </p>
                      </div>
                    ) : (
                      <div
                        className={cn(
                          "rounded-lg border border-dashed p-4 text-sm",
                          backgroundImageUrl
                            ? "border-white/20 bg-white/10 text-white/70"
                            : "bg-background/70 text-muted-foreground",
                        )}
                      >
                        {translate(
                          "admin.settings.maintenance.preview.countdownHidden",
                          "Countdown is hidden. Visitors will only see the title and message.",
                        )}
                      </div>
                    )}

                    {(maintenance.allowedIPs || []).length > 0 ? (
                      <div
                        className={cn(
                          "rounded-lg border p-4",
                          backgroundImageUrl
                            ? "border-white/20 bg-white/10 backdrop-blur-sm"
                            : "bg-background",
                        )}
                      >
                        <p className="text-sm font-medium">
                          {translate(
                            "admin.settings.maintenance.preview.bypassTitle",
                            "Access bypass",
                          )}
                        </p>
                        <p
                          className={cn(
                            "mt-2 text-sm",
                            backgroundImageUrl
                              ? "text-white/75"
                              : "text-muted-foreground",
                          )}
                        >
                          {t("admin.settings.maintenance.preview.bypassCount", {
                            count: maintenance.allowedIPs?.length ?? 0,
                          })}
                        </p>
                      </div>
                    ) : null}
                  </div>
                  </div>
                </div>
        </div>
      </div>

      <StickySaveFooter
        label={t("admin.settings.maintenance.save")}
        isSaving={isSaving}
        isDirty={isDirty}
        onSave={onSave}
      />
    </div>
  );
}
