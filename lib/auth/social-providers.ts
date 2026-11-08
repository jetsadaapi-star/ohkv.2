import { resolveOAuthCredentials } from "@/lib/settings/credentials";
import { createAppleClientSecret } from "@/lib/auth/apple-client-secret";

/** What Better Auth is handed for one OAuth provider. */
type SocialProviderConfig = {
  clientId: string;
  clientSecret: string;
  /** Set: the provider signs in through the redirect flow only. */
  disableIdTokenSignIn?: true;
  /** Fills in what a provider left out of the profile (see `placeholderEmail`). */
  mapProfileToUser?: (profile: never) => Record<string, unknown> | Promise<Record<string, unknown>>;
};

/**
 * An address for an account whose provider would not share one. LINE gives
 * an email only to channels LINE has approved for it, and X only when the
 * account has a confirmed one and the app asked; without an address Better
 * Auth refuses the sign-in outright. `.invalid` is reserved (RFC 2606): it can
 * never deliver, never collide with a real shopper's address, and so can
 * never link to someone else's account. The shopper adds a real one later.
 */
function placeholderEmail(provider: "line" | "x", id: string): string {
  const safe = id.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64) || "user";
  return `${provider}-${safe}@oauth.invalid`.toLowerCase();
}

/** The slice of the security settings that decides which providers are on. */
type SocialProviderSettings = {
  googleOAuthEnabled: boolean;
  googleClientId?: string;
  googleClientSecret?: string;
  facebookOAuthEnabled: boolean;
  facebookAppId?: string;
  facebookAppSecret?: string;
  lineOAuthEnabled?: boolean;
  lineChannelId?: string;
  lineChannelSecret?: string;
  twitterOAuthEnabled?: boolean;
  twitterClientId?: string;
  twitterClientSecret?: string;
  appleOAuthEnabled?: boolean;
  appleServiceId?: string;
  appleTeamId?: string;
  appleKeyId?: string;
  applePrivateKey?: string;
};

/**
 * The OAuth providers a store has switched on, in the shape Better Auth takes.
 *
 * Credentials come from two sources: DB settings win, .env is the per-field
 * fallback. The admin toggle is the single source of truth for whether a
 * provider is active — .env only supplies credentials, it never auto-enables
 * the provider (otherwise the admin could not disable it).
 *
 * The storefront signs in through the redirect flow. Google also accepts an ID
 * token posted to `/sign-in/social`: the shopper app's native "Continue with
 * Google", where the phone's Google SDK signs the shopper in and hands the app
 * a token (the app gets the client ID from `GET /config`, `auth.google`).
 * Better Auth checks the token's signature against Google's keys, its issuer,
 * its age, and that its audience is `clientId`: the store's own web client.
 * The phone SDKs are given that same client ID (`webClientId` on Android,
 * `serverClientID` on iOS), so the token they issue names it as its audience;
 * a token Google issued to any other app is refused. The Android and iOS
 * OAuth clients only identify the app to Google and are never an audience.
 *
 * That door is guarded like the redirect flow: the session hook's
 * customer-only rule covers `/sign-in/social` too (`isOAuthCallbackPath`), so
 * an ID token opens a shopper's session and nothing else. An admin, vendor or
 * staff account is refused there, which is what keeps it from skipping its
 * second factor (the two-factor challenge only runs on credential sign-ins).
 * Facebook keeps the redirect flow only: the app has no Facebook sign-in, and
 * an unused door stays shut.
 */
export function buildSocialProviders(
  settings: SocialProviderSettings,
): Record<string, SocialProviderConfig> {
  const oauth = resolveOAuthCredentials(settings);
  const providers: Record<string, SocialProviderConfig> = {};

  if (
    oauth.google.clientId &&
    oauth.google.clientSecret &&
    settings.googleOAuthEnabled
  ) {
    providers.google = {
      clientId: oauth.google.clientId,
      clientSecret: oauth.google.clientSecret,
    };
  }

  if (
    oauth.facebook.appId &&
    oauth.facebook.appSecret &&
    settings.facebookOAuthEnabled
  ) {
    providers.facebook = {
      clientId: oauth.facebook.appId,
      clientSecret: oauth.facebook.appSecret,
      disableIdTokenSignIn: true,
    };
  }

  // LINE, X and Apple sign in through the redirect flow only, as Facebook
  // does: the shopper app has no native button for them, and an unused door
  // stays shut.
  if (settings.lineOAuthEnabled && oauth.line.channelId && oauth.line.channelSecret) {
    providers.line = {
      clientId: oauth.line.channelId,
      clientSecret: oauth.line.channelSecret,
      disableIdTokenSignIn: true,
      mapProfileToUser: ((profile: { email?: string; sub?: string; userId?: string }) =>
        profile.email ? {} : { email: placeholderEmail("line", String(profile.sub || profile.userId || "")) }) as never,
    };
  }

  if (settings.twitterOAuthEnabled && oauth.twitter.clientId && oauth.twitter.clientSecret) {
    providers.twitter = {
      clientId: oauth.twitter.clientId,
      clientSecret: oauth.twitter.clientSecret,
      disableIdTokenSignIn: true,
      mapProfileToUser: ((profile: { data?: { id?: string; email?: string } }) =>
        profile.data?.email ? {} : { email: placeholderEmail("x", String(profile.data?.id || "")) }) as never,
    };
  }

  if (
    settings.appleOAuthEnabled &&
    oauth.apple.serviceId &&
    oauth.apple.teamId &&
    oauth.apple.keyId &&
    oauth.apple.privateKey
  ) {
    try {
      providers.apple = {
        clientId: oauth.apple.serviceId,
        clientSecret: createAppleClientSecret({
          teamId: oauth.apple.teamId,
          keyId: oauth.apple.keyId,
          serviceId: oauth.apple.serviceId,
          privateKey: oauth.apple.privateKey,
        }),
        disableIdTokenSignIn: true,
      };
    } catch (error) {
      // A key that will not parse leaves Apple off rather than taking every
      // other sign-in down with it; Settings → OAuth's Verify says why.
      console.error("Sign in with Apple is off: the private key could not be used.", error);
    }
  }

  return providers;
}
