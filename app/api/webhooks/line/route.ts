import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import {
  processLineWebhook,
  resolveLineConnection,
} from "@/lib/conversations/providers/line-webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * LINE Messaging API webhook.
 *
 * Every delivery names the receiving Official Account as `destination` and is
 * signed with that channel's secret (X-Line-Signature, HMAC-SHA256 of the raw
 * body). The connection is found by the first and proven by the second; a
 * body that fails either is not from LINE. The console's "Verify" button
 * sends an empty, signed `events` list, which passes and processes nothing.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ success: false, message: "Invalid webhook payload" }, { status: 400 });
  }
  const destination =
    payload && typeof payload === "object" && typeof (payload as { destination?: unknown }).destination === "string"
      ? (payload as { destination: string }).destination
      : "";

  try {
    await connectDB();
    const connection = await resolveLineConnection({
      destination,
      rawBody,
      signature: request.headers.get("x-line-signature"),
    });
    if (!connection) {
      return NextResponse.json({ success: false, message: "Invalid webhook signature" }, { status: 401 });
    }
    const result = await processLineWebhook({ connection, payload, rawBody });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    // A non-2xx lets LINE redeliver (when redelivery is on); the per-event
    // receipts keep the retry idempotent.
    console.error("LINE messaging webhook failed:", error);
    return NextResponse.json({ success: false, message: "Webhook processing failed" }, { status: 500 });
  }
}
