import "server-only";

import { APIError } from "better-auth/api";
import { USER_ROLES } from "@/config/app.config";
import { connectDB, mongoose } from "@/lib/db";
import { getSettingsLean } from "@/models/settings.model";

/**
 * The store's rules around Better Auth's passkey plugin (lib/auth/auth.ts).
 *
 * - Settings → Two-Factor → Passkeys switches adding and using them; on unless
 *   an admin turns it off. Seeing and removing your own always works.
 * - A passkey signs in with no password and no second step, so the accounts
 *   that would have had one — two-factor on, or anyone who runs the store —
 *   must have proven it is them (PIN or biometrics: "user verification"), not
 *   only that the device was there. Banned or inactive accounts are refused
 *   where every session is made.
 */

export async function isPasskeyLoginEnabled(): Promise<boolean> {
  await connectDB();
  const settings = await getSettingsLean();
  return settings.security?.passkeyEnabled !== false;
}

interface PasskeyOwner {
  role?: string;
  twoFactorEnabled?: boolean;
}

export async function assertPasskeyVerificationAllowed(params: {
  credentialId?: string;
  userVerified: boolean;
}) {
  if (params.userVerified) return;
  const db = mongoose.connection.db;
  if (!db || !params.credentialId) {
    throw new APIError("UNAUTHORIZED", {
      code: "PASSKEY_VERIFICATION_REQUIRED",
      message: "Unlock your passkey with your PIN, face or fingerprint.",
    });
  }
  const passkey = await db
    .collection("passkey")
    .findOne<{ userId?: unknown }>({ credentialID: params.credentialId }, { projection: { userId: 1 } });
  const userId = String(passkey?.userId ?? "");
  const owner = mongoose.Types.ObjectId.isValid(userId)
    ? await db.collection("user").findOne<PasskeyOwner>(
        { _id: new mongoose.Types.ObjectId(userId) },
        { projection: { role: 1, twoFactorEnabled: 1 } },
      )
    : null;
  const shopper = !owner?.role || owner.role === USER_ROLES.CUSTOMER;
  if (owner && shopper && !owner.twoFactorEnabled) return;
  throw new APIError("UNAUTHORIZED", {
    code: "PASSKEY_VERIFICATION_REQUIRED",
    message: "Unlock your passkey with your PIN, face or fingerprint.",
  });
}
