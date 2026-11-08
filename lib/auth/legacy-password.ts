import bcrypt from "bcryptjs";
import { hashPassword, verifyPassword } from "better-auth/crypto";

/**
 * Passwords for accounts imported from the old OHK Shop (Laravel). Their
 * credential rows keep the old bcrypt hash (`$2y$…`) so people sign in with the
 * password they already have; every new or changed password is hashed with
 * better-auth's own scrypt as before. PHP's `$2y$` is the same algorithm as
 * `$2a$`/`$2b$`, which bcryptjs reads.
 */
const BCRYPT_PREFIX = /^\$2[abxy]\$\d{2}\$/;

export function isLegacyBcryptHash(hash: string): boolean {
  return BCRYPT_PREFIX.test(hash);
}

export async function verifyAnyPassword({
  hash,
  password,
}: {
  hash: string;
  password: string;
}): Promise<boolean> {
  if (isLegacyBcryptHash(hash)) {
    return bcrypt.compare(password, hash.replace(/^\$2y\$/, "$2a$"));
  }
  return verifyPassword({ hash, password });
}

export { hashPassword };
