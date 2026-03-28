import { test, expect } from "@playwright/test";

/**
 * @spec NFR-I06 — Uptime/health check endpoint (E2E)
 */

test.describe("Health endpoint [NFR-I06]", () => {
  test("GET /api/health returns 200", async ({ request }) => {
    const response = await request.get("/api/health");

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty("status", "ok");
  });

  test("health response includes a timestamp", async ({ request }) => {
    const response = await request.get("/api/health");
    const body = await response.json();

    expect(body).toHaveProperty("timestamp");
    // Timestamp should be a valid ISO-8601 string or Unix ms
    const ts = body.timestamp;
    const parsed = typeof ts === "number" ? new Date(ts) : new Date(ts);
    expect(parsed.getTime()).not.toBeNaN();
  });
});
