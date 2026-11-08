"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { WarningBanner } from "@/components/ui/warning-banner";
import { toast } from "@/components/ui/toast-notification";
import {
  AlertTriangle,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  KeyRound,
  ShieldCheck,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { AppleIcon, FacebookIcon, GoogleIcon, LineIcon, XIcon } from "@/components/auth/oauth-icons";
import { extraOAuthStatus } from "@/components/admin/settings/settings-sections";
import type { Settings } from "@/components/admin/settings/types";
import { SecretInput } from "@/components/admin/settings/fields/secret-input";
import { useCredentialMeta } from "@/components/admin/settings/fields/use-credential-meta";
import { EnvSourceHint } from "@/components/admin/settings/fields/env-source-hint";
import {
  ProviderCard,
  StatusBadge,
} from "@/components/admin/settings/fields/provider-card";
import {
  buildOAuthCallbackUrl,
  type OAuthProviderId,
} from "@/lib/auth/oauth-callback";
import { SettingsTabHeader } from "./settings-tab-header";
import { StickySaveFooter } from "./sticky-save-footer";

type TSafe = (
  key: string,
  fallback: string,
  values?: Record<string, unknown>,
) => string;

/**
 * `window.location.origin`, read without tripping hydration: the server has no
 * origin to render, so it starts empty and settles on the real one on the
 * client. Only used to *compare* against the configured base URL — the URLs an
 * admin copies always come from the server's own value.
 */
const subscribeToNothing = () => () => {};
const readBrowserOrigin = () => window.location.origin;
const readNoOrigin = () => "";

/** Where an admin goes to mint the credentials this screen asks for. */
const CONSOLE_URLS = {
  google: "https://console.cloud.google.com/apis/credentials",
  facebook: "https://developers.facebook.com/apps",
  line: "https://developers.line.biz/console/",
  twitter: "https://developer.x.com/en/portal/dashboard",
  apple: "https://developer.apple.com/account/resources/identifiers/list/serviceId",
} as const satisfies Record<OAuthProviderId, string>;

/** Each provider's mark, for its card, its console button and its guide. */
const PROVIDER_ICON: Record<OAuthProviderId, (props: { className?: string }) => ReactNode> = {
  google: GoogleIcon,
  facebook: FacebookIcon,
  line: LineIcon,
  twitter: XIcon,
  apple: AppleIcon,
};

export function OAuthSettingsTab(props: {
  settings: Settings;
  isSaving: boolean;
  isDirty: boolean;
  isTestingOAuth?: boolean;
  updateField: (path: string, value: unknown) => void;
  onSave: () => void | Promise<unknown>;
  onVerify?: (provider: OAuthProviderId) => void | Promise<unknown>;
}) {
  const t = useTranslations();
  const security = props.settings.security;
  const env = props.settings._meta?.envSources?.security;
  const cred = useCredentialMeta(props.settings);

  const tSafe: TSafe = (key, fallback, values) => {
    try {
      const translate = t as unknown as (
        k: string,
        v?: Record<string, unknown>,
      ) => string;
      const res = translate(key, values);
      return typeof res === "string" && res !== key ? res : fallback;
    } catch {
      return fallback;
    }
  };

  // The server publishes the origin Better Auth actually signs in through
  // (BETTER_AUTH_URL → NEXT_PUBLIC_APP_URL). Only fall back to the browser's own
  // origin when that is missing, so a store reached through a preview domain
  // still shows the URL the provider will really be handed.
  const configuredOrigin = props.settings._meta?.authBaseUrl || "";
  const browserOrigin = useSyncExternalStore(
    subscribeToNothing,
    readBrowserOrigin,
    readNoOrigin,
  );
  const origin = configuredOrigin || browserOrigin;
  const originMismatch = Boolean(
    configuredOrigin && browserOrigin && configuredOrigin !== browserOrigin,
  );

  const googleEnabled = Boolean(security.googleOAuthEnabled);
  const facebookEnabled = Boolean(security.facebookOAuthEnabled);

  const googleConfigured =
    (cred("security.googleClientId").set || Boolean(env?.googleClientId)) &&
    (cred("security.googleClientSecret").set ||
      Boolean(env?.googleClientSecret));
  const facebookConfigured =
    (cred("security.facebookAppId").set || Boolean(env?.facebookAppId)) &&
    (cred("security.facebookAppSecret").set ||
      Boolean(env?.facebookAppSecret));

  const extra = extraOAuthStatus(props.settings);
  const extraOf = (id: "line" | "twitter" | "apple") => extra.find((entry) => entry.id === id)!;
  const enabledCount =
    [googleEnabled, facebookEnabled].filter(Boolean).length +
    extra.filter((entry) => entry.enabled).length;

  // Shown on a switched-off provider that already has `.env` credentials, which
  // otherwise looks like nothing is configured at all. `ProviderCard` wraps the
  // note in its own paragraph, so this stays a string rather than `EnvSourceHint`.
  const envNote = tSafe(
    "admin.settings.oauth.envCredentials",
    "Credentials for this provider are set via environment variables — turn it on to use them.",
  );

  const verifyButton = (provider: OAuthProviderId, configured: boolean) => {
    if (!props.onVerify) return null;
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => props.onVerify?.(provider)}
        disabled={props.isSaving || props.isTestingOAuth || !configured}
      >
        {props.isTestingOAuth ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <ShieldCheck className="mr-2 h-4 w-4" />
        )}
        {tSafe("admin.settings.oauth.verify", "Verify credentials")}
      </Button>
    );
  };

  return (
    <div className="space-y-4">
      <SettingsTabHeader
        icon={<KeyRound />}
        tone="indigo"
        title={t("admin.settings.oauth.title")}
        description={t("admin.settings.oauth.description")}
        meta={
          <Badge variant="secondary">
            {tSafe("admin.settings.oauth.activeCount", `${enabledCount} active`, {
              count: enabledCount,
            })}
          </Badge>
        }
      />

      {originMismatch ? (
        <WarningBanner>
          {tSafe(
            "admin.settings.oauth.originMismatch",
            `You are browsing on ${browserOrigin}, but sign-in runs on ${configuredOrigin}. Register the URLs shown below — or point BETTER_AUTH_URL / NEXT_PUBLIC_APP_URL at the domain you actually use.`,
            { browser: browserOrigin, configured: configuredOrigin },
          )}
        </WarningBanner>
      ) : null}

      <ProviderCard
        logo={<GoogleIcon className="h-8 w-8" />}
        title={t("admin.settings.oauth.google.label")}
        description={t("admin.settings.oauth.google.description")}
        enabled={googleEnabled}
        onToggle={(v) => props.updateField("security.googleOAuthEnabled", v)}
        badges={<StatusBadge configured={googleConfigured} />}
        note={
          !googleEnabled && (env?.googleClientId || env?.googleClientSecret)
            ? envNote
            : null
        }
        testButton={verifyButton("google", googleConfigured)}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <SecretInput
              id="googleClientId"
              label={t("admin.settings.oauth.google.clientId")}
              value={security.googleClientId || ""}
              onChange={(v) => props.updateField("security.googleClientId", v)}
              onClear={() => props.updateField("security.googleClientId", null)}
              secretSet={cred("security.googleClientId").set}
              maskedHint={cred("security.googleClientId").hint}
              placeholderWhenUnset="1234567890-abc.apps.googleusercontent.com"
              helperText={t("admin.settings.fields.savedKeysHint")}
              revealTyped
            />
            <EnvSourceHint show={Boolean(env?.googleClientId)} />
          </div>
          <div className="space-y-2">
            <SecretInput
              id="googleClientSecret"
              label={t("admin.settings.oauth.google.clientSecret")}
              value={security.googleClientSecret || ""}
              onChange={(v) =>
                props.updateField("security.googleClientSecret", v)
              }
              onClear={() =>
                props.updateField("security.googleClientSecret", null)
              }
              secretSet={cred("security.googleClientSecret").set}
              maskedHint={cred("security.googleClientSecret").hint}
              placeholderWhenUnset="GOCSPX-..."
              helperText={t("admin.settings.fields.savedSecretsHint")}
            />
            <EnvSourceHint show={Boolean(env?.googleClientSecret)} />
          </div>
        </div>

        <RedirectUriBlock
          tSafe={tSafe}
          provider="google"
          origin={origin}
          showJavaScriptOrigin
        />

        <SetupGuide
          tSafe={tSafe}
          provider="google"
          configured={googleConfigured}
          consoleLabel={tSafe(
            "admin.settings.oauth.google.openConsole",
            "Open Google Cloud Console",
          )}
          steps={googleSteps(tSafe, origin)}
        />
      </ProviderCard>

      <ProviderCard
        logo={<FacebookIcon className="h-8 w-8" />}
        title={t("admin.settings.oauth.facebook.label")}
        description={t("admin.settings.oauth.facebook.description")}
        enabled={facebookEnabled}
        onToggle={(v) => props.updateField("security.facebookOAuthEnabled", v)}
        badges={<StatusBadge configured={facebookConfigured} />}
        note={
          !facebookEnabled && (env?.facebookAppId || env?.facebookAppSecret)
            ? envNote
            : null
        }
        testButton={verifyButton("facebook", facebookConfigured)}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <SecretInput
              id="facebookAppId"
              label={t("admin.settings.oauth.facebook.appId")}
              value={security.facebookAppId || ""}
              onChange={(v) => props.updateField("security.facebookAppId", v)}
              onClear={() => props.updateField("security.facebookAppId", null)}
              secretSet={cred("security.facebookAppId").set}
              maskedHint={cred("security.facebookAppId").hint}
              placeholderWhenUnset={t("admin.settings.oauth.facebook.appIdPlaceholder")}
              helperText={t("admin.settings.fields.savedKeysHint")}
              revealTyped
            />
            <EnvSourceHint show={Boolean(env?.facebookAppId)} />
          </div>
          <div className="space-y-2">
            <SecretInput
              id="facebookAppSecret"
              label={t("admin.settings.oauth.facebook.appSecret")}
              value={security.facebookAppSecret || ""}
              onChange={(v) =>
                props.updateField("security.facebookAppSecret", v)
              }
              onClear={() =>
                props.updateField("security.facebookAppSecret", null)
              }
              secretSet={cred("security.facebookAppSecret").set}
              maskedHint={cred("security.facebookAppSecret").hint}
              helperText={t("admin.settings.fields.savedSecretsHint")}
            />
            <EnvSourceHint show={Boolean(env?.facebookAppSecret)} />
          </div>
        </div>

        <RedirectUriBlock tSafe={tSafe} provider="facebook" origin={origin} />

        <SetupGuide
          tSafe={tSafe}
          provider="facebook"
          configured={facebookConfigured}
          consoleLabel={tSafe(
            "admin.settings.oauth.facebook.openConsole",
            "Open Meta for Developers",
          )}
          steps={facebookSteps(tSafe, origin)}
        />
      </ProviderCard>

      <ProviderCard
        logo={<LineIcon className="h-8 w-8" />}
        title={tSafe("admin.settings.oauth.line.label", "LINE")}
        description={tSafe(
          "admin.settings.oauth.line.description",
          "Let shoppers sign in with their LINE account — the app most Thai shoppers already use.",
        )}
        enabled={extraOf("line").enabled}
        onToggle={(v) => props.updateField("security.lineOAuthEnabled", v)}
        badges={<StatusBadge configured={extraOf("line").configured} />}
        testButton={verifyButton("line", extraOf("line").configured)}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <PlainIdField
            id="lineChannelId"
            label={tSafe("admin.settings.oauth.line.channelId", "Channel ID")}
            value={security.lineChannelId || ""}
            placeholder="1650000000"
            onChange={(v) => props.updateField("security.lineChannelId", v)}
            envSet={Boolean(env?.lineChannelId)}
          />
          <div className="space-y-2">
            <SecretInput
              id="lineChannelSecret"
              label={tSafe("admin.settings.oauth.line.channelSecret", "Channel secret")}
              value={security.lineChannelSecret || ""}
              onChange={(v) => props.updateField("security.lineChannelSecret", v)}
              onClear={() => props.updateField("security.lineChannelSecret", null)}
              secretSet={cred("security.lineChannelSecret").set}
              maskedHint={cred("security.lineChannelSecret").hint}
              helperText={t("admin.settings.fields.savedSecretsHint")}
            />
            <EnvSourceHint show={Boolean(env?.lineChannelSecret)} />
          </div>
        </div>
        <RedirectUriBlock tSafe={tSafe} provider="line" origin={origin} />
        <SetupGuide
          tSafe={tSafe}
          provider="line"
          configured={extraOf("line").configured}
          consoleLabel={tSafe("admin.settings.oauth.line.openConsole", "Open LINE Developers")}
          steps={lineSteps(tSafe, origin)}
        />
      </ProviderCard>

      <ProviderCard
        logo={<AppleIcon className="h-8 w-8" />}
        title={tSafe("admin.settings.oauth.apple.label", "Apple")}
        description={tSafe(
          "admin.settings.oauth.apple.description",
          "Sign in with Apple — expected by iPhone users, and it can hide their real email behind a relay address.",
        )}
        enabled={extraOf("apple").enabled}
        onToggle={(v) => props.updateField("security.appleOAuthEnabled", v)}
        badges={<StatusBadge configured={extraOf("apple").configured} />}
        testButton={verifyButton("apple", extraOf("apple").configured)}
      >
        <div className="grid gap-4 md:grid-cols-3">
          <PlainIdField
            id="appleServiceId"
            label={tSafe("admin.settings.oauth.apple.serviceId", "Services ID")}
            value={security.appleServiceId || ""}
            placeholder="com.example.shop.signin"
            onChange={(v) => props.updateField("security.appleServiceId", v)}
            envSet={Boolean(env?.appleServiceId)}
          />
          <PlainIdField
            id="appleTeamId"
            label={tSafe("admin.settings.oauth.apple.teamId", "Team ID")}
            value={security.appleTeamId || ""}
            placeholder="A1B2C3D4E5"
            onChange={(v) => props.updateField("security.appleTeamId", v)}
            envSet={Boolean(env?.appleTeamId)}
          />
          <PlainIdField
            id="appleKeyId"
            label={tSafe("admin.settings.oauth.apple.keyId", "Key ID")}
            value={security.appleKeyId || ""}
            placeholder="ABC123DEFG"
            onChange={(v) => props.updateField("security.appleKeyId", v)}
            envSet={Boolean(env?.appleKeyId)}
          />
        </div>
        <div className="space-y-2">
          <SecretInput
            id="applePrivateKey"
            label={tSafe("admin.settings.oauth.apple.privateKey", "Private key (.p8)")}
            value={security.applePrivateKey || ""}
            onChange={(v) => props.updateField("security.applePrivateKey", v)}
            onClear={() => props.updateField("security.applePrivateKey", null)}
            secretSet={cred("security.applePrivateKey").set}
            maskedHint={cred("security.applePrivateKey").hint}
            placeholderWhenUnset="-----BEGIN PRIVATE KEY-----…"
            helperText={tSafe(
              "admin.settings.oauth.apple.privateKeyHint",
              "Paste the whole .p8 file. The client secret Apple asks for is signed from it automatically and renewed for you.",
            )}
          />
          <EnvSourceHint show={Boolean(env?.applePrivateKey)} />
        </div>
        <RedirectUriBlock tSafe={tSafe} provider="apple" origin={origin} showDomain />
        <SetupGuide
          tSafe={tSafe}
          provider="apple"
          configured={extraOf("apple").configured}
          consoleLabel={tSafe("admin.settings.oauth.apple.openConsole", "Open Apple Developer")}
          steps={appleSteps(tSafe, origin)}
        />
      </ProviderCard>

      <ProviderCard
        logo={<XIcon className="h-8 w-8" />}
        title={tSafe("admin.settings.oauth.twitter.label", "X (Twitter)")}
        description={tSafe(
          "admin.settings.oauth.twitter.description",
          "Let shoppers sign in with their X account.",
        )}
        enabled={extraOf("twitter").enabled}
        onToggle={(v) => props.updateField("security.twitterOAuthEnabled", v)}
        badges={<StatusBadge configured={extraOf("twitter").configured} />}
        testButton={verifyButton("twitter", extraOf("twitter").configured)}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <PlainIdField
            id="twitterClientId"
            label={tSafe("admin.settings.oauth.twitter.clientId", "OAuth 2.0 Client ID")}
            value={security.twitterClientId || ""}
            placeholder="aBcDeFgHiJ…"
            onChange={(v) => props.updateField("security.twitterClientId", v)}
            envSet={Boolean(env?.twitterClientId)}
          />
          <div className="space-y-2">
            <SecretInput
              id="twitterClientSecret"
              label={tSafe("admin.settings.oauth.twitter.clientSecret", "Client secret")}
              value={security.twitterClientSecret || ""}
              onChange={(v) => props.updateField("security.twitterClientSecret", v)}
              onClear={() => props.updateField("security.twitterClientSecret", null)}
              secretSet={cred("security.twitterClientSecret").set}
              maskedHint={cred("security.twitterClientSecret").hint}
              helperText={t("admin.settings.fields.savedSecretsHint")}
            />
            <EnvSourceHint show={Boolean(env?.twitterClientSecret)} />
          </div>
        </div>
        <RedirectUriBlock tSafe={tSafe} provider="twitter" origin={origin} />
        <SetupGuide
          tSafe={tSafe}
          provider="twitter"
          configured={extraOf("twitter").configured}
          consoleLabel={tSafe("admin.settings.oauth.twitter.openConsole", "Open X Developer Portal")}
          steps={twitterSteps(tSafe, origin)}
        />
      </ProviderCard>

      <StickySaveFooter
        label={t("admin.settings.oauth.save")}
        isSaving={props.isSaving}
        isDirty={props.isDirty}
        onSave={props.onSave}
      />
    </div>
  );
}

/**
 * The redirect URI the provider has to have on file, plus — for Google — the
 * JavaScript origin its console asks for on the same form.
 *
 * Both providers compare the redirect URI they receive against the registered
 * one character for character, so this is a copy button rather than something
 * an admin retypes, and it is built from the server's own base URL rather than
 * from `window.location`.
 */
function RedirectUriBlock(props: {
  tSafe: TSafe;
  provider: OAuthProviderId;
  origin: string;
  showJavaScriptOrigin?: boolean;
  /** Apple also asks for the bare domain the return URL lives on. */
  showDomain?: boolean;
}) {
  const { tSafe, origin, provider } = props;
  if (!origin) return null;

  const callbackUrl = buildOAuthCallbackUrl(origin, provider);
  const isHttps = /^https:\/\//i.test(origin);
  const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(
    origin,
  );
  // Google accepts `http://localhost` for development and nothing else
  // unencrypted; Meta accepts neither, so a store still on localhost has to
  // finish this step from its live domain or an HTTPS tunnel.
  const usable = provider === "google" ? isHttps || isLocalhost : isHttps;

  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
      <CopyableUrl
        tSafe={tSafe}
        id={`${provider}-redirect-uri`}
        label={tSafe(
          "admin.settings.oauth.redirectUri",
          "Authorized redirect URI",
        )}
        value={callbackUrl}
      />
      {props.showJavaScriptOrigin ? (
        <CopyableUrl
          tSafe={tSafe}
          id={`${provider}-js-origin`}
          label={tSafe(
            "admin.settings.oauth.javascriptOrigin",
            "Authorized JavaScript origin",
          )}
          value={origin}
        />
      ) : null}
      {props.showDomain ? (
        <CopyableUrl
          tSafe={tSafe}
          id={`${provider}-domain`}
          label={tSafe("admin.settings.oauth.domain", "Domain")}
          value={hostOf(origin)}
        />
      ) : null}
      <p className="text-xs text-muted-foreground">
        {tSafe(
          "admin.settings.oauth.redirectUriHint",
          "Paste this into the provider's console exactly as shown — sign-in is rejected on any difference, including a trailing slash.",
        )}
      </p>
      {usable ? null : (
        <p className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-500">
          <AlertTriangle className="mt-px size-3.5 shrink-0" />
          {provider !== "google" && provider !== "facebook"
            ? tSafe(
                "admin.settings.oauth.httpsRequiredOther",
                "This provider only accepts a public HTTPS callback URL — localhost is refused. Open this page on your live domain, or an HTTPS tunnel, before registering it.",
              )
            : provider === "google"
            ? tSafe(
                "admin.settings.oauth.httpsRequiredGoogle",
                "Google only accepts an HTTPS redirect URI (http://localhost is the one exception). Open this page on your live domain before registering it.",
              )
            : tSafe(
                "admin.settings.oauth.httpsRequiredFacebook",
                "Meta only accepts a public HTTPS redirect URI — localhost is refused. Open this page on your live domain, or an HTTPS tunnel, before registering it.",
              )}
        </p>
      )}
    </div>
  );
}

function CopyableUrl(props: {
  tSafe: TSafe;
  id: string;
  label: string;
  value: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(props.value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(
        props.tSafe("admin.settings.oauth.copyFailed", "Unable to copy the URL"),
      );
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={props.id}>{props.label}</Label>
      <div className="flex gap-2">
        <Input
          id={props.id}
          value={props.value}
          readOnly
          onFocus={(event) => event.currentTarget.select()}
          className="font-mono text-xs"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => void copy()}
          aria-label={props.tSafe("admin.settings.oauth.copy", "Copy")}
        >
          {copied ? <Check className="text-emerald-600" /> : <Copy />}
        </Button>
      </div>
    </div>
  );
}

/**
 * Collapsed once the provider is configured, open while it is not — the steps
 * matter exactly once, and the credentials above are what an admin returns for.
 */
function SetupGuide(props: {
  tSafe: TSafe;
  provider: OAuthProviderId;
  configured: boolean;
  consoleLabel: string;
  steps: ReactNode[];
}) {
  return (
    <Accordion
      type="single"
      collapsible
      defaultValue={props.configured ? undefined : "guide"}
      className="rounded-lg border px-4"
    >
      <AccordionItem value="guide">
        <AccordionTrigger className="text-sm">
          {props.tSafe(
            "admin.settings.oauth.setupGuide",
            "How to set this up (step by step)",
          )}
        </AccordionTrigger>
        <AccordionContent className="space-y-4">
          <Button asChild type="button" variant="outline" size="sm">
            <a
              href={CONSOLE_URLS[props.provider]}
              target="_blank"
              rel="noopener noreferrer"
            >
              {(() => {
                const Icon = PROVIDER_ICON[props.provider];
                return <Icon className="mr-2 h-4 w-4" />;
              })()}
              {props.consoleLabel}
              <ExternalLink className="ml-2 h-3.5 w-3.5" />
            </a>
          </Button>
          <ol className="list-decimal space-y-2 pl-5 text-xs text-muted-foreground marker:text-foreground">
            {props.steps.map((step, index) => (
              <li key={index}>{step}</li>
            ))}
          </ol>
          <p className="text-xs text-muted-foreground">
            {props.tSafe(
              "admin.settings.oauth.verifyHint",
              "Verify credentials checks the ID and secret with the provider. Whether the redirect URI is registered can only be proven by a real sign-in.",
            )}
          </p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

/** Rendered inside the steps so a URL is never mistaken for prose. */
function Mono({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px] break-all text-foreground">
      {children}
    </code>
  );
}

function googleSteps(tSafe: TSafe, origin: string): ReactNode[] {
  const callbackUrl = origin ? buildOAuthCallbackUrl(origin, "google") : "";
  return [
    tSafe(
      "admin.settings.oauth.google.step1",
      "Open the Google Cloud Console and select an existing project, or create one for this store.",
    ),
    tSafe(
      "admin.settings.oauth.google.step2",
      "Under APIs & Services → OAuth consent screen, fill in the app name, support email and authorized domain, then publish the app. While it stays in Testing, only the test users you list can sign in.",
    ),
    tSafe(
      "admin.settings.oauth.google.step3",
      "Go to Credentials → Create credentials → OAuth client ID and choose Web application as the type.",
    ),
    <span key="origin">
      {tSafe(
        "admin.settings.oauth.google.step4",
        "Under Authorized JavaScript origins, add:",
      )}{" "}
      <Mono>{origin}</Mono>
    </span>,
    <span key="redirect">
      {tSafe(
        "admin.settings.oauth.google.step5",
        "Under Authorized redirect URIs, add:",
      )}{" "}
      <Mono>{callbackUrl}</Mono>
    </span>,
    tSafe(
      "admin.settings.oauth.google.step6",
      "Copy the Client ID and Client secret into the fields above, save, then press Verify credentials. New Google clients can take a few minutes to become active.",
    ),
  ];
}

function facebookSteps(tSafe: TSafe, origin: string): ReactNode[] {
  const callbackUrl = origin ? buildOAuthCallbackUrl(origin, "facebook") : "";
  let host = "";
  try {
    host = origin ? new URL(origin).hostname : "";
  } catch {
    host = "";
  }

  return [
    tSafe(
      "admin.settings.oauth.facebook.step1",
      "Open Meta for Developers → My Apps → Create app, and pick the use case “Authenticate and request data from users with Facebook Login”.",
    ),
    tSafe(
      "admin.settings.oauth.facebook.step2",
      "Add the Facebook Login product to the app, then open Facebook Login → Settings.",
    ),
    <span key="redirect">
      {tSafe(
        "admin.settings.oauth.facebook.step3",
        "Turn on Client OAuth login and Web OAuth login, and add this under Valid OAuth Redirect URIs:",
      )}{" "}
      <Mono>{callbackUrl}</Mono>
    </span>,
    <span key="basic">
      {tSafe(
        "admin.settings.oauth.facebook.step4",
        "In App settings → Basic, set the Site URL to",
      )}{" "}
      <Mono>{origin}</Mono>
      {host ? (
        <>
          {" "}
          {tSafe("admin.settings.oauth.facebook.step4b", "and add")}{" "}
          <Mono>{host}</Mono>{" "}
          {tSafe(
            "admin.settings.oauth.facebook.step4c",
            "under App domains. A Privacy Policy URL is also required before Meta will let the app go live.",
          )}
        </>
      ) : null}
    </span>,
    tSafe(
      "admin.settings.oauth.facebook.step5",
      "Copy the App ID and App Secret into the fields above, save, then press Verify credentials.",
    ),
    tSafe(
      "admin.settings.oauth.facebook.step6",
      "Switch the app from Development to Live. Until you do, only people with a role on the app can sign in with Facebook.",
    ),
  ];
}

function hostOf(origin: string): string {
  try {
    return new URL(origin).hostname;
  } catch {
    return "";
  }
}

/** An identifier the admin has to read back against the console: shown in clear. */
function PlainIdField(props: {
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  envSet: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={props.id}>{props.label}</Label>
      <Input
        id={props.id}
        value={props.value}
        placeholder={props.placeholder}
        onChange={(event) => props.onChange(event.target.value)}
        autoComplete="off"
        spellCheck={false}
        className="font-mono text-sm"
      />
      <EnvSourceHint show={props.envSet} />
    </div>
  );
}

function lineSteps(tSafe: TSafe, origin: string): ReactNode[] {
  const callbackUrl = origin ? buildOAuthCallbackUrl(origin, "line") : "";
  return [
    tSafe(
      "admin.settings.oauth.line.step1",
      "Open LINE Developers, choose a provider (or create one), then Create a new channel → LINE Login, with Web app as the app type.",
    ),
    <span key="callback">
      {tSafe("admin.settings.oauth.line.step2", "Under LINE Login → Callback URL, add:")}{" "}
      <Mono>{callbackUrl}</Mono>
    </span>,
    tSafe(
      "admin.settings.oauth.line.step3",
      "Under Basic settings → OpenID Connect, apply for Email address permission. Until LINE approves it, shoppers can still sign in, and add their email to their account afterwards.",
    ),
    tSafe(
      "admin.settings.oauth.line.step4",
      "Copy the Channel ID and Channel secret from Basic settings into the fields above, save, then press Verify credentials.",
    ),
    tSafe(
      "admin.settings.oauth.line.step5",
      "Publish the channel. While it stays in Developing, only the channel's admins and testers can sign in.",
    ),
  ];
}

function twitterSteps(tSafe: TSafe, origin: string): ReactNode[] {
  const callbackUrl = origin ? buildOAuthCallbackUrl(origin, "twitter") : "";
  return [
    tSafe(
      "admin.settings.oauth.twitter.step1",
      "Open the X Developer Portal, select (or create) a project and app, then open User authentication settings → Set up.",
    ),
    tSafe(
      "admin.settings.oauth.twitter.step2",
      "Set App permissions to Read, switch on Request email from users, and choose Web App, Automated App or Bot as the type of app.",
    ),
    <span key="callback">
      {tSafe("admin.settings.oauth.twitter.step3", "Under Callback URI / Redirect URL, add:")}{" "}
      <Mono>{callbackUrl}</Mono>{" "}
      {tSafe("admin.settings.oauth.twitter.step3b", "and set the Website URL to")} <Mono>{origin}</Mono>
    </span>,
    tSafe(
      "admin.settings.oauth.twitter.step4",
      "Save, then copy the OAuth 2.0 Client ID and Client Secret (Keys and tokens → OAuth 2.0) into the fields above, save, and press Verify credentials. The API Key and Secret are a different pair and will not work here.",
    ),
  ];
}

function appleSteps(tSafe: TSafe, origin: string): ReactNode[] {
  const callbackUrl = origin ? buildOAuthCallbackUrl(origin, "apple") : "";
  return [
    tSafe(
      "admin.settings.oauth.apple.step1",
      "In Apple Developer → Certificates, Identifiers & Profiles → Identifiers, make sure your App ID has Sign in with Apple enabled.",
    ),
    tSafe(
      "admin.settings.oauth.apple.step2",
      "Create a Services ID (Identifiers → +, Services IDs). Its identifier is the Services ID above.",
    ),
    <span key="return">
      {tSafe(
        "admin.settings.oauth.apple.step3",
        "Enable Sign in with Apple on the Services ID → Configure: pick your App ID, add the domain",
      )}{" "}
      <Mono>{hostOf(origin)}</Mono>{" "}
      {tSafe("admin.settings.oauth.apple.step3b", "and the return URL")} <Mono>{callbackUrl}</Mono>
    </span>,
    tSafe(
      "admin.settings.oauth.apple.step4",
      "Under Keys, create a key with Sign in with Apple enabled, download the .p8 file (Apple lets you download it once), and note its Key ID.",
    ),
    tSafe(
      "admin.settings.oauth.apple.step5",
      "Enter the Team ID (top right of the developer account), the Key ID and the contents of the .p8 file above, save, then press Verify credentials.",
    ),
  ];
}
