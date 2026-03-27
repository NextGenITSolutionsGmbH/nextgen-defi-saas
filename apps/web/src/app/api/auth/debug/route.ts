import { NextResponse } from "next/server";
import { execSync } from "child_process";
import path from "path";

const BUILD_ID = "ba2fe23-entrypoint";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");
  const checks: Record<string, string> = {};

  checks.build_id = BUILD_ID;

  // Action: run migrations via Prisma's programmatic API
  if (action === "migrate") {
    try {
      // Try multiple possible paths for Prisma CLI
      const schemaPaths = [
        "packages/db/prisma/schema.prisma",
        path.join(process.cwd(), "packages/db/prisma/schema.prisma"),
      ];

      const cliPaths = [
        "node node_modules/prisma/build/index.js",
        "npx prisma",
        "node_modules/.bin/prisma",
      ];

      let migrated = false;
      for (const cli of cliPaths) {
        for (const schema of schemaPaths) {
          try {
            const cmd = `${cli} migrate deploy --schema ${schema}`;
            checks[`try_${cli.replace(/[^a-z]/g, "_")}`] = cmd;
            const output = execSync(cmd, {
              timeout: 30000,
              encoding: "utf-8",
              env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
            });
            checks.migrate_result = output.trim().slice(0, 500);
            migrated = true;
            break;
          } catch (e) {
            checks[`error_${cli.replace(/[^a-z]/g, "_")}`] =
              e instanceof Error ? e.message.slice(0, 200) : String(e).slice(0, 200);
          }
        }
        if (migrated) break;
      }

      // Also try seeding
      if (migrated) {
        try {
          const seedOutput = execSync(
            `node node_modules/prisma/build/index.js db execute --file packages/db/prisma/seed.sql --schema packages/db/prisma/schema.prisma`,
            { timeout: 15000, encoding: "utf-8", env: process.env as NodeJS.ProcessEnv }
          );
          checks.seed_result = seedOutput.trim().slice(0, 200);
        } catch (e) {
          checks.seed_error = e instanceof Error ? e.message.slice(0, 200) : String(e).slice(0, 200);
        }
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
    checks.entrypoint_exists = fs.existsSync("entrypoint.sh") ? "yes" : "no";
    checks.prisma_schema_exists = fs.existsSync("packages/db/prisma/schema.prisma") ? "yes" : "no";
    checks.prisma_cli_exists = fs.existsSync("node_modules/prisma/build/index.js") ? "yes" : "no";
    checks.seed_sql_exists = fs.existsSync("packages/db/prisma/seed.sql") ? "yes" : "no";
    checks.migrations_dir = fs.existsSync("packages/db/prisma/migrations") ? "yes" : "no";
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
