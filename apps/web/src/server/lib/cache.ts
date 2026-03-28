import "server-only";

// ---------------------------------------------------------------------------
// Redis-backed tRPC query cache with graceful fallthrough
// ---------------------------------------------------------------------------
import { createRedisConnection } from "@defi-tracker/shared/queue";
import type Redis from "ioredis";
import { createHash } from "node:crypto";
import superjson from "superjson";
import { protectedProcedure } from "../trpc";

// ---------------------------------------------------------------------------
// Redis singleton (lazy-initialised, same pattern as rate-limit.ts)
// ---------------------------------------------------------------------------

let _redis: Redis | null = null;
let _redisUnavailable = false;

function getRedis(): Redis | null {
  if (_redisUnavailable) return null;
  if (_redis) return _redis;

  try {
    _redis = createRedisConnection();

    _redis.on("error", () => {
      _redisUnavailable = true;
      _redis = null;
    });

    return _redis;
  } catch {
    _redisUnavailable = true;
    return null;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Hash the raw input to produce a short, deterministic cache key segment.
 * Uses SHA-256 truncated to 16 hex chars (64 bits of collision resistance).
 */
function hashInput(input: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(input ?? ""))
    .digest("hex")
    .slice(0, 16);
}

/**
 * tRPC middleware marker — required for middleware return values.
 * The marker is the literal string 'middlewareMarker' at runtime;
 * we cast it to satisfy the branded type from @trpc/server internals.
 */
const middlewareMarker = "middlewareMarker" as "middlewareMarker" & {
  __brand: "middlewareMarker";
};

// ---------------------------------------------------------------------------
// Cached procedure factory
// ---------------------------------------------------------------------------

/**
 * Creates a tRPC procedure builder that wraps `protectedProcedure` with a
 * Redis caching layer.
 *
 * - Before handler: checks Redis for a cached result; returns it on hit.
 * - After handler: writes the result to Redis with the given TTL.
 * - Falls through transparently when Redis is unavailable.
 *
 * Cache key format: `trpc:cache:<userId>:<procedurePath>:<sha256(input)[0:16]>`
 *
 * @param ttlSeconds  Time-to-live for cached entries (in seconds).
 */
export function createCachedProcedure(ttlSeconds: number) {
  return protectedProcedure.use(async ({ ctx, next, path, getRawInput }) => {
    const redis = getRedis();
    const rawInput = await getRawInput();
    const key = `trpc:cache:${ctx.user.id}:${path}:${hashInput(rawInput)}`;

    // --- Cache HIT check ---
    if (redis) {
      try {
        const cached = await redis.get(key);
        if (cached !== null) {
          // Reconstruct a valid tRPC middleware result with the cached data.
          // The middleware return type requires { marker, ok, data }.
          return {
            marker: middlewareMarker,
            ok: true as const,
            data: superjson.parse(cached),
          };
        }
      } catch {
        // Redis read failed — fall through to handler
      }
    }

    // --- Execute the actual handler ---
    const result = await next();

    // --- Cache WRITE on success ---
    if (redis && result.ok) {
      try {
        await redis.set(
          key,
          superjson.stringify(result.data),
          "EX",
          ttlSeconds,
        );
      } catch {
        // Ignore cache write failures — the response is still valid
      }
    }

    return result;
  });
}

// ---------------------------------------------------------------------------
// Cache invalidation
// ---------------------------------------------------------------------------

/**
 * Invalidate cached entries for a specific user matching one or more patterns.
 *
 * Each pattern is expanded to `trpc:cache:<userId>:<pattern>:*` and all
 * matching keys are deleted via `KEYS` + `DEL`.
 *
 * Patterns use Redis glob syntax:
 * - `"dashboard.*"` matches all dashboard procedure caches
 * - `"wallet.*"`    matches all wallet procedure caches
 * - `"*"`           matches everything for the user
 *
 * Silently no-ops when Redis is unavailable.
 */
export async function invalidateCache(
  userId: string,
  patterns: string[],
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    for (const pattern of patterns) {
      const keys = await redis.keys(`trpc:cache:${userId}:${pattern}:*`);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    }
  } catch {
    // Ignore cache invalidation failures — stale data will expire via TTL
  }
}
