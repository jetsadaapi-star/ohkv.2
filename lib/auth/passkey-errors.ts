/**
 * A passkey refusal, by its code, as a message key under
 * `account.passkeys.errors` — or null for one with no message of its own.
 * Codes come from the server (lib/auth/passkey-login.ts, the plugin) and from
 * the browser's WebAuthn errors (@simplewebauthn/browser).
 */
const KEYS: Record<string, string> = {
  PASSKEY_LOGIN_DISABLED: "disabled",
  PASSKEY_VERIFICATION_REQUIRED: "verificationRequired",
  PASSKEY_NOT_FOUND: "notFound",
  AUTHENTICATION_FAILED: "failed",
  ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED: "alreadyRegistered",
  PREVIOUSLY_REGISTERED: "alreadyRegistered",
  ERROR_INVALID_DOMAIN: "domain",
  ERROR_INVALID_RP_ID: "domain",
  ACCOUNT_INACTIVE_OR_BANNED: "inactive",
  EMAIL_NOT_VERIFIED: "emailNotVerified",
  BIZ_APP_OPERATORS_ONLY: "failed",
};

export function passkeyErrorMessageKey(code: string | undefined | null): string | null {
  return code ? (KEYS[code] ?? null) : null;
}

/** The browser was asked and the person closed it: say nothing. */
export function isPasskeyCancel(code: string | undefined | null): boolean {
  return code === "ERROR_CEREMONY_ABORTED" || code === "AUTH_CANCELLED" || code === "NotAllowedError";
}

const noSubscribe = () => () => {};

/**
 * Whether this browser can make and use passkeys, for `useSyncExternalStore`:
 * false on the server and in the first render, so hydration matches.
 */
export const webAuthnSupport = {
  subscribe: noSubscribe,
  get: () => typeof window !== "undefined" && typeof window.PublicKeyCredential === "function",
  server: () => false,
};

/** The code on an auth client error, when it has one. */
export function passkeyErrorCode(error: unknown): string | undefined {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" ? code : undefined;
}
