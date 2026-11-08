import { createPrivateKey, sign } from "node:crypto";

/**
 * Sign in with Apple has no fixed client secret. Apple wants a short JWT,
 * signed with the .p8 key made under Certificates, Identifiers & Profiles →
 * Keys, naming the team, the key and the Services ID:
 *
 *   header  { alg: "ES256", kid: <Key ID> }
 *   payload { iss: <Team ID>, iat, exp (≤ 6 months), aud: "https://appleid.apple.com",
 *             sub: <Services ID> }
 *
 * Built here from the stored pieces so an admin never has to mint one by hand
 * or come back every six months to replace it: each Better Auth instance signs
 * a fresh one, valid for 150 days — inside Apple's limit, with room to spare.
 */
const LIFETIME_SECONDS = 150 * 24 * 60 * 60;

function base64Url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

/** A .p8 key pasted with or without its PEM armour, or with its breaks lost. */
function normalizePrivateKey(raw: string): string {
  const body = raw
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const lines = body.match(/.{1,64}/g) ?? [];
  return `-----BEGIN PRIVATE KEY-----\n${lines.join("\n")}\n-----END PRIVATE KEY-----\n`;
}

export function createAppleClientSecret(params: {
  teamId: string;
  keyId: string;
  serviceId: string;
  privateKey: string;
  now?: number;
}): string {
  const iat = Math.floor((params.now ?? Date.now()) / 1000);
  const header = { alg: "ES256", kid: params.keyId, typ: "JWT" };
  const payload = {
    iss: params.teamId,
    iat,
    exp: iat + LIFETIME_SECONDS,
    aud: "https://appleid.apple.com",
    sub: params.serviceId,
  };
  const signingInput = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`;
  const key = createPrivateKey(normalizePrivateKey(params.privateKey));
  // ES256 in a JWT is the raw r‖s pair, not the DER signature Node gives by default.
  const signature = sign("sha256", Buffer.from(signingInput), { key, dsaEncoding: "ieee-p1363" });
  return `${signingInput}.${base64Url(signature)}`;
}

/** Whether the pasted key parses as an EC private key — checked before saving it is used. */
export function isUsableApplePrivateKey(raw: string | undefined | null): boolean {
  if (!raw?.trim()) return false;
  try {
    const key = createPrivateKey(normalizePrivateKey(raw));
    return key.asymmetricKeyType === "ec";
  } catch {
    return false;
  }
}
