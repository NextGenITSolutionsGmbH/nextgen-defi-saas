// ---------------------------------------------------------------------------
// Redis-backed sliding window rate limiter with in-memory fallback
// ---------------------------------------------------------------------------
import { createRedisConnection } from "@defi-tracker/shared/queue";
import type Redis from "ioredis";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RateLimitResult {
  /** Whether the request is allowed */
  success: boolean;
  /** How many requests remain in the current window */
  remaining: number;
  /** Milliseconds until the window resets (oldest entry expires) */
  resetInMs: number;
}

// ---------------------------------------------------------------------------
// Redis singleton (lazy-initialised, shared across all rate-limit checks)
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
// In-memory fallback store (used when Redis is unavailable)
// ---------------------------------------------------------------------------

const memoryStore = new Map<string, number[]>();

function cleanupMemoryStore(windowMs: number): void {
  const now = Date.now();
  for (const [key, timestamps] of memoryStore) {
    const valid = timestamps.filter((ts) => now - ts < windowMs);
    if (valid.length === 0) {
      memoryStore.delete(key);
    } else {
      memoryStore.set(key, valid);
    }
  }
}

// Periodically clean stale entries every 60 seconds
setInterval(() => cleanupMemoryStore(15 * 60 * 1_000), 60_000).unref();

// ---------------------------------------------------------------------------
// In-memory sliding window check
// ---------------------------------------------------------------------------

function checkMemoryRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const windowStart = now - windowMs;

  const timestamps = (memoryStore.get(key) ?? []).filter(
    (ts) => ts > windowStart,
  );

  if (timestamps.length >= maxRequests) {
    const oldestInWindow = timestamps[0]!;
    const resetInMs = oldestInWindow + windowMs - now;
    return {
      success: false,
      remaining: 0,
      resetInMs: Math.max(resetInMs, 0),
    };
  }

  timestamps.push(now);
  memoryStore.set(key, timestamps);

  return {
    success: true,
    remaining: maxRequests - timestamps.length,
    resetInMs: windowMs,
  };
}

// ---------------------------------------------------------------------------
// Redis sliding window check (sorted set + pipeline)
// ---------------------------------------------------------------------------

async function checkRedisRateLimit(
  redis: Redis,
  key: string,
  maxRequests: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = now - windowMs;
  const redisKey = `rate-limit:${key}`;

  const pipeline = redis.pipeline();
  pipeline.zremrangebyscore(redisKey, 0, windowStart);
  pipeline.zadd(redisKey, now, `${now}-${Math.random()}`);
  pipeline.zcard(redisKey);
  pipeline.pexpire(redisKey, windowMs);

  const results = await pipeline.exec();
  if (!results) {
    return checkMemoryRateLimit(key, maxRequests, windowMs);
  }

  // ZCARD result is at index 2
  const count = (results[2]?.[1] as number) ?? 0;

  if (count > maxRequests) {
    // Fetch the oldest entry to compute reset time
    const oldest = await redis.zrange(redisKey, 0, 0, "WITHSCORES");
    const oldestScore = oldest[1] ? Number(oldest[1]) : now;
    const resetInMs = oldestScore + windowMs - now;

    return {
      success: false,
      remaining: 0,
      resetInMs: Math.max(resetInMs, 0),
    };
  }

  return {
    success: true,
    remaining: maxRequests - count,
    resetInMs: windowMs,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check whether a request identified by `key` is within the allowed rate.
 *
 * Uses a Redis sorted-set sliding window when Redis is available, and falls
 * back to an in-memory Map<string, number[]> otherwise.
 *
 * @param key          Unique identifier (e.g. `register:${ip}`)
 * @param maxRequests  Maximum number of requests allowed within the window
 * @param windowMs     Sliding window duration in milliseconds
 */
export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const redis = getRedis();

  if (!redis) {
    return checkMemoryRateLimit(key, maxRequests, windowMs);
  }

  try {
    return await checkRedisRateLimit(redis, key, maxRequests, windowMs);
  } catch {
    // Redis failed at runtime — fall back to memory
    return checkMemoryRateLimit(key, maxRequests, windowMs);
  }
}
