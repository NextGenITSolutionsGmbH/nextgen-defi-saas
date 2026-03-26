import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Unit tests for the /api/health route handler.
 *
 * The handler is expected to return a 200 JSON response with at least
 * a `status` field.  We dynamically import the route module so that
 * we can reset mocks between tests.
 */

// Mock the database client so the health check does not need a real DB
vi.mock("@defi-tracker/db", () => ({
  prisma: {
    $queryRaw: vi.fn().mockResolvedValue([{ "?column?": 1 }]),
    $disconnect: vi.fn(),
  },
}));

async function importRoute() {
  // Dynamic import so vi.mock is applied before module evaluation
  return import("../route");
}

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a 200 status code", async () => {
    const mod = await importRoute();

    // The route may export GET as a named export
    const handler = mod.GET ?? mod.default;
    expect(handler).toBeDefined();

    const request = new Request("http://localhost:3000/api/health", {
      method: "GET",
    });

    const response = await handler(request);
    expect(response.status).toBe(200);
  });

  it("returns JSON with a status field", async () => {
    const mod = await importRoute();
    const handler = mod.GET ?? mod.default;

    const request = new Request("http://localhost:3000/api/health", {
      method: "GET",
    });

    const response = await handler(request);
    const body = await response.json();

    expect(body).toHaveProperty("status");
    expect(body.status).toBe("ok");
  });

  it("includes a timestamp in the response", async () => {
    const mod = await importRoute();
    const handler = mod.GET ?? mod.default;

    const request = new Request("http://localhost:3000/api/health", {
      method: "GET",
    });

    const response = await handler(request);
    const body = await response.json();

    expect(body).toHaveProperty("timestamp");
  });
});
