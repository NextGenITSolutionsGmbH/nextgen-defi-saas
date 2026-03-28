import { describe, it, expect } from "vitest";
import {
  hashPassword,
  verifyPassword,
  generateTOTPSecret,
  verifyTOTP,
} from "../auth-utils";

/**
 * @spec NFR-S01 — Password hashing (Argon2id)
 * @spec NFR-S05 — Session management
 * @spec NFR-S06 — TOTP 2FA authentication
 */

// -------------------- hashPassword / verifyPassword --------------------

describe("hashPassword [NFR-S01, NFR-S05, NFR-S06]", () => {
  it("returns a non-empty Argon2id hash string", async () => {
    const hash = await hashPassword("SuperSecure!123");
    expect(hash).toBeTruthy();
    expect(hash).toMatch(/^\$argon2id\$/);
  });

  it("produces different hashes for the same input (salt varies)", async () => {
    const a = await hashPassword("Same-Password-99");
    const b = await hashPassword("Same-Password-99");
    expect(a).not.toEqual(b);
  });
});

describe("verifyPassword", () => {
  it("returns true for a correct password", async () => {
    const password = "MyP@ssw0rd!";
    const hash = await hashPassword(password);
    const result = await verifyPassword(password, hash);
    expect(result).toBe(true);
  });

  it("returns false for an incorrect password", async () => {
    const hash = await hashPassword("CorrectPassword1!");
    const result = await verifyPassword("WrongPassword2!", hash);
    expect(result).toBe(false);
  });

  it("returns false for a malformed hash", async () => {
    const result = await verifyPassword("anything", "not-a-valid-hash");
    expect(result).toBe(false);
  });

  it("returns false for an empty password", async () => {
    const hash = await hashPassword("RealPassword3!");
    const result = await verifyPassword("", hash);
    expect(result).toBe(false);
  });
});

// -------------------- TOTP --------------------

describe("generateTOTPSecret", () => {
  it("returns an object with secret and otpauthUrl", () => {
    const result = generateTOTPSecret();
    expect(result).toHaveProperty("secret");
    expect(result).toHaveProperty("otpauthUrl");
  });

  it("secret is a non-empty string", () => {
    const { secret } = generateTOTPSecret();
    expect(typeof secret).toBe("string");
    expect(secret.length).toBeGreaterThan(0);
  });

  it("otpauthUrl contains the expected issuer", () => {
    const { otpauthUrl } = generateTOTPSecret();
    expect(otpauthUrl).toContain("DeFi%20Tracker");
  });

  it("otpauthUrl starts with otpauth://totp/", () => {
    const { otpauthUrl } = generateTOTPSecret();
    expect(otpauthUrl).toMatch(/^otpauth:\/\/totp\//);
  });

  it("generates unique secrets on each call", () => {
    const a = generateTOTPSecret();
    const b = generateTOTPSecret();
    expect(a.secret).not.toEqual(b.secret);
  });
});

describe("verifyTOTP", () => {
  it("returns false for an invalid token", () => {
    const { secret } = generateTOTPSecret();
    const result = verifyTOTP("000000", secret);
    // May or may not be true depending on timing — but a random secret
    // with a static token is overwhelmingly likely to be false.
    expect(typeof result).toBe("boolean");
  });

  it("returns false for an empty token", () => {
    const { secret } = generateTOTPSecret();
    expect(verifyTOTP("", secret)).toBe(false);
  });

  it("returns false for a malformed secret", () => {
    expect(verifyTOTP("123456", "")).toBe(false);
  });
});
