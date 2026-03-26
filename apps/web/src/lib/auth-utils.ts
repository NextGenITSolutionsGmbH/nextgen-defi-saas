import "server-only";
import bcrypt from "bcryptjs";
import { authenticator } from "otplib";

const SALT_ROUNDS = 12;

/**
 * Hash a password using bcryptjs.
 * Using 12 rounds for strong security while maintaining reasonable speed.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against a bcrypt hash.
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}

/**
 * Generate a new TOTP secret for two-factor authentication.
 */
export function generateTOTPSecret(): {
  secret: string;
  otpauthUrl: string;
} {
  const secret = authenticator.generateSecret();
  const otpauthUrl = authenticator.keyuri("user", "DeFi Tracker", secret);
  return { secret, otpauthUrl };
}

/**
 * Verify a TOTP token against a secret.
 */
export function verifyTOTP(token: string, secret: string): boolean {
  try {
    return authenticator.verify({ token, secret });
  } catch {
    return false;
  }
}
