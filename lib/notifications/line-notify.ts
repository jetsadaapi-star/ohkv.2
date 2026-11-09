import "server-only";

import { Types } from "mongoose";
import { connectDB, mongoose } from "@/lib/db";
import {
  CHANNEL_CONNECTION_STATUSES,
  ChannelConnection,
  type IChannelConnection,
} from "@/models/channel-connection.model";
import { CustomerProfile } from "@/models";
import {
  lineTextMessage,
  pushLineMessages,
} from "@/lib/conversations/providers/line-client";

/**
 * Order and return updates on LINE, from the store's own Official Account
 * (Settings → Messaging → LINE), for customers who signed in with LINE.
 *
 * A LINE Login user id is the same person's Messaging API id when both
 * channels sit under one LINE provider, so the account's `line` sign-in is the
 * address. LINE delivers only to people who have added the OA as a friend; a
 * push to anyone else is refused and nothing is lost but the attempt.
 *
 * Off when the store has no active LINE connection, has switched LINE order
 * updates off, or the customer has turned them off in Preferences.
 */

let connectionCache: { at: number; value: IChannelConnection | null } | null = null;
const CONNECTION_TTL_MS = 30_000;

/** The platform's LINE Official Account, when it is on for order updates. */
export async function storeLineConnection(): Promise<IChannelConnection | null> {
  if (connectionCache && Date.now() - connectionCache.at < CONNECTION_TTL_MS) {
    return connectionCache.value;
  }
  await connectDB();
  const value = await ChannelConnection.findOne({
    ownerKey: "platform",
    provider: "line",
    status: CHANNEL_CONNECTION_STATUSES.ACTIVE,
    lineNotifyCustomers: { $ne: false },
  });
  connectionCache = { at: Date.now(), value };
  return value;
}

/** The customer's LINE user id, from their LINE sign-in, if they have one. */
export async function lineUserIdOf(userId: string): Promise<string | null> {
  const db = mongoose.connection.db;
  if (!db || !Types.ObjectId.isValid(userId)) return null;
  const account = await db.collection("account").findOne<{ accountId?: string }>(
    {
      providerId: "line",
      userId: { $in: [new Types.ObjectId(userId), userId] },
    },
    { projection: { accountId: 1 } },
  );
  const id = account?.accountId;
  return typeof id === "string" && /^U[0-9a-f]{32}$/i.test(id) ? id : null;
}

/** Whether the customer has LINE updates switched on (they are by default). */
async function customerWantsLine(userId: string) {
  const profile = await CustomerProfile.findOne({ userId })
    .select("lineNotifications.orderUpdates")
    .lean<{ lineNotifications?: { orderUpdates?: boolean } } | null>();
  return profile?.lineNotifications?.orderUpdates !== false;
}

/**
 * Sends one update. Never throws: a LINE refusal (not a friend, quota spent)
 * must not stop the email and text going out.
 *
 * `dedupeSeed` makes a retried push of the same event a no-op on LINE's side.
 */
export async function deliverLineNotification(params: {
  userId: string;
  text: string;
  dedupeSeed: string;
}): Promise<boolean> {
  try {
    const connection = await storeLineConnection();
    if (!connection) return false;
    const [to, wants] = await Promise.all([
      lineUserIdOf(params.userId),
      customerWantsLine(params.userId),
    ]);
    if (!to || !wants) return false;
    await pushLineMessages({
      connection,
      to,
      messages: [lineTextMessage(params.text)],
      retrySeed: `notify:${params.dedupeSeed}`,
    });
    return true;
  } catch (error) {
    console.error("LINE order update was not sent:", error instanceof Error ? error.message : error);
    return false;
  }
}

/** For Preferences: can this customer get LINE updates at all? */
export async function lineUpdatesAvailableFor(userId: string) {
  const connection = await storeLineConnection();
  if (!connection) return { available: false as const };
  const linked = Boolean(await lineUserIdOf(userId));
  return {
    available: true as const,
    linked,
    addFriendUrl: connection.publicLineId
      ? `https://line.me/R/ti/p/${encodeURIComponent(connection.publicLineId)}`
      : undefined,
  };
}
