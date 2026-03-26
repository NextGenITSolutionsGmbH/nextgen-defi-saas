import { NextResponse } from "next/server";

export async function GET() {
  const healthcheck = {
    status: "ok" as const,
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
    healthcheck.status = "degraded" as unknown as "ok";
  }

  try {
    // TODO: Implement Redis health check when Redis client is available
    // const redis = await import("@/lib/redis");
    // await redis.ping();
    healthcheck.redis = "not_configured";
  } catch {
    healthcheck.redis = "disconnected";
  }

  const statusCode = healthcheck.status === "ok" ? 200 : 503;

  return NextResponse.json(healthcheck, { status: statusCode });
}
