import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { ValidationError } from "@/lib/api/errors";
import type { IChannelConnection } from "@/models/channel-connection.model";
import { decryptMessagingSecret } from "@/lib/conversations/secret-box";

/**
 * The LINE Messaging API, for a store's LINE Official Account.
 *
 * Credentials are the channel's long-lived access token (the Bearer for every
 * call) and the channel secret (which signs every webhook body). Both are
 * issued in the LINE Developers console and stored encrypted.
 */

const LINE_API = "https://api.line.me";
/** Message content is served from a separate host. */
const LINE_DATA_API = "https://api-data.line.me";

/** LINE refuses a text message longer than this. */
const LINE_TEXT_LIMIT = 5000;

/**
 * A Messaging API failure with its status kept, so the outbox can tell a dead
 * token from a rate limit from a message LINE will never accept.
 */
export class LineApiError extends Error {
  readonly status: number;
  readonly retryAfterSeconds?: number;

  constructor(params: { message: string; status: number; retryAfterSeconds?: number }) {
    super(params.message);
    this.name = "LineApiError";
    this.status = params.status;
    this.retryAfterSeconds = params.retryAfterSeconds;
  }

  /** The access token is invalid, expired or reissued. */
  get isAuthFailure() {
    return this.status === 401;
  }

  /** Too many requests, or the monthly message quota is spent. */
  get isThrottled() {
    return this.status === 429;
  }

  /**
   * 400 is a message LINE rejects (bad payload, a user who has blocked the
   * OA or never added it), 403 a plan that may not use this endpoint, 404 an
   * unknown user. None improves by waiting; 5xx and network faults do.
   */
  get isPermanent() {
    if (this.isThrottled) return false;
    if (this.isAuthFailure) return true;
    return this.status === 400 || this.status === 403 || this.status === 404;
  }
}

function lineAccessToken(connection: IChannelConnection) {
  return decryptMessagingSecret(connection.accessTokenEncrypted);
}

async function lineRequest<T>(params: {
  token: string;
  method: "GET" | "POST" | "PUT";
  path: string;
  body?: unknown;
  /** Makes a retried push idempotent: LINE answers 409 instead of sending twice. */
  retryKey?: string;
}): Promise<T> {
  const response = await fetch(`${LINE_API}${params.path}`, {
    method: params.method,
    headers: {
      Authorization: `Bearer ${params.token}`,
      ...(params.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(params.retryKey ? { "X-Line-Retry-Key": params.retryKey } : {}),
    },
    body: params.body !== undefined ? JSON.stringify(params.body) : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  const payload = (await response.json().catch(() => null)) as
    | (T & { message?: string; details?: Array<{ message?: string; property?: string }> })
    | null;
  // A retried push LINE already accepted: the first attempt delivered it.
  if (response.status === 409 && params.retryKey) {
    return (payload ?? {}) as T;
  }
  if (!response.ok) {
    const detail = payload?.details?.[0];
    throw new LineApiError({
      message:
        [payload?.message, detail ? `${detail.property ?? ""} ${detail.message ?? ""}`.trim() : ""]
          .filter(Boolean)
          .join(": ") || `LINE Messaging API returned ${response.status}`,
      status: response.status,
      retryAfterSeconds: Number(response.headers.get("retry-after")) || undefined,
    });
  }
  return (payload ?? {}) as T;
}

export interface LineBotInfo {
  userId: string;
  basicId?: string;
  premiumId?: string;
  displayName?: string;
  pictureUrl?: string;
}

/** Validates an access token and returns the Official Account it belongs to. */
export async function getLineBotInfo(token: string): Promise<LineBotInfo> {
  const info = await lineRequest<{
    userId?: string;
    basicId?: string;
    premiumId?: string;
    displayName?: string;
    pictureUrl?: string;
  }>({ token, method: "GET", path: "/v2/bot/info" });
  if (!info.userId) {
    throw new ValidationError("LINE did not recognise this channel access token");
  }
  return {
    userId: info.userId,
    basicId: info.basicId,
    premiumId: info.premiumId,
    displayName: info.displayName,
    pictureUrl: info.pictureUrl,
  };
}

/** Points the Official Account's webhook at this store. */
export async function setLineWebhook(params: { token: string; url: string }) {
  await lineRequest({
    token: params.token,
    method: "PUT",
    path: "/v2/bot/channel/webhook/endpoint",
    body: { endpoint: params.url },
  });
}

/** A customer's name and picture, as their LINE profile shows them. */
export async function getLineProfile(params: { connection: IChannelConnection; userId: string }) {
  try {
    const profile = await lineRequest<{ displayName?: string; pictureUrl?: string }>({
      token: lineAccessToken(params.connection),
      method: "GET",
      path: `/v2/bot/profile/${encodeURIComponent(params.userId)}`,
    });
    return { name: profile.displayName, image: profile.pictureUrl };
  } catch {
    // Fail-soft: a thread without a name is better than a lost message.
    return undefined;
  }
}

/**
 * A UUID for `X-Line-Retry-Key`, the same for every retry of one message — so
 * the outbox retrying a push that LINE did accept cannot send it twice.
 */
export function lineRetryKey(seed: string) {
  const hex = createHash("sha256").update(`line:${seed}`).digest("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `${((parseInt(hex.slice(16, 17), 16) & 0x3) | 0x8).toString(16)}${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join("-");
}

type LineMessage =
  | { type: "text"; text: string }
  | { type: "image"; originalContentUrl: string; previewImageUrl: string };

/** Pushes up to five messages to one user; returns the first one's id. */
export async function pushLineMessages(params: {
  connection: IChannelConnection;
  to: string;
  messages: LineMessage[];
  retrySeed: string;
}) {
  const result = await lineRequest<{ sentMessages?: Array<{ id?: string }> }>({
    token: lineAccessToken(params.connection),
    method: "POST",
    path: "/v2/bot/message/push",
    body: { to: params.to, messages: params.messages.slice(0, 5) },
    retryKey: lineRetryKey(params.retrySeed),
  });
  const id = result.sentMessages?.[0]?.id;
  // A message id is what the outbox stores; a retry LINE de-duplicated (409)
  // has none, so the seed stands in for it.
  return id ? String(id) : `retry:${params.retrySeed}`;
}

export function lineTextMessage(text: string): LineMessage {
  return { type: "text", text: text.slice(0, LINE_TEXT_LIMIT) };
}

export function lineImageMessage(url: string): LineMessage {
  return { type: "image", originalContentUrl: url, previewImageUrl: url };
}

/**
 * Streams what a customer sent (a photo, a video, a file). LINE keeps it for a
 * limited time behind the access token, which is why the viewer-authorised
 * attachment proxy serves it and the browser never sees the token.
 */
export async function fetchLineMedia(params: { connection: IChannelConnection; messageId: string }) {
  const response = await fetch(
    `${LINE_DATA_API}/v2/bot/message/${encodeURIComponent(params.messageId)}/content`,
    {
      headers: { Authorization: `Bearer ${lineAccessToken(params.connection)}` },
      signal: AbortSignal.timeout(30_000),
      redirect: "error",
    },
  );
  if (!response.ok || !response.body) {
    throw new LineApiError({
      message: `LINE content download returned ${response.status}`,
      status: response.status,
    });
  }
  const contentLength = Number(response.headers.get("content-length"));
  return {
    body: response.body,
    contentType: response.headers.get("content-type") || "application/octet-stream",
    contentLength: Number.isFinite(contentLength) ? contentLength : undefined,
  };
}

/** Whether `signature` is LINE's HMAC-SHA256 of `rawBody` under the channel secret. */
export function isValidLineSignature(params: {
  channelSecret: string;
  rawBody: string;
  signature: string | null;
}) {
  if (!params.signature) return false;
  const expected = createHmac("sha256", params.channelSecret).update(params.rawBody).digest();
  let given: Buffer;
  try {
    given = Buffer.from(params.signature, "base64");
  } catch {
    return false;
  }
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** "@abc1234" or "abc1234" or a line.me link → "@abc1234"; "" when unusable. */
export function normalizeLineId(value: unknown) {
  if (typeof value !== "string") return "";
  let id = value.trim();
  const fromLink = id.match(/line\.me\/(?:R\/)?ti\/p\/([^/?#]+)/i);
  if (fromLink) id = decodeURIComponent(fromLink[1]);
  id = id.replace(/^%40/, "@");
  if (!id) return "";
  if (!id.startsWith("@")) id = `@${id}`;
  return /^@[A-Za-z0-9._-]{3,40}$/.test(id) ? id : "";
}

/** The add-friend / chat link for an Official Account's basic id. */
export function lineAddFriendUrl(lineId: string) {
  const id = normalizeLineId(lineId);
  return id ? `https://line.me/R/ti/p/${encodeURIComponent(id)}` : "";
}
