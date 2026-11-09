import { createHash } from "node:crypto";
import {
  ChannelConnection,
  INBOUND_CONNECTION_STATUSES,
  type IChannelConnection,
} from "@/models/channel-connection.model";
import { decryptMessagingSecret } from "@/lib/conversations/secret-box";
import { getLineProfile, isValidLineSignature } from "@/lib/conversations/providers/line-client";
import {
  ingestInboundMessage,
  type InboundMessageEvent,
} from "@/lib/conversations/providers/ingest";
import {
  claimWebhookReceipt,
  markWebhookReceiptFailed,
  markWebhookReceiptProcessed,
} from "@/lib/conversations/providers/webhook-receipt";

type RecordValue = Record<string, unknown>;

function record(value: unknown): RecordValue {
  return value && typeof value === "object" ? (value as RecordValue) : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

/** What a non-text message reads as in the inbox. */
function lineBody(message: RecordValue) {
  switch (text(message.type)) {
    case "text":
      return text(message.text) || "[Message]";
    case "image":
      return "[Photo]";
    case "video":
      return "[Video]";
    case "audio":
      return "[Voice message]";
    case "file":
      return text(message.fileName) ? `[File] ${text(message.fileName)}` : "[File]";
    case "sticker": {
      const keywords = Array.isArray(message.keywords) ? (message.keywords as unknown[]).map(String) : [];
      return keywords[0] ? `[Sticker: ${keywords[0]}]` : "[Sticker]";
    }
    case "location":
      return [
        "[Location]",
        text(message.title),
        text(message.address),
        message.latitude !== undefined ? `https://maps.google.com/?q=${message.latitude},${message.longitude}` : "",
      ]
        .filter(Boolean)
        .join(" ");
    default:
      return "[LINE message]";
  }
}

/**
 * The media a message carries. LINE keeps the bytes behind the access token,
 * referenced by the message id, so it is stored as `providerMediaId` and
 * served through the attachment proxy — unless the sender's app hosted it
 * itself (`contentProvider.type: "external"`), when the URL is public.
 */
function lineAttachments(message: RecordValue): InboundMessageEvent["attachments"] {
  const type = text(message.type);
  const kind =
    type === "image" ? "image" : type === "video" ? "video" : type === "audio" ? "audio" : type === "file" ? "document" : null;
  if (!kind) return [];
  const provider = record(message.contentProvider);
  const external = text(provider.type) === "external" ? text(provider.originalContentUrl) : "";
  return [
    {
      type: kind,
      ...(external ? { url: external } : { providerMediaId: text(message.id) }),
      name: text(message.fileName) || undefined,
    },
  ];
}

/**
 * Finds the Official Account a webhook is for, by its `destination`, and
 * proves the body came from LINE with the channel secret. Null when either
 * fails — the caller answers 401.
 *
 * Inactive-but-errored connections still receive (see
 * INBOUND_CONNECTION_STATUSES): a dead token must not drop customers' messages.
 */
export async function resolveLineConnection(params: {
  destination: string;
  rawBody: string;
  signature: string | null;
}) {
  const destination = params.destination.trim();
  if (!/^U[0-9a-f]{32}$/i.test(destination)) return null;
  const connection = await ChannelConnection.findOne({
    provider: "line",
    status: { $in: INBOUND_CONNECTION_STATUSES },
    lineBotUserId: destination,
  });
  if (!connection?.lineChannelSecretEncrypted) return null;
  let secret: string;
  try {
    secret = decryptMessagingSecret(connection.lineChannelSecretEncrypted);
  } catch {
    return null;
  }
  return isValidLineSignature({ channelSecret: secret, rawBody: params.rawBody, signature: params.signature })
    ? connection
    : null;
}

/**
 * Turns one webhook delivery into inbox messages. Only 1:1 chats with users
 * become threads — groups and rooms are out of scope, as on Telegram — and
 * only message events; follows, unfollows and postbacks are acknowledged and
 * left alone.
 */
export async function processLineWebhook(params: {
  connection: IChannelConnection;
  payload: unknown;
  rawBody: string;
}) {
  const events = Array.isArray(record(params.payload).events)
    ? (record(params.payload).events as unknown[]).map(record)
    : [];
  const botId = params.connection.lineBotUserId || "unknown";
  const names = new Map<string, Awaited<ReturnType<typeof getLineProfile>>>();
  let processed = 0;
  let duplicates = 0;

  for (const event of events) {
    if (text(event.type) !== "message") continue;
    const source = record(event.source);
    const userId = text(source.userId);
    if (text(source.type) !== "user" || !userId) continue;
    const message = record(event.message);
    const messageId = text(message.id);
    if (!messageId) continue;

    // LINE redelivers a webhook it got no 2xx for (when redelivery is on),
    // with the same `webhookEventId`: one receipt per event keeps that
    // idempotent.
    const eventHash = createHash("sha256").update(JSON.stringify(event)).digest("hex");
    const claim = await claimWebhookReceipt({
      provider: "line",
      eventKey: `${botId}:${text(event.webhookEventId) || messageId}`,
      payloadHash: eventHash,
    });
    if (claim.duplicate) {
      duplicates += 1;
      continue;
    }
    try {
      if (!names.has(userId)) {
        names.set(userId, await getLineProfile({ connection: params.connection, userId }));
      }
      const profile = names.get(userId);
      await ingestInboundMessage(params.connection, {
        provider: "line",
        connectionLookupId: botId,
        externalUserId: userId,
        senderName: profile?.name || "LINE user",
        body: lineBody(message),
        attachments: lineAttachments(message),
        // LINE message ids are unique across the platform.
        providerMessageId: messageId,
        occurredAt: new Date(Number(event.timestamp) || Date.now()),
      });
      await markWebhookReceiptProcessed(claim.receipt);
      processed += 1;
    } catch (error) {
      await markWebhookReceiptFailed(claim.receipt, error);
      throw error;
    }
  }
  return { processed, duplicates };
}
