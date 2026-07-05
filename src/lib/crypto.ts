import crypto from "node:crypto";
import { requireEnv } from "@/lib/env";

/**
 * Authenticated symmetric encryption for secrets stored at rest
 * (GitHub access tokens, per-user Slack webhook URLs).
 *
 * Algorithm: AES-256-GCM.
 * Key:       32 bytes, provided as 64 hex chars in ENCRYPTION_KEY.
 * Format:    "v1:<iv b64>:<authTag b64>:<ciphertext b64>"
 */
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // GCM standard nonce size
const VERSION = "v1";

function getKey(): Buffer {
  const hex = requireEnv("ENCRYPTION_KEY");
  const key = Buffer.from(hex, "hex");
  if (key.length !== 32) {
    throw new Error(
      "ENCRYPTION_KEY must be 32 bytes encoded as 64 hex characters. " +
        "Generate one with: openssl rand -hex 32",
    );
  }
  return key;
}

export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString("base64"),
    authTag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

export function decrypt(payload: string): string {
  const parts = payload.split(":");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error("Malformed or unsupported ciphertext.");
  }
  const [, ivB64, tagB64, dataB64] = parts as [string, string, string, string];
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    getKey(),
    Buffer.from(ivB64, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

/** Decrypt without throwing — returns null on any failure or empty input. */
export function safeDecrypt(payload?: string | null): string | null {
  if (!payload) return null;
  try {
    return decrypt(payload);
  } catch {
    return null;
  }
}
