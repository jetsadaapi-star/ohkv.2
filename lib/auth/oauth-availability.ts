import type { ISecuritySettings } from "@/models/settings.model";
import { resolveOAuthCredentials } from "@/lib/settings/credentials";

/**
 * Whether LINE, X and Apple sign-in can be offered: the admin's switch on AND
 * credentials that resolve (DB first, `.env` as the fallback), the same rule
 * `buildSocialProviders` applies — a button never shows for a provider Better
 * Auth was not given. Shared by the login pages and /api/settings/public.
 */
export function newOAuthProviderFlags(security?: Partial<ISecuritySettings> | null) {
  const oauth = resolveOAuthCredentials(security);
  return {
    lineOAuthEnabled:
      Boolean(security?.lineOAuthEnabled) && Boolean(oauth.line.channelId && oauth.line.channelSecret),
    twitterOAuthEnabled:
      Boolean(security?.twitterOAuthEnabled) &&
      Boolean(oauth.twitter.clientId && oauth.twitter.clientSecret),
    appleOAuthEnabled:
      Boolean(security?.appleOAuthEnabled) &&
      Boolean(oauth.apple.serviceId && oauth.apple.teamId && oauth.apple.keyId && oauth.apple.privateKey),
  };
}
