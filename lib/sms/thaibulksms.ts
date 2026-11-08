/**
 * ThaiBulkSMS API v2, spoken directly over `fetch` — the Thai provider beside
 * Twilio (Settings → SMS).
 *
 * From the provider's developer manual (API v2.0):
 *   - POST https://api-v2.thaibulksms.com/sms   sends a text
 *   - GET  https://api-v2.thaibulksms.com/credit reads the credit left
 *   - both authenticate with HTTP Basic: the API Key as the user name and the
 *     API Secret as the password (Settings → API Key in the ThaiBulkSMS
 *     dashboard)
 *   - `msisdn` takes 0812345678, 66812345678 or +66812345678; `sender` is a
 *     sender name registered on the account, spelled exactly; `force` picks
 *     the credit the text is billed to, "standard" or "corporate"
 *   - success answers with `phone_number_list[].message_id` and the
 *     `remaining_credit`; a refusal answers `{ "error": { code, name,
 *     description } }` with an HTTP status that says whether to try again.
 */

const API_BASE = "https://api-v2.thaibulksms.com";
/** One send may not hold a cron batch or a request's `after()` hostage. */
const REQUEST_TIMEOUT_MS = 15_000;

export const THAIBULKSMS_CREDIT_TYPES = ["standard", "corporate"] as const;
export type ThaiBulkSmsCreditType = (typeof THAIBULKSMS_CREDIT_TYPES)[number];

export interface ResolvedThaiBulkSmsConfig {
  apiKey: string;
  apiSecret: string;
  /** A sender name registered on the ThaiBulkSMS account, spelled exactly. */
  sender: string;
  force: ThaiBulkSmsCreditType;
}

/**
 * The provider's error codes an admin can act on, in the words they need.
 * The rest fall back to the provider's own description.
 */
const ERROR_HINTS: Record<number, string> = {
  100: "ThaiBulkSMS rejected the API Key or API Secret.",
  101: "This ThaiBulkSMS API key has been suspended.",
  102: "ThaiBulkSMS has suspended the server's IP address.",
  104: "The server's IP address is not on the API key's IP whitelist in ThaiBulkSMS.",
  106: "The ThaiBulkSMS account has been blocked.",
  108: "A ThaiBulkSMS trial account can only text the phone number it registered with.",
  109: "The credit type must be standard or corporate.",
  110: "The sender name is not valid.",
  111: "The sender name is not registered on this ThaiBulkSMS account — it must match exactly, capitals included.",
  112: "The message is not valid.",
  113: "The message is too long.",
  114: "The recipient's phone number is not valid.",
  116: "The ThaiBulkSMS account is out of credit. Top it up, then retry.",
  128: "This ThaiBulkSMS API key has been disabled.",
};

export function describeThaiBulkSmsError(code: number | undefined, fallback?: string): string {
  const hint = code !== undefined ? ERROR_HINTS[code] : undefined;
  const base = hint || fallback || "ThaiBulkSMS could not send the message.";
  return code !== undefined ? `${base} (ThaiBulkSMS error ${code})` : base;
}

export class ThaiBulkSmsApiError extends Error {
  /** HTTP status, or 0 when the request never got an answer. */
  readonly status: number;
  /** ThaiBulkSMS's own status code (100, 111, 116 …) when it sent one. */
  readonly code?: number;

  constructor(params: { message: string; status: number; code?: number }) {
    super(params.message);
    this.name = "ThaiBulkSmsApiError";
    this.status = params.status;
    this.code = params.code;
  }

  /**
   * Whether the same request can never succeed. A refused key, sender or
   * number stays refused; running out of credit (423) is cured by a top-up,
   * and the provider's 5xx failures are its own and pass.
   */
  get permanent(): boolean {
    if (this.status === 423 || this.status === 0 || this.status >= 500) return false;
    return this.status >= 400;
  }
}

function basicAuth(config: Pick<ResolvedThaiBulkSmsConfig, "apiKey" | "apiSecret">) {
  return `Basic ${Buffer.from(`${config.apiKey}:${config.apiSecret}`).toString("base64")}`;
}

async function request(
  path: string,
  config: Pick<ResolvedThaiBulkSmsConfig, "apiKey" | "apiSecret">,
  init: { method: "GET" | "POST"; body?: URLSearchParams },
): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: init.method,
      headers: {
        Authorization: basicAuth(config),
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      },
      body: init.body?.toString(),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    throw new ThaiBulkSmsApiError({
      message:
        error instanceof Error && error.name === "TimeoutError"
          ? "ThaiBulkSMS did not answer in time."
          : "Could not reach ThaiBulkSMS.",
      status: 0,
    });
  }

  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  const error =
    payload && typeof payload.error === "object" && payload.error !== null
      ? (payload.error as { code?: unknown; description?: unknown })
      : null;
  if (!response.ok || error) {
    const code = error && Number.isFinite(Number(error.code)) ? Number(error.code) : undefined;
    throw new ThaiBulkSmsApiError({
      message: describeThaiBulkSmsError(
        code,
        typeof error?.description === "string" ? error.description : undefined,
      ),
      status: response.ok ? 400 : response.status,
      code,
    });
  }
  return payload ?? {};
}

/** Send one text. The number is E.164 (+66…), which the API accepts as is. */
export async function sendThaiBulkSms(
  config: ResolvedThaiBulkSmsConfig,
  message: { to: string; body: string },
): Promise<{ messageId?: string; creditsUsed?: number; remainingCredit?: number }> {
  const body = new URLSearchParams({
    msisdn: message.to,
    message: message.body,
    sender: config.sender,
    force: config.force,
  });
  const payload = await request("/sms", config, { method: "POST", body });

  const sent = Array.isArray(payload.phone_number_list)
    ? (payload.phone_number_list as Array<{ message_id?: unknown; used_credit?: unknown }>)
    : [];
  const bad = Array.isArray(payload.bad_phone_number_list)
    ? (payload.bad_phone_number_list as Array<{ message?: unknown }>)
    : [];
  // One recipient per call: a number the provider set aside is this text failing.
  if (sent.length === 0 && bad.length > 0) {
    throw new ThaiBulkSmsApiError({
      message: describeThaiBulkSmsError(
        114,
        typeof bad[0]?.message === "string" ? bad[0].message : undefined,
      ),
      status: 400,
      code: 114,
    });
  }
  const first = sent[0];
  return {
    messageId: typeof first?.message_id === "string" ? first.message_id : undefined,
    creditsUsed: Number.isFinite(Number(first?.used_credit)) ? Number(first?.used_credit) : undefined,
    remainingCredit: Number.isFinite(Number(payload.remaining_credit))
      ? Number(payload.remaining_credit)
      : undefined,
  };
}

/**
 * The credit left on the account. The manual documents the call (GET /credit,
 * Basic auth, no parameters) but not the answer's field names, so every
 * numeric credit field it returns is read, keyed by its own name.
 */
export async function getThaiBulkSmsCredit(
  config: Pick<ResolvedThaiBulkSmsConfig, "apiKey" | "apiSecret">,
): Promise<Record<string, number>> {
  const payload = await request("/credit", config, { method: "GET" });
  const out: Record<string, number> = {};
  const visit = (value: unknown, prefix: string) => {
    if (typeof value === "number" && Number.isFinite(value)) {
      out[prefix] = value;
    } else if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
      out[prefix] = Number(value);
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
        visit(inner, prefix ? `${prefix}.${key}` : key);
      }
    }
  };
  visit(payload, "");
  return out;
}
