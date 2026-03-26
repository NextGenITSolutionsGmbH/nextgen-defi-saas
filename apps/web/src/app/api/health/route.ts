import { NextResponse } from "next/server";

export async function GET() {
  const healthcheck = {
    status: "ok" as "ok" | "degraded",
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION ?? "0.1.0",
    db: "unknown" as string,
    redis: "unknown" as string,
  };

  try {
    const { prisma } = await import("@defi-tracker/db");
    await prisma.$queryRaw`SELECT 1`;
    healthcheck.db = "connected";
  } catch {
    healthcheck.db = "disconnected";
    healthcheck.status = "degraded";
  }

  try {
    // TODO: Implement Redis health check when Redis client is available
    healthcheck.redis = "not_configured";
  } catch {
    healthcheck.redis = "disconnected";
  }

  // Always return 200 so load balancers and deploy health checks
  // treat the app as available. DB status is in the response body
  // for monitoring tools to inspect.
  return NextResponse.json(healthcheck, { status: 200 });
}
