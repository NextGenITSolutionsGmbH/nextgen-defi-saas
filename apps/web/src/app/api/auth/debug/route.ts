import { NextResponse } from "next/server";

export async function GET() {
  const checks: Record<string, string> = {};

  // 1. Check environment variables
  checks.AUTH_SECRET = process.env.AUTH_SECRET ? "set" : "missing";
  checks.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET ? "set" : "missing";
  checks.NEXTAUTH_URL = process.env.NEXTAUTH_URL ?? "missing";
  checks.DATABASE_URL = process.env.DATABASE_URL ? "set" : "missing";
  checks.NODE_ENV = process.env.NODE_ENV ?? "missing";

  // 2. Check Prisma client import
  try {
    const { prisma } = await import("@defi-tracker/db");
    checks.prisma_import = "ok";

    // 3. Check DB query
    const user = await prisma.user.findUnique({
      where: { email: "carol@example.com" },
      select: { id: true, email: true, plan: true, passwordHash: true },
    });
    checks.carol_exists = user ? "yes" : "no";
    checks.carol_plan = user?.plan ?? "n/a";
    checks.carol_has_hash = user?.passwordHash ? "yes" : "no";

    // 4. Check bcrypt import
    try {
      const bcrypt = await import("bcryptjs");
      checks.bcrypt_import = "ok";

      // 5. Test password verification
      if (user?.passwordHash) {
        const isValid = await bcrypt.compare("SeedP@ssw0rd!", user.passwordHash);
        checks.password_verify = isValid ? "match" : "mismatch";
      }
    } catch (e) {
      checks.bcrypt_import = `error: ${e instanceof Error ? e.message : String(e)}`;
    }
  } catch (e) {
    checks.prisma_import = `error: ${e instanceof Error ? e.message : String(e)}`;
  }

  // 6. Check NextAuth import
  try {
    await import("next-auth");
    checks.nextauth_import = "ok";
  } catch (e) {
    checks.nextauth_import = `error: ${e instanceof Error ? e.message : String(e)}`;
  }

  return NextResponse.json(checks);
}
