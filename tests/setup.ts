/**
 * Global test setup — runs before every Vitest suite.
 *
 * Sets deterministic environment variables so that tests never
 * accidentally connect to real infrastructure.
 */

process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://test_user:test_pass@localhost:5432/defi_tracker_test";

process.env.REDIS_URL =
  process.env.REDIS_URL ?? "redis://localhost:6379/1";

process.env.NEXTAUTH_SECRET =
  process.env.NEXTAUTH_SECRET ?? "test-secret-do-not-use-in-production";

process.env.NEXTAUTH_URL =
  process.env.NEXTAUTH_URL ?? "http://localhost:3000";

process.env.NODE_ENV = "test";
