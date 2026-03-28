// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

/**
 * @spec NFR-P01 — Rate limiting (sliding window)
 * @spec NFR-P02 — Redis-backed rate limiting with in-memory fallback
 */

// ---------------------------------------------------------------------------
// Mock createRedisConnection before importing the module under test
// ---------------------------------------------------------------------------

const mockPipeline = {
  zremrangebyscore: vi.fn().mockReturnThis(),
  zadd: vi.fn().mockReturnThis(),
  zcard: vi.fn().mockReturnThis(),
  pexpire: vi.fn().mockReturnThis(),
  exec: vi.fn(),
};

const mockRedisInstance = {
  on: vi.fn(),
  pipeline: vi.fn(() => mockPipeline),
  zrange: vi.fn(),
};

const mockCreateRedisConnection = vi.fn();

vi.mock("@defi-tracker/shared/queue", () => ({
  createRedisConnection: (...args: unknown[]) => mockCreateRedisConnection(...args),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Import a fresh module instance (resets singletons). */
async function freshImport() {
  vi.resetModules();

  // Re-register the mock after resetModules
  vi.doMock("@defi-tracker/shared/queue", () => ({
    createRedisConnection: (...args: unknown[]) => mockCreateRedisConnection(...args),
  }));

  const mod = await import("../rate-limit");
  return mod;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("checkRateLimit — in-memory fallback (Redis unavailable)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockCreateRedisConnection.mockImplementation(() => {
      throw new Error("Redis unavailable");
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("first request succeeds with remaining = maxRequests - 1", async () => {
    const { checkRateLimit } = await freshImport();

    const result = await checkRateLimit("test:key:1", 5, 60_000);

    expect(result.success).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("requests up to maxRequests succeed, then next is rejected", async () => {
    const { checkRateLimit } = await freshImport();
    const key = "test:key:2";
    const maxRequests = 3;
    const windowMs = 60_000;

    // Use up all allowed requests
    for (let i = 0; i < maxRequests; i++) {
      const result = await checkRateLimit(key, maxRequests, windowMs);
      expect(result.success).toBe(true);
      expect(result.remaining).toBe(maxRequests - (i + 1));
    }

    // Next request should be rejected
    const rejected = await checkRateLimit(key, maxRequests, windowMs);
    expect(rejected.success).toBe(false);
    expect(rejected.remaining).toBe(0);
  });

  it("after window expires, requests are allowed again", async () => {
    const { checkRateLimit } = await freshImport();
    const key = "test:key:3";
    const maxRequests = 2;
    const windowMs = 10_000;

    // Exhaust the limit
    await checkRateLimit(key, maxRequests, windowMs);
    await checkRateLimit(key, maxRequests, windowMs);

    const rejected = await checkRateLimit(key, maxRequests, windowMs);
    expect(rejected.success).toBe(false);

    // Advance time past the window
    vi.advanceTimersByTime(windowMs + 1);

    const allowed = await checkRateLimit(key, maxRequests, windowMs);
    expect(allowed.success).toBe(true);
    expect(allowed.remaining).toBe(maxRequests - 1);
  });

  it("different keys are tracked independently", async () => {
    const { checkRateLimit } = await freshImport();
    const maxRequests = 1;
    const windowMs = 60_000;

    const resultA = await checkRateLimit("key:a", maxRequests, windowMs);
    expect(resultA.success).toBe(true);

    // key:a is now exhausted
    const rejectedA = await checkRateLimit("key:a", maxRequests, windowMs);
    expect(rejectedA.success).toBe(false);

    // key:b should still be available
    const resultB = await checkRateLimit("key:b", maxRequests, windowMs);
    expect(resultB.success).toBe(true);
  });

  it("resetInMs is calculated correctly when rate limited", async () => {
    const { checkRateLimit } = await freshImport();
    const maxRequests = 1;
    const windowMs = 30_000;

    await checkRateLimit("test:reset", maxRequests, windowMs);

    // Advance 10 seconds
    vi.advanceTimersByTime(10_000);

    const rejected = await checkRateLimit("test:reset", maxRequests, windowMs);
    expect(rejected.success).toBe(false);
    // The oldest timestamp was ~10s ago; the window is 30s; so resetInMs ~ 20_000
    expect(rejected.resetInMs).toBeGreaterThan(0);
    expect(rejected.resetInMs).toBeLessThanOrEqual(windowMs);
  });
});

describe("checkRateLimit — Redis path", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockCreateRedisConnection.mockReturnValue(mockRedisInstance);
    mockRedisInstance.on.mockReset();
    mockRedisInstance.pipeline.mockReturnValue(mockPipeline);
    mockPipeline.zremrangebyscore.mockReturnThis();
    mockPipeline.zadd.mockReturnThis();
    mockPipeline.zcard.mockReturnThis();
    mockPipeline.pexpire.mockReturnThis();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns success when pipeline reports count <= maxRequests", async () => {
    const { checkRateLimit } = await freshImport();
    const maxRequests = 10;

    // Pipeline results: [zremrangebyscore, zadd, zcard, pexpire]
    mockPipeline.exec.mockResolvedValue([
      [null, 0],     // zremrangebyscore
      [null, 1],     // zadd
      [null, 3],     // zcard — 3 requests, under limit of 10
      [null, 1],     // pexpire
    ]);

    const result = await checkRateLimit("redis:key:1", maxRequests, 60_000);

    expect(result.success).toBe(true);
    expect(result.remaining).toBe(maxRequests - 3);
    expect(result.resetInMs).toBe(60_000);
  });

  it("returns failure when pipeline reports count > maxRequests", async () => {
    const { checkRateLimit } = await freshImport();
    const maxRequests = 5;
    const now = Date.now();

    mockPipeline.exec.mockResolvedValue([
      [null, 0],
      [null, 1],
      [null, 6],     // zcard — 6 requests, over limit of 5
      [null, 1],
    ]);

    // The module fetches the oldest score to compute resetInMs
    mockRedisInstance.zrange.mockResolvedValue([
      `${now}-0.123`,
      String(now - 5_000),  // oldest score is 5s ago
    ]);

    const result = await checkRateLimit("redis:key:2", maxRequests, 60_000);

    expect(result.success).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.resetInMs).toBeGreaterThan(0);
  });

  it("falls back to memory when pipeline.exec() returns null", async () => {
    const { checkRateLimit } = await freshImport();

    mockPipeline.exec.mockResolvedValue(null);

    const result = await checkRateLimit("redis:null-pipeline", 5, 60_000);

    // Should succeed via in-memory fallback
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(4);
  });
});

describe("checkRateLimit — Redis initialization failures", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("falls back to memory when createRedisConnection() throws", async () => {
    vi.useFakeTimers();
    mockCreateRedisConnection.mockImplementation(() => {
      throw new Error("Connection refused");
    });

    const { checkRateLimit } = await freshImport();

    const result = await checkRateLimit("init:throw", 5, 60_000);

    expect(result.success).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("falls back to memory when Redis connection emits error", async () => {
    vi.useFakeTimers();

    let errorHandler: (() => void) | undefined;
    const redisWithError = {
      on: vi.fn((event: string, handler: () => void) => {
        if (event === "error") {
          errorHandler = handler;
        }
      }),
      pipeline: vi.fn(() => mockPipeline),
      zrange: vi.fn(),
    };

    mockCreateRedisConnection.mockReturnValue(redisWithError);

    const { checkRateLimit } = await freshImport();

    // First call establishes connection
    mockPipeline.exec.mockResolvedValue([
      [null, 0],
      [null, 1],
      [null, 1],
      [null, 1],
    ]);
    await checkRateLimit("error:key", 5, 60_000);

    // Simulate Redis error event
    expect(errorHandler).toBeDefined();
    errorHandler!();

    // Next call should use memory fallback
    const result = await checkRateLimit("error:key2", 5, 60_000);
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(4);
  });
});

describe("checkRateLimit — edge cases", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockCreateRedisConnection.mockImplementation(() => {
      throw new Error("Redis unavailable");
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("concurrent calls with same key work correctly", async () => {
    const { checkRateLimit } = await freshImport();
    const maxRequests = 3;

    // Fire multiple requests simultaneously
    const results = await Promise.all([
      checkRateLimit("concurrent:key", maxRequests, 60_000),
      checkRateLimit("concurrent:key", maxRequests, 60_000),
      checkRateLimit("concurrent:key", maxRequests, 60_000),
    ]);

    // All three should succeed (they execute sequentially in the same event loop tick
    // for the in-memory path, so each sees the prior writes)
    const successCount = results.filter((r) => r.success).length;
    expect(successCount).toBe(3);

    // The fourth should be rejected
    const rejected = await checkRateLimit("concurrent:key", maxRequests, 60_000);
    expect(rejected.success).toBe(false);
  });

  it("cleanup timer removes expired entries from memory store", async () => {
    const { checkRateLimit } = await freshImport();
    const windowMs = 10_000;

    // Create an entry
    await checkRateLimit("cleanup:key", 5, windowMs);

    // Advance past the window so the entry expires
    vi.advanceTimersByTime(windowMs + 1);

    // Trigger the cleanup interval (runs every 60s)
    vi.advanceTimersByTime(60_000);

    // The key should now allow requests again (fresh window)
    const result = await checkRateLimit("cleanup:key", 5, windowMs);
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(4);
  });
});
