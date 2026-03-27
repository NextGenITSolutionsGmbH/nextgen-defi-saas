import { NextResponse } from "next/server";
import { execSync } from "child_process";
import path from "path";

const BUILD_ID = "f1486bc-abspath";
const APP_ROOT = "/app";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");
  const checks: Record<string, string> = {};

  checks.build_id = BUILD_ID;

  // Action: run migrations via Prisma $executeRawUnsafe (bypasses broken CLI)
  if (action === "migrate") {
    try {
      const fs = await import("fs");
      const { prisma } = await import("@defi-tracker/db");

      // Step 1: Run migration SQL
      const migrationPath = path.join(APP_ROOT, "packages/db/prisma/migrations/0001_init/migration.sql");
      if (fs.existsSync(migrationPath)) {
        const migrationSql = fs.readFileSync(migrationPath, "utf-8");
        // Split by statements and execute each (skip empty)
        const statements = migrationSql
          .split(";")
          .map((s: string) => s.trim())
          .filter((s: string) => s.length > 0 && !s.startsWith("--"));

        checks.statements_found = String(statements.length);
        let executed = 0;
        const errors: string[] = [];
        for (const stmt of statements) {
          try {
            await prisma.$executeRawUnsafe(stmt);
            executed++;
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            if (msg.includes("already exists")) {
              executed++; // Already migrated
            } else {
              errors.push(msg.slice(0, 100));
            }
          }
        }
        checks.statements_executed = String(executed);
        if (errors.length > 0) checks.migration_errors = errors.join(" | ").slice(0, 500);
      } else {
        checks.migration_file = "not found";
      }

      // Step 2: Run seed SQL
      const seedPath = path.join(APP_ROOT, "packages/db/prisma/seed.sql");
      if (fs.existsSync(seedPath)) {
        const seedSql = fs.readFileSync(seedPath, "utf-8");
        try {
          await prisma.$executeRawUnsafe(seedSql);
          checks.seed = "ok";
        } catch (e) {
          checks.seed_error = e instanceof Error ? e.message.slice(0, 200) : String(e).slice(0, 200);
        }
      }

      // Step 3: Verify user exists
      try {
        const user = await prisma.user.findUnique({
          where: { email: "carol@example.com" },
          select: { id: true, email: true, plan: true },
        });
        checks.carol_exists = user ? "yes" : "no";
        checks.carol_plan = user?.plan ?? "n/a";
      } catch (e) {
        checks.verify_error = e instanceof Error ? e.message.slice(0, 200) : String(e).slice(0, 200);
      }

      return NextResponse.json(checks);
    } catch (e) {
      checks.migrate_error = e instanceof Error ? e.message : String(e);
      return NextResponse.json(checks);
    }
  }

  // Default: diagnostic checks
  checks.AUTH_SECRET = process.env.AUTH_SECRET ? "set" : "missing";
  checks.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET ? "set" : "missing";
  checks.NEXTAUTH_URL = process.env.NEXTAUTH_URL ?? "missing";
  checks.DATABASE_URL = process.env.DATABASE_URL ? "set" : "missing";
  checks.NODE_ENV = process.env.NODE_ENV ?? "missing";
  checks.cwd = process.cwd();

  // Check what files exist
  try {
    const fs = await import("fs");
    checks.entrypoint_exists = fs.existsSync(path.join(APP_ROOT, "entrypoint.sh")) ? "yes" : "no";
    checks.prisma_schema_exists = fs.existsSync(path.join(APP_ROOT, "packages/db/prisma/schema.prisma")) ? "yes" : "no";
    checks.prisma_cli_exists = fs.existsSync(path.join(APP_ROOT, "node_modules/prisma/build/index.js")) ? "yes" : "no";
    checks.seed_sql_exists = fs.existsSync(path.join(APP_ROOT, "packages/db/prisma/seed.sql")) ? "yes" : "no";
    checks.migrations_dir = fs.existsSync(path.join(APP_ROOT, "packages/db/prisma/migrations")) ? "yes" : "no";
  } catch (e) {
    checks.fs_error = e instanceof Error ? e.message : String(e);
  }

  // Check Prisma
  try {
    const { prisma } = await import("@defi-tracker/db");
    checks.prisma_import = "ok";
    const user = await prisma.user.findUnique({
      where: { email: "carol@example.com" },
      select: { id: true, email: true, plan: true, passwordHash: true },
    });
    checks.carol_exists = user ? "yes" : "no";
    if (user) {
      checks.carol_plan = user.plan ?? "n/a";
      checks.carol_has_hash = user.passwordHash ? "yes" : "no";
      try {
        const bcrypt = await import("bcryptjs");
        const isValid = await bcrypt.compare("SeedP@ssw0rd!", user.passwordHash);
        checks.password_verify = isValid ? "match" : "mismatch";
      } catch (e) {
        checks.bcrypt_error = e instanceof Error ? e.message : String(e);
      }
    }
  } catch (e) {
    checks.prisma_error = e instanceof Error ? e.message.slice(0, 300) : String(e).slice(0, 300);
  }

  return NextResponse.json(checks);
}
