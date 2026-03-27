export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NODE_ENV === "production") {
    const path = await import("path");
    const fs = await import("fs");

    const APP_ROOT = "/app";
    const { prisma } = await import("@defi-tracker/db");

    // Step 1: Check if migration is needed
    let needsMigration = false;
    try {
      await prisma.user.count();
      console.log("[startup] Database tables exist.");
    } catch {
      needsMigration = true;
      console.log("[startup] Tables missing — running migration...");
    }

    // Step 2: Run migration if needed
    if (needsMigration) {
      const migrationPath = path.join(APP_ROOT, "packages/db/prisma/migrations/0001_init/migration.sql");
      const fallbackPath = path.join(process.cwd(), "../../packages/db/prisma/migrations/0001_init/migration.sql");
      const sqlPath = fs.existsSync(migrationPath) ? migrationPath : fs.existsSync(fallbackPath) ? fallbackPath : null;

      if (sqlPath) {
        const sql = fs.readFileSync(sqlPath, "utf-8");
        const cleanedSql = sql
          .split("\n")
          .filter((line: string) => !line.trim().startsWith("--"))
          .join("\n");
        const statements = cleanedSql
          .split(";")
          .map((s: string) => s.trim())
          .filter((s: string) => s.length > 0);

        let executed = 0;
        for (const stmt of statements) {
          try {
            await prisma.$executeRawUnsafe(stmt);
            executed++;
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            if (msg.includes("already exists")) {
              executed++;
            } else {
              console.warn(`[startup] Migration failed: ${msg.slice(0, 100)}`);
            }
          }
        }
        console.log(`[startup] Executed ${executed}/${statements.length} migration statements.`);
      } else {
        console.warn("[startup] Migration SQL not found — skipping.");
      }
    }

    // Step 3: Always run seed (idempotent — ON CONFLICT DO NOTHING)
    const seedPath = fs.existsSync(path.join(APP_ROOT, "packages/db/prisma/seed.sql"))
      ? path.join(APP_ROOT, "packages/db/prisma/seed.sql")
      : fs.existsSync(path.join(process.cwd(), "../../packages/db/prisma/seed.sql"))
        ? path.join(process.cwd(), "../../packages/db/prisma/seed.sql")
        : null;

    if (seedPath) {
      try {
        const seedSql = fs.readFileSync(seedPath, "utf-8");
        await prisma.$executeRawUnsafe(seedSql);
        console.log("[startup] Seed completed.");
      } catch (e) {
        console.warn(`[startup] Seed failed: ${e instanceof Error ? e.message.slice(0, 100) : String(e).slice(0, 100)}`);
      }
    }
  }
}
