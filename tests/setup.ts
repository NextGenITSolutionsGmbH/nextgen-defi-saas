/**
 * Global test setup — runs before every Vitest suite.
 *
 * Sets deterministic environment variables so that tests never
 * accidentally connect to real infrastructure.
 */

process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://defitracker:defitracker_test@localhost:5432/defitracker_test";

process.env.REDIS_URL =
  process.env.REDIS_URL ?? "redis://localhost:6379/1";

process.env.NEXTAUTH_SECRET =
  process.env.NEXTAUTH_SECRET ?? "test-secret-do-not-use-in-production";

process.env.NEXTAUTH_URL =
  process.env.NEXTAUTH_URL ?? "http://localhost:3008";

process.env.TOTP_ENCRYPTION_KEY =
  process.env.TOTP_ENCRYPTION_KEY ??
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

process.env.NODE_ENV = "test";
