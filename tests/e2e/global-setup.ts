import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import type { FullConfig } from "@playwright/test";

// Load .env.test if present (local dev; CI sets env vars directly)
try {
  const content = readFileSync(resolve(__dirname, "../../.env.test"), "utf-8");
  for (const line of content.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const key = t.slice(0, eq);
    if (!process.env[key]) process.env[key] = t.slice(eq + 1);
  }
} catch { /* .env.test not found — rely on env vars */ }

/**
 * Playwright global-setup — runs once before the entire E2E suite.
 *
 * 1. Applies pending Prisma migrations against the test database.
 * 2. Seeds the database with baseline data needed by E2E tests.
 */
export default async function globalSetup(_config: FullConfig): Promise<void> {
  const projectRoot = process.env.PROJECT_ROOT ?? resolve(__dirname, "../..");
  const env = {
    ...process.env,
    DATABASE_URL:
      process.env.DATABASE_URL ??
      "postgresql://defitracker:defitracker_test@localhost:5432/defitracker_test",
  };

  try {
    console.log("[global-setup] Running Prisma migrations...");
    execSync("pnpm --filter @defi-tracker/db exec prisma migrate deploy", {
      stdio: "inherit",
      env,
      cwd: projectRoot,
      timeout: 30_000,
    });

    console.log("[global-setup] Seeding test database...");
    try {
      execSync("pnpm --filter @defi-tracker/db exec prisma db seed", {
        stdio: "inherit",
        env,
        cwd: projectRoot,
        timeout: 30_000,
      });
    } catch {
      console.warn("[global-setup] Seed script not configured — skipping.");
    }
  } catch (err) {
    console.warn(
      "[global-setup] Prisma migration/seed failed — assuming already applied (run scripts/test-e2e.sh for full setup).",
      String(err),
    );
  }

  // Warm up critical routes so Turbopack compiles them before tests start.
  // This prevents cold-compilation timeouts during the first test run.
  const baseURL = process.env.BASE_URL ?? `http://localhost:${process.env.E2E_PORT ?? "3008"}`;
  const warmupRoutes = [
    "/api/health",
    "/login",
    "/register",
    "/wallets",
    "/api/auth/providers",
    "/api/auth/csrf",
    "/api/auth/register",
  ];

  console.log("[global-setup] Warming up routes...");
  for (const route of warmupRoutes) {
    try {
      await fetch(`${baseURL}${route}`);
    } catch {
      // Server may not be ready yet during global-setup; Playwright handles startup separately.
    }
  }

  console.log("[global-setup] Done.");
}
