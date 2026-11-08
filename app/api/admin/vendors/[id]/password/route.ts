import * as z from "zod";
import { Types } from "mongoose";
import { ObjectId } from "mongodb";
import { withApi } from "@/lib/api/handler";
import { successResponse } from "@/lib/api/response";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/api/errors";
import { validateBody } from "@/lib/api/validate";
import { mongoose } from "@/lib/db";
import { Vendor } from "@/models";
import { audit, createAuditContext } from "@/lib/audit";
import { getActivePasswordPolicy } from "@/lib/auth/auth";
import { getCredentialAccount, upsertCredentialPassword } from "@/lib/auth/auth-credentials";
import { MAX_ALLOWED_PASSWORD_LENGTH, type PasswordPolicy } from "@/lib/auth/password-policy";
import { listActiveSessions, revokeAllSessions } from "@/lib/auth/session-revocation";
import { clearLockoutsForEmail } from "@/lib/auth/login-lockout";

/**
 * The store owner's sign-in password, set by an admin.
 *
 * GET  — whether the owner has a password yet, and the rules a new one must
 *        meet (the Security settings), so the dialog can check as you type.
 * POST {password, signOutEverywhere} — set it. Creates the credential account
 *        when the owner never had one (imported or invited stores), clears a
 *        login lockout, and by default signs the owner out of every device.
 *
 * Only a store owner's account: an admin's password is never changed here.
 */

async function ownerOf(vendorId: string) {
  if (!Types.ObjectId.isValid(vendorId)) throw new NotFoundError("Vendor");
  const vendor = await Vendor.findById(vendorId).select("userId storeName").lean<{
    userId?: Types.ObjectId;
    storeName?: string;
  }>();
  if (!vendor?.userId) throw new NotFoundError("Vendor");
  const db = mongoose.connection.db;
  if (!db) throw new Error("Database not connected");
  const userId = new ObjectId(String(vendor.userId));
  const user = await db
    .collection("user")
    .findOne({ _id: userId }, { projection: { email: 1, name: 1, role: 1, password: 1 } });
  if (!user) throw new NotFoundError("Vendor owner");
  if (user.role === "admin") {
    throw new ConflictError("บัญชีนี้เป็นผู้ดูแลระบบ เปลี่ยนรหัสผ่านจากหน้านี้ไม่ได้");
  }
  return { db, vendor, userId, user };
}

/** The policy's refusal, in Thai. */
function policyProblem(password: string, policy: PasswordPolicy): string | null {
  if (!password) return "กรุณากรอกรหัสผ่าน";
  if (password.length < policy.minPasswordLength) return `รหัสผ่านต้องมีอย่างน้อย ${policy.minPasswordLength} ตัวอักษร`;
  if (password.length > MAX_ALLOWED_PASSWORD_LENGTH) return `รหัสผ่านต้องไม่เกิน ${MAX_ALLOWED_PASSWORD_LENGTH} ตัวอักษร`;
  if (policy.requireUppercase && !/[A-Z]/.test(password)) return "รหัสผ่านต้องมีตัวพิมพ์ใหญ่ (A-Z) อย่างน้อย 1 ตัว";
  if (policy.requireNumbers && !/[0-9]/.test(password)) return "รหัสผ่านต้องมีตัวเลขอย่างน้อย 1 ตัว";
  if (policy.requireSpecialChars && !/[^A-Za-z0-9]/.test(password)) return "รหัสผ่านต้องมีอักขระพิเศษอย่างน้อย 1 ตัว";
  return null;
}

export const GET = withApi<{ id: string }>(
  { auth: "admin", rateLimit: { action: "admin:vendors:password:view", preset: "lenient" } },
  async ({ params }) => {
    const { db, userId, user } = await ownerOf(params.id);
    const credential = await getCredentialAccount(db, userId);
    const sessions = await listActiveSessions(userId.toString()).catch(() => []);
    return successResponse({
      email: user.email ?? "",
      hasPassword: Boolean(credential?.password || user.password),
      activeSessions: sessions.length,
      policy: await getActivePasswordPolicy(),
    });
  },
);

const BodySchema = z.object({
  password: z.string().max(MAX_ALLOWED_PASSWORD_LENGTH),
  signOutEverywhere: z.boolean().default(true),
});

export const POST = withApi<{ id: string }>(
  {
    auth: "admin",
    demo: "block-mutations",
    rateLimit: { action: "admin:vendors:password", preset: "moderate" },
  },
  async ({ request, params, session }) => {
    const { password, signOutEverywhere } = await validateBody(request, BodySchema);
    const { db, vendor, userId, user } = await ownerOf(params.id);

    const problem = policyProblem(password, await getActivePasswordPolicy());
    if (problem) throw new ValidationError({ password: [problem] });

    const had = Boolean((await getCredentialAccount(db, userId))?.password || user.password);
    await upsertCredentialPassword(db, userId, password);
    // A hash left over from the old system must not keep working beside it.
    await db.collection("user").updateOne({ _id: userId }, { $unset: { password: "" } });
    if (user.email) await clearLockoutsForEmail(String(user.email)).catch(() => 0);
    const signedOut = signOutEverywhere ? await revokeAllSessions(userId.toString()) : 0;

    await audit(createAuditContext(request, session), {
      action: "PASSWORD_CHANGE",
      resource: "user",
      resourceId: userId.toString(),
      resourceName: String(user.email ?? ""),
      changes: {
        summary: `${had ? "Changed" : "Set"} the password of the owner of ${vendor.storeName ?? "a store"}${
          signedOut > 0 ? `, signing them out of ${signedOut} device${signedOut === 1 ? "" : "s"}` : ""
        }.`,
      },
      metadata: { mode: had ? "changed" : "set", byAdmin: true, vendorId: params.id, signedOut },
    });

    return successResponse({ mode: had ? "changed" : "set", signedOut });
  },
);
