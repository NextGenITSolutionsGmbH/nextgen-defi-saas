import { NextResponse } from "next/server";
import { createRedisConnection } from "@defi-tracker/shared/queue";
import type Redis from "ioredis";

let _healthRedis: Redis | null = null;
function getHealthRedis(): Redis {
  if (!_healthRedis) _healthRedis = createRedisConnection();
  return _healthRedis;
}

export async function GET() {
  const healthcheck = {
    status: "ok" as "ok" | "degraded",
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION ?? "0.1.0",
    db: "unknown" as string,
    redis: "unknown" as string,
    auth: {
      urlProtocol: (() => {
        try {
          const url = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL;
          return url ? new URL(url).protocol : "not-set";
        } catch {
          return "invalid";
        }
      })(),
      secureCookies: process.env.NODE_ENV === "production" ? "forced" : "auto",
    },
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
    const redis = getHealthRedis();
    const pong = await redis.ping();
    healthcheck.redis = pong === "PONG" ? "connected" : "error";
  } catch {
    healthcheck.redis = "disconnected";
    healthcheck.status = "degraded";
  }

  // Always return 200 so load balancers and deploy health checks
  // treat the app as available. DB status is in the response body
  // for monitoring tools to inspect.
  return NextResponse.json(healthcheck, { status: 200 });
}
