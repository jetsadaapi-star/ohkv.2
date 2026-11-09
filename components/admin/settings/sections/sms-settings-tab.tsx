"use client";

import { useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  Bell,
  CircleAlert,
  CircleCheck,
  Info,
  Loader2,
  Lock,
  MessageSquareText,
  RadioTower,
  Send,
  Smartphone,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import Link from "@/components/language/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { WarningBanner } from "@/components/ui/warning-banner";
import { CountrySelect } from "@/components/common/country-multi-select";
import { SecretInput } from "@/components/admin/settings/fields/secret-input";
import { EnvSourceHint } from "@/components/admin/settings/fields/env-source-hint";
import { Segmented } from "@/components/admin/settings/fields/segmented";
import {
  SettingList,
  SettingRow,
  SettingSwitchItem,
} from "@/components/admin/settings/fields/setting-row";
import { useCredentialMeta } from "@/components/admin/settings/fields/use-credential-meta";
import { isSmsConfigured } from "@/components/admin/settings/settings-sections";
import type { Settings } from "@/components/admin/settings/types";
import type { SmsTestResult } from "@/components/admin/settings/use-admin-settings";
import {
  countryCodeForValue,
  countryNameForCode,
} from "@/lib/intl/country-availability";
import { countSmsNotifications } from "@/lib/notifications/notification-settings";
import {
  isAlphanumericSender,
  isMessagingServiceSid,
  isTwilioAccountSid,
  isValidSmsSender,
} from "@/lib/sms/sms-format";
import { cn } from "@/lib/utils";
import { useAppSettings } from "@/providers/app-settings-provider";
import { DeliveryLogs, type LogRetentionDays } from "../delivery-logs";
import { SettingsTabHeader } from "./settings-tab-header";
import { SectionTitle } from "@/components/admin/form-sections";
import { SmsMessagePreview } from "./sms-message-preview";
import { StickySaveFooter } from "./sticky-save-footer";

const linkClass = "text-primary font-medium hover:underline";
const cautionClass = "text-amber-700 dark:text-amber-400";

type Twilio = NonNullable<Settings["sms"]["twilio"]>;
type SmsEnv = { accountSid?: boolean; authToken?: boolean; messagingServiceSid?: boolean; fromNumber?: boolean };
type SenderMode = "service" | "number";
type SmsProvider = "twilio" | "thaibulksms";

/**
 * Settings → SMS (Twilio): the switch, the Twilio account texts go out
 * through, how a text reads, and the log of what went out.
 *
 * With SMS off and nothing ever sent, the page is its header. The sender is
 * one choice and one field: a Messaging Service SID and a From number used to
 * sit side by side as if both were needed, while a saved service quietly won
 * over any number. A test answers on the page, with Twilio's reason when it
 * refuses. The header says how many events actually text, and says so loudly
 * when none do — nothing went out either way before, and the page was silent.
 */
export function SmsSettingsTab(props: {
  settings: Settings;
  /** The copy last saved: what Twilio is set up with right now. */
  savedSettings: Settings;
  isSaving: boolean;
  isDirty: boolean;
  isTestingSms: boolean;
  testSmsTo: string;
  setTestSmsTo: (value: string) => void;
  updateNestedField: (path: string, value: unknown) => void;
  onSave: () => void | Promise<unknown>;
  onDiscard?: () => void;
  onTestSms: () => Promise<SmsTestResult | undefined>;
  /** Saves the log's retention at once, apart from the page's form. */
  onSaveRetention: (days: LogRetentionDays) => void | Promise<unknown>;
}) {
  const t = useTranslations("admin.settings.sms");
  const tSettings = useTranslations("admin.settings");
  const { settings, savedSettings, updateNestedField } = props;
  const sms = settings.sms ?? { enabled: false };
  const twilio: Twilio = sms.twilio ?? {};
  const env: SmsEnv | undefined = settings._meta?.envSources?.sms;
  const credential = useCredentialMeta(settings);
  const enabled = Boolean(sms.enabled);
  const provider: SmsProvider = sms.provider === "thaibulksms" ? "thaibulksms" : "twilio";
  // What the test and the notifications go through: the saved copy.
  const ready = isSmsConfigured(savedSettings);
  const events = countSmsNotifications(savedSettings.notifications);
  const envReady = Boolean(
    env?.accountSid && env?.authToken && (env?.messagingServiceSid || env?.fromNumber),
  );
  const [logRefresh, setLogRefresh] = useState(0);

  const sidMeta = credential("sms.twilio.accountSid");
  const tokenMeta = credential("sms.twilio.authToken");
  const [sidTouched, setSidTouched] = useState(false);
  const sid = twilio.accountSid || "";
  const sidInvalid = sidTouched && sid.trim() !== "" && !isTwilioAccountSid(sid);

  const originCode = countryCodeForValue(settings.shipping?.origin?.country);
  const originName = originCode ? (countryNameForCode(originCode) ?? originCode) : undefined;

  const notificationsLink = (chunks: ReactNode) => (
    <Link href="/admin/settings/notifications" className={linkClass}>
      {chunks}
    </Link>
  );

  const headerNote = enabled ? (
    !ready ? (
      <HeaderNote icon={Bell}>
        {t.rich("eventsAfterSave", { link: notificationsLink })}
      </HeaderNote>
    ) : events > 0 ? (
      <HeaderNote icon={Bell}>
        {t.rich("eventsCount", { count: events, link: notificationsLink })}
      </HeaderNote>
    ) : (
      <WarningBanner>{t.rich("eventsNone", { link: notificationsLink })}</WarningBanner>
    )
  ) : envReady ? (
    <HeaderNote icon={Lock}>{t("offEnvReady")}</HeaderNote>
  ) : null;

  return (
    <div className="space-y-4">
      <SettingsTabHeader
        icon={<MessageSquareText />}
        tone="sky"
        title={t("title")}
        description={enabled ? t("description") : t("descriptionOff")}
        control={
          <Switch
            className="mt-1"
            checked={enabled}
            aria-label={t("title")}
            onCheckedChange={(on) => updateNestedField("sms.enabled", on)}
          />
        }
      >
        {headerNote}
      </SettingsTabHeader>

      {enabled ? (
        <>
          <ProviderPicker
            value={provider}
            onChange={(next) => updateNestedField("sms.provider", next)}
          />

          {provider === "thaibulksms" ? (
            <ThaiBulkSmsAccountCard
              settings={settings}
              isDirty={props.isDirty}
              ready={ready}
              updateNestedField={updateNestedField}
              testRow={
                <TestRow
                  blocked={props.isDirty ? "dirty" : !ready ? "setup" : null}
                  isTesting={props.isTestingSms}
                  to={props.testSmsTo}
                  setTo={props.setTestSmsTo}
                  placeholder="0812345678"
                  onTest={async () => {
                    const result = await props.onTestSms();
                    setLogRefresh((count) => count + 1);
                    return result;
                  }}
                />
              }
            />
          ) : (
          <Card>
            <CardHeader>
              <SectionTitle icon={<span className="text-[11px] font-extrabold">Tw</span>} tone="rose">{t("accountTitle")}</SectionTitle>
              <CardDescription>
                {t.rich("accountDescription", {
                  link: (chunks) => (
                    <a
                      href="https://console.twilio.com"
                      target="_blank"
                      rel="noreferrer"
                      className={linkClass}
                    >
                      {chunks}
                    </a>
                  ),
                })}
              </CardDescription>
              {sidMeta.set || tokenMeta.set ? (
                <CardAction>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // null removes a stored secret on save; Discard brings it back.
                      updateNestedField("sms.twilio.accountSid", null);
                      updateNestedField("sms.twilio.authToken", null);
                    }}
                  >
                    {t("disconnect")}
                  </Button>
                </CardAction>
              ) : null}
            </CardHeader>
            <CardContent>
              <SettingList>
                <SettingRow inputId="twilioAccountSid" label={t("accountSid")} align="start">
                  <div className="w-full space-y-1.5">
                    <SecretInput
                      id="twilioAccountSid"
                      value={sid}
                      onChange={(value) => updateNestedField("sms.twilio.accountSid", value)}
                      onBlur={() => setSidTouched(true)}
                      invalid={sidInvalid}
                      secretSet={sidMeta.set}
                      maskedHint={sidMeta.hint}
                      placeholderWhenUnset="AC…"
                      revealTyped
                    />
                    {sidInvalid ? (
                      <p className="text-destructive text-xs">{t("accountSidInvalid")}</p>
                    ) : null}
                    <EnvSourceHint show={Boolean(env?.accountSid)} />
                  </div>
                </SettingRow>

                <SettingRow
                  inputId="twilioAuthToken"
                  label={t("authToken")}
                  hint={t("authTokenHint")}
                  align="start"
                >
                  <div className="w-full space-y-1.5">
                    <SecretInput
                      id="twilioAuthToken"
                      value={twilio.authToken || ""}
                      onChange={(value) => updateNestedField("sms.twilio.authToken", value)}
                      secretSet={tokenMeta.set}
                      maskedHint={tokenMeta.hint}
                      placeholderWhenUnset={t("authTokenPlaceholder")}
                    />
                    <EnvSourceHint show={Boolean(env?.authToken)} />
                  </div>
                </SettingRow>

                <SenderRow
                  twilio={twilio}
                  env={env}
                  isDirty={props.isDirty}
                  updateNestedField={updateNestedField}
                />

                <TestRow
                  blocked={props.isDirty ? "dirty" : !ready ? "setup" : null}
                  isTesting={props.isTestingSms}
                  to={props.testSmsTo}
                  setTo={props.setTestSmsTo}
                  onTest={async () => {
                    const result = await props.onTestSms();
                    // The test went through the outbox, so the log has a new row.
                    setLogRefresh((count) => count + 1);
                    return result;
                  }}
                />
              </SettingList>
            </CardContent>
          </Card>
          )}

          <Card>
            <CardHeader>
              <SectionTitle icon={<MessageSquareText />} tone="violet">{t("messagesTitle")}</SectionTitle>
            </CardHeader>
            <CardContent>
              <SettingList>
                <SettingRow
                  inputId="smsDefaultCountry"
                  label={t("defaultCountry")}
                  hint={t("defaultCountryHint")}
                  align="start"
                >
                  <CountrySelect
                    id="smsDefaultCountry"
                    value={sms.defaultCountry || ""}
                    onChange={(country) => updateNestedField("sms.defaultCountry", country)}
                    valueFormat="code"
                    restrictToAvailableCountries={false}
                    clearable
                    triggerClassName="w-full"
                    placeholder={
                      originName
                        ? t("defaultCountryOrigin", { country: originName })
                        : t("defaultCountryNone")
                    }
                  />
                </SettingRow>
                <div>
                  <SettingSwitchItem
                    title={t("includeLinks")}
                    description={t("includeLinksHint")}
                    checked={sms.includeLinks !== false}
                    onCheckedChange={(on) => updateNestedField("sms.includeLinks", on)}
                  />
                  <SmsMessagePreview
                    storeName={settings.general?.storeName}
                    orderPrefix={settings.orders?.prefix}
                    includeLink={sms.includeLinks !== false}
                  />
                </div>
              </SettingList>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <SectionTitle icon={<Smartphone />} tone="emerald">{t("phoneLogin.title")}</SectionTitle>
              <CardDescription>{t("phoneLogin.description")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {!ready ? <WarningBanner>{t("phoneLogin.needsSms")}</WarningBanner> : null}
              <SettingList>
                <SettingSwitchItem
                  title={t("phoneLogin.enabled")}
                  description={t("phoneLogin.enabledHint")}
                  checked={Boolean(sms.phoneLogin?.enabled)}
                  onCheckedChange={(on) =>
                    updateNestedField("sms.phoneLogin", {
                      enabled: on,
                      allowSignUp: sms.phoneLogin?.allowSignUp !== false,
                    })
                  }
                />
                <SettingSwitchItem
                  title={t("phoneLogin.allowSignUp")}
                  description={t("phoneLogin.allowSignUpHint")}
                  checked={sms.phoneLogin?.allowSignUp !== false}
                  disabled={!sms.phoneLogin?.enabled}
                  onCheckedChange={(on) =>
                    updateNestedField("sms.phoneLogin", {
                      enabled: Boolean(sms.phoneLogin?.enabled),
                      allowSignUp: on,
                    })
                  }
                />
              </SettingList>
              <ul className="list-disc space-y-1 ps-5 text-xs text-muted-foreground">
                <li>{t("phoneLogin.noteCost")}</li>
                <li>{t("phoneLogin.noteStaff")}</li>
                <li>{t("phoneLogin.noteExisting")}</li>
              </ul>
            </CardContent>
          </Card>
        </>
      ) : null}

      <StickySaveFooter
        label={tSettings("general.save")}
        isSaving={props.isSaving}
        isDirty={props.isDirty}
        onSave={props.onSave}
        onDiscard={props.onDiscard}
      />

      {/* With SMS off, a log with nothing in it is left out with the rest. */}
      <DeliveryLogs
        kind="sms"
        retentionDays={sms.logRetentionDays ?? 30}
        onRetentionDaysChange={props.onSaveRetention}
        hideWhenEmpty={!enabled}
        refreshKey={logRefresh}
      />
    </div>
  );
}

function HeaderNote(props: { icon: LucideIcon; children: ReactNode }) {
  const Icon = props.icon;
  return (
    <p className="text-muted-foreground flex items-start gap-2 text-sm">
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>{props.children}</span>
    </p>
  );
}

/**
 * Who a text comes from: a Messaging Service (Twilio picks a number for each
 * country), or one number or name. A saved service is used whenever one is
 * set (`sendTwilioMessage`), so choosing a number takes the service out of
 * the form, and choosing the service again before saving puts it back.
 */
/** The store's name as an alphanumeric sender ID: letters and digits, at most 11. */
function senderIdExample(storeName: string) {
  return storeName.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 11) || "MYSTORE";
}

function SenderRow(props: {
  twilio: Twilio;
  env: SmsEnv | undefined;
  isDirty: boolean;
  updateNestedField: (path: string, value: unknown) => void;
}) {
  const t = useTranslations("admin.settings.sms");
  const { storeName } = useAppSettings();
  const { env, updateNestedField } = props;
  const serviceSid = props.twilio.messagingServiceSid || "";
  const fromNumber = props.twilio.fromNumber || "";
  const stored: SenderMode = serviceSid.trim()
    ? "service"
    : fromNumber.trim() || (env?.fromNumber && !env?.messagingServiceSid)
      ? "number"
      : "service";

  const [choice, setChoice] = useState<SenderMode | null>(null);
  const [wasDirty, setWasDirty] = useState(props.isDirty);
  if (wasDirty !== props.isDirty) {
    setWasDirty(props.isDirty);
    // Saved or discarded: the form holds stored values again, and so does this.
    if (!props.isDirty) setChoice(null);
  }
  const mode: SenderMode = serviceSid.trim() ? "service" : (choice ?? stored);
  const parkedServiceSid = useRef("");
  const [touched, setTouched] = useState(false);

  const value = mode === "service" ? serviceSid : fromNumber;
  const invalid =
    touched &&
    value.trim() !== "" &&
    (mode === "service" ? !isMessagingServiceSid(value) : !isValidSmsSender(value));
  const isName = mode === "number" && isAlphanumericSender(fromNumber);

  const pick = (next: SenderMode) => {
    if (next === mode) return;
    setChoice(next);
    setTouched(false);
    if (next === "number" && serviceSid) {
      parkedServiceSid.current = serviceSid;
      updateNestedField("sms.twilio.messagingServiceSid", "");
    }
    if (next === "service" && !serviceSid && parkedServiceSid.current) {
      updateNestedField("sms.twilio.messagingServiceSid", parkedServiceSid.current);
    }
  };

  return (
    <SettingRow
      inputId="twilioSender"
      label={<span id="twilioSenderLabel">{t("sender")}</span>}
      hint={
        <>
          <span className="block">
            {mode === "service" ? t("senderServiceHint") : t("senderNumberHint")}
          </span>
          {isName ? (
            <span className="text-foreground mt-2 flex items-start gap-2">
              <Info aria-hidden className="text-muted-foreground mt-0.5 size-4 shrink-0" />
              <span>{t("senderNameNote")}</span>
            </span>
          ) : null}
        </>
      }
      align="start"
    >
      <div className="w-full space-y-2">
        <Segmented
          labelledBy="twilioSenderLabel"
          value={mode}
          options={[
            { id: "service", label: t("senderService") },
            { id: "number", label: t("senderNumber") },
          ]}
          onChange={pick}
          className="grid-cols-2"
        />
        <Input
          id="twilioSender"
          value={value}
          onChange={(event) =>
            updateNestedField(
              mode === "service" ? "sms.twilio.messagingServiceSid" : "sms.twilio.fromNumber",
              event.target.value,
            )
          }
          onBlur={() => setTouched(true)}
          aria-invalid={invalid || undefined}
          placeholder={mode === "service" ? "MG…" : t("senderNumberPlaceholder", { senderId: senderIdExample(storeName) })}
          autoComplete="off"
          spellCheck={false}
        />
        {invalid ? (
          <p className="text-destructive text-xs">
            {mode === "service" ? t("senderServiceInvalid") : t("senderNumberInvalid")}
          </p>
        ) : null}
        <EnvSourceHint
          show={mode === "service" ? Boolean(env?.messagingServiceSid) : Boolean(env?.fromNumber)}
        />
        {mode === "number" && env?.messagingServiceSid ? (
          <p className={cn("text-xs", cautionClass)}>{t("senderEnvServiceWins")}</p>
        ) : null}
      </div>
    </SettingRow>
  );
}

/**
 * One real text through the saved settings. It is refused while the form
 * holds an edit (the credentials never reach the browser, so the old ones
 * would be tested), and the button says so up front instead of a toast after.
 */
function TestRow(props: {
  blocked: "dirty" | "setup" | null;
  isTesting: boolean;
  to: string;
  setTo: (value: string) => void;
  onTest: () => Promise<SmsTestResult | undefined>;
  placeholder?: string;
}) {
  const t = useTranslations("admin.settings.sms");
  const [result, setResult] = useState<SmsTestResult | null>(null);
  const { blocked } = props;

  return (
    <div>
      <SettingRow
        inputId="smsTestTo"
        label={t("testLabel")}
        hint={
          blocked ? (
            <span className={cautionClass}>
              {blocked === "dirty" ? t("testSaveFirst") : t("testSetupFirst")}
            </span>
          ) : (
            t("testHint")
          )
        }
        align="start"
      >
        <div className="flex w-full items-center gap-2">
          <Input
            id="smsTestTo"
            type="tel"
            className="min-w-0 flex-1"
            value={props.to}
            onChange={(event) => {
              props.setTo(event.target.value);
              setResult(null);
            }}
            placeholder={props.placeholder ?? "+8801712345678"}
          />
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            disabled={Boolean(blocked) || props.isTesting || !props.to.trim()}
            onClick={async () => setResult((await props.onTest()) ?? null)}
          >
            {props.isTesting ? <Loader2 className="animate-spin" /> : <Send />}
            {t("testButton")}
          </Button>
        </div>
      </SettingRow>
      {result && !blocked ? (
        <p
          role={result.ok ? "status" : "alert"}
          className={cn(
            "flex items-start gap-2 px-4 pb-4 text-sm",
            result.ok ? "text-emerald-700 dark:text-emerald-400" : "text-destructive",
          )}
        >
          {result.ok ? (
            <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
          ) : (
            <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          )}
          <span>{result.ok ? t("testSent", { to: result.to || props.to }) : result.message}</span>
        </p>
      ) : null}
    </div>
  );
}

/**
 * Which provider texts go out through: two cards, the chosen one ringed. Each
 * keeps its own saved credentials, so switching back and forth loses nothing.
 */
function ProviderPicker(props: { value: SmsProvider; onChange: (next: SmsProvider) => void }) {
  const t = useTranslations("admin.settings.sms");
  const options: Array<{ id: SmsProvider; name: string; note: string; mark: string; tone: string }> = [
    {
      id: "thaibulksms",
      name: "ThaiBulkSMS",
      note: t("providerThaiBulkSmsNote"),
      mark: "TB",
      tone: "bg-sky-500",
    },
    {
      id: "twilio",
      name: "Twilio",
      note: t("providerTwilioNote"),
      mark: "Tw",
      tone: "bg-rose-500",
    },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5 text-base font-bold">
          <span className="flex size-8 items-center justify-center rounded-xl bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300">
            <RadioTower className="size-4" />
          </span>
          {t("providerTitle")}
        </CardTitle>
        <CardDescription>{t("providerDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <div role="radiogroup" aria-label={t("providerTitle")} className="grid gap-3 sm:grid-cols-2">
          {options.map((option) => {
            const active = props.value === option.id;
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => props.onChange(option.id)}
                className={cn(
                  "flex items-start gap-3 rounded-2xl border p-4 text-start transition-all",
                  active
                    ? "border-emerald-400 bg-emerald-50/60 ring-2 ring-emerald-400/30 dark:bg-emerald-500/10"
                    : "hover:border-foreground/20 hover:bg-muted/40",
                )}
              >
                <span
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold text-white shadow-sm",
                    option.tone,
                  )}
                >
                  {option.mark}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 font-bold">
                    {option.name}
                    {active ? <CircleCheck className="size-4 text-emerald-600" /> : null}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{option.note}</span>
                </span>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * The ThaiBulkSMS account: API Key and Secret (Settings → API Key in its
 * dashboard), the registered sender name, which credit a text is billed to,
 * a credit check, and the same test as Twilio's.
 */
function ThaiBulkSmsAccountCard(props: {
  settings: Settings;
  isDirty: boolean;
  ready: boolean;
  updateNestedField: (path: string, value: unknown) => void;
  testRow: ReactNode;
}) {
  const t = useTranslations("admin.settings.sms");
  const { settings, updateNestedField } = props;
  const credential = useCredentialMeta(settings);
  const tbs = settings.sms?.thaibulksms ?? {};
  const keyMeta = credential("sms.thaibulksms.apiKey");
  const secretMeta = credential("sms.thaibulksms.apiSecret");
  const keysSaved = keyMeta.set && secretMeta.set;

  const [credit, setCredit] = useState<
    { state: "idle" } | { state: "loading" } | { state: "ok"; values: Record<string, number> } | { state: "error"; message: string }
  >({ state: "idle" });
  const checkCredit = async () => {
    setCredit({ state: "loading" });
    try {
      const response = await fetch("/api/admin/settings/sms-credit", { cache: "no-store" });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.success) {
        setCredit({ state: "error", message: json?.message || t("creditFailed") });
        return;
      }
      setCredit({ state: "ok", values: (json.data?.credit ?? {}) as Record<string, number> });
    } catch {
      setCredit({ state: "error", message: t("creditFailed") });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5 text-base font-bold">
          <span className="flex size-8 items-center justify-center rounded-xl bg-sky-500 text-xs font-extrabold text-white">
            TB
          </span>
          {t("thaibulksmsTitle")}
        </CardTitle>
        <CardDescription>
          {t.rich("thaibulksmsDescription", {
            link: (chunks) => (
              <a
                href="https://dashboard.thaibulksms.com/developer-settings/"
                target="_blank"
                rel="noreferrer"
                className={linkClass}
              >
                {chunks}
              </a>
            ),
          })}
        </CardDescription>
        {keyMeta.set || secretMeta.set ? (
          <CardAction>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => {
                // null removes a stored secret on save; Discard brings it back.
                updateNestedField("sms.thaibulksms.apiKey", null);
                updateNestedField("sms.thaibulksms.apiSecret", null);
              }}
            >
              {t("disconnect")}
            </Button>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent>
        <SettingList>
          <SettingRow inputId="tbsApiKey" label={t("thaibulksmsApiKey")} align="start">
            <SecretInput
              id="tbsApiKey"
              value={tbs.apiKey || ""}
              onChange={(value) => updateNestedField("sms.thaibulksms.apiKey", value)}
              secretSet={keyMeta.set}
              maskedHint={keyMeta.hint}
              placeholderWhenUnset={t("thaibulksmsApiKeyPlaceholder")}
              revealTyped
            />
          </SettingRow>
          <SettingRow inputId="tbsApiSecret" label={t("thaibulksmsApiSecret")} align="start">
            <SecretInput
              id="tbsApiSecret"
              value={tbs.apiSecret || ""}
              onChange={(value) => updateNestedField("sms.thaibulksms.apiSecret", value)}
              secretSet={secretMeta.set}
              maskedHint={secretMeta.hint}
              placeholderWhenUnset={t("thaibulksmsApiSecretPlaceholder")}
            />
          </SettingRow>
          <SettingRow
            inputId="tbsSender"
            label={t("thaibulksmsSender")}
            hint={t("thaibulksmsSenderHint")}
            align="start"
          >
            <Input
              id="tbsSender"
              value={tbs.sender || ""}
              onChange={(event) => updateNestedField("sms.thaibulksms.sender", event.target.value)}
              placeholder={t("thaibulksmsSenderPlaceholder")}
              autoComplete="off"
              spellCheck={false}
            />
          </SettingRow>
          <SettingRow
            inputId="tbsForce"
            label={<span id="tbsForceLabel">{t("thaibulksmsForce")}</span>}
            hint={t("thaibulksmsForceHint")}
            align="start"
          >
            <Segmented
              labelledBy="tbsForceLabel"
              value={tbs.force === "corporate" ? "corporate" : "standard"}
              options={[
                { id: "standard", label: t("thaibulksmsForceStandard") },
                { id: "corporate", label: t("thaibulksmsForceCorporate") },
              ]}
              onChange={(next) => updateNestedField("sms.thaibulksms.force", next)}
              className="grid-cols-2"
            />
          </SettingRow>
          <SettingRow
            inputId="tbsCredit"
            label={t("creditLabel")}
            hint={
              !keysSaved || props.isDirty ? (
                <span className={cautionClass}>{t("creditSaveFirst")}</span>
              ) : (
                t("creditHint")
              )
            }
            align="start"
          >
            <div className="w-full space-y-2">
              <Button
                id="tbsCredit"
                type="button"
                variant="outline"
                className="rounded-full"
                disabled={!keysSaved || props.isDirty || credit.state === "loading"}
                onClick={() => void checkCredit()}
              >
                {credit.state === "loading" ? <Loader2 className="animate-spin" /> : <Wallet />}
                {t("creditButton")}
              </Button>
              {credit.state === "ok" ? (
                Object.keys(credit.values).length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(credit.values).map(([key, value]) => (
                      <span
                        key={key}
                        className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30"
                      >
                        <span className="text-xs font-medium opacity-80">{creditLabelFor(key, {
                          standard: t("thaibulksmsForceStandard"),
                          corporate: t("thaibulksmsForceCorporate"),
                          remaining: t("creditRemaining"),
                        })}</span>
                        <span className="tabular-nums">{value.toLocaleString()}</span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">{t("creditEmpty")}</p>
                )
              ) : credit.state === "error" ? (
                <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
                  <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
                  {credit.message}
                </p>
              ) : null}
            </div>
          </SettingRow>
          {props.testRow}
        </SettingList>
      </CardContent>
    </Card>
  );
}

/** A credit figure's name: the two the manual names in words, others as sent. */
function creditLabelFor(
  key: string,
  labels: { standard: string; corporate: string; remaining: string },
) {
  const last = key.split(".").pop() || key;
  if (/standard/i.test(key)) return labels.standard;
  if (/corporate/i.test(key)) return labels.corporate;
  if (last === "remaining_credit" || last === "credit") return labels.remaining;
  return last.replace(/_/g, " ");
}
