import { execSync } from "node:child_process";
import type { FullConfig } from "@playwright/test";

/**
 * Playwright global-setup — runs once before the entire E2E suite.
 *
 * 1. Applies pending Prisma migrations against the test database.
 * 2. Seeds the database with baseline data needed by E2E tests.
 */
export default async function globalSetup(_config: FullConfig): Promise<void> {
  const env = {
    ...process.env,
    DATABASE_URL:
      process.env.DATABASE_URL ??
      "postgresql://test_user:test_pass@localhost:5432/defi_tracker_test",
  };

  console.log("[global-setup] Running Prisma migrations...");
  execSync("npx prisma migrate deploy --schema=packages/db/prisma/schema.prisma", {
    stdio: "inherit",
    env,
    cwd: process.env.PROJECT_ROOT ?? process.cwd().replace("/tests/e2e", ""),
  });

  console.log("[global-setup] Seeding test database...");
  try {
    execSync("npx prisma db seed --schema=packages/db/prisma/schema.prisma", {
      stdio: "inherit",
      env,
      cwd: process.env.PROJECT_ROOT ?? process.cwd().replace("/tests/e2e", ""),
    });
  } catch {
    console.warn("[global-setup] Seed script not configured — skipping.");
  }

  console.log("[global-setup] Done.");
}
