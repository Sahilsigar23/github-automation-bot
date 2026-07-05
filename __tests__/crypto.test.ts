import { describe, it, expect, beforeAll } from "vitest";

// 32-byte key as 64 hex chars — set before importing the module under test.
beforeAll(() => {
  process.env.ENCRYPTION_KEY = "a".repeat(64);
});

describe("crypto (AES-256-GCM)", () => {
  it("round-trips a value", async () => {
    const { encrypt, decrypt } = await import("@/lib/crypto");
    const secret = "gho_exampleGitHubToken_1234567890";
    const ciphertext = encrypt(secret);
    expect(ciphertext).not.toContain(secret);
    expect(ciphertext.startsWith("v1:")).toBe(true);
    expect(decrypt(ciphertext)).toBe(secret);
  });

  it("produces different ciphertext each time (random IV)", async () => {
    const { encrypt } = await import("@/lib/crypto");
    expect(encrypt("same")).not.toBe(encrypt("same"));
  });

  it("safeDecrypt returns null on malformed input", async () => {
    const { safeDecrypt } = await import("@/lib/crypto");
    expect(safeDecrypt("not-valid")).toBeNull();
    expect(safeDecrypt(null)).toBeNull();
    expect(safeDecrypt(undefined)).toBeNull();
  });

  it("fails to decrypt when the auth tag is tampered", async () => {
    const { encrypt, decrypt } = await import("@/lib/crypto");
    const ct = encrypt("value");
    const parts = ct.split(":");
    parts[2] = Buffer.from("tampered-tag---!").toString("base64");
    expect(() => decrypt(parts.join(":"))).toThrow();
  });
});
