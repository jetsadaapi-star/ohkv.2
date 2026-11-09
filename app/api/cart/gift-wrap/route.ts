import { NextRequest } from "next/server";
import { headers } from "next/headers";
import * as z from "zod";
import { connectDB } from "@/lib/db";
import { Cart } from "@/models";
import { auth } from "@/lib/auth/auth";
import { successResponse } from "@/lib/api/response";
import { ValidationError, handleApiError } from "@/lib/api/errors";
import { validateBody } from "@/lib/api/validate";
import { rateLimitByIP } from "@/lib/api/rate-limit-middleware";
import { resolveCartIdentity } from "@/lib/cart/cart-service";
import { getSettingsLean } from "@/models/settings.model";
import { GIFT_MESSAGE_MAX, giftWrapConfigOf } from "@/lib/orders/gift-wrap";

const GiftWrapSchema = z.object({
  enabled: z.boolean(),
  message: z.string().trim().max(GIFT_MESSAGE_MAX).optional(),
});

/**
 * PUT /api/cart/gift-wrap — the shopper's gift-wrap choice and message, kept
 * on their cart so every way of paying prices the same fee
 * (lib/orders/gift-wrap.ts). Refused while the store does not offer wrapping.
 */
export async function PUT(request: NextRequest) {
  try {
    await rateLimitByIP(request, "lenient");
    const body = await validateBody(request, GiftWrapSchema);
    await connectDB();
    const config = giftWrapConfigOf(await getSettingsLean());
    if (!config.enabled) throw new ValidationError("Gift wrapping is not offered");

    const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
    const identity = resolveCartIdentity({
      userId: session?.user?.id,
      sessionId: request.cookies.get("cart_session")?.value,
    });
    if (!identity) throw new ValidationError("Your cart is empty");
    const query = identity.userId ? { userId: identity.userId } : { sessionId: identity.sessionId };

    const giftWrap = body.enabled
      ? { enabled: true, ...(config.allowMessage && body.message ? { message: body.message } : {}) }
      : undefined;
    const cart = await Cart.findOneAndUpdate(
      { ...query, "items.0": { $exists: true } },
      giftWrap ? { $set: { giftWrap } } : { $unset: { giftWrap: "" } },
      { new: true, projection: { giftWrap: 1 } },
    ).lean<{ giftWrap?: { enabled?: boolean; message?: string } } | null>();
    if (!cart) throw new ValidationError("Your cart is empty");
    return successResponse({ giftWrap: cart.giftWrap ?? { enabled: false }, fee: config.fee });
  } catch (error) {
    return handleApiError(error);
  }
}

/** GET /api/cart/gift-wrap — the choice on this cart, and the store's terms. */
export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const config = giftWrapConfigOf(await getSettingsLean());
    if (!config.enabled) return successResponse({ config, giftWrap: { enabled: false } });
    const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
    const identity = resolveCartIdentity({
      userId: session?.user?.id,
      sessionId: request.cookies.get("cart_session")?.value,
    });
    const cart = identity
      ? await Cart.findOne(identity.userId ? { userId: identity.userId } : { sessionId: identity.sessionId })
          .select("giftWrap")
          .lean<{ giftWrap?: { enabled?: boolean; message?: string } } | null>()
      : null;
    return successResponse({ config, giftWrap: cart?.giftWrap ?? { enabled: false } });
  } catch (error) {
    return handleApiError(error);
  }
}
