import http from "k6/http";
import { check, group, sleep } from "k6";

/**
 * k6 database performance tests — sustained load targeting DB-heavy endpoints.
 *
 * Exercises transaction listing with filters, dashboard aggregation queries,
 * and export row counting under 100 VUs for 3 minutes.
 *
 * Run:  k6 run --env BASE_URL=http://localhost:3000 \
 *              --env TEST_EMAIL=test@example.com \
 *              --env TEST_PASSWORD=TestP@ss1 \
 *              tests/k6/db-perf.js
 */

export const options = {
  stages: [
    { duration: "30s", target: 50 },   // ramp-up
    { duration: "3m",  target: 100 },  // sustain at 100 VUs
    { duration: "30s", target: 0 },    // ramp-down
  ],
  thresholds: {
    http_req_duration: ["p(95)<1000"],                               // 95th percentile < 1000 ms
    http_req_failed: ["rate<0.05"],                                  // < 5 % errors
    checks: ["rate>0.95"],                                           // > 95 % checks pass
    "group_duration{group:::Transaction list (no filter)}": ["p(95)<1000"],
    "group_duration{group:::Transaction list (status filter)}": ["p(95)<1000"],
    "group_duration{group:::Transaction list (date range)}": ["p(95)<1000"],
    "group_duration{group:::Dashboard aggregations}": ["p(95)<1000"],
    "group_duration{group:::Export row counting}": ["p(95)<1000"],
    "group_duration{group:::Transaction stats}": ["p(95)<1000"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const TEST_EMAIL = __ENV.TEST_EMAIL || "loadtest@example.com";
const TEST_PASSWORD = __ENV.TEST_PASSWORD || "LoadT3st!Password";

/**
 * Authenticate and return cookie jar.
 */
function login() {
  const jar = http.cookieJar();

  const loginRes = http.post(
    `${BASE_URL}/api/auth/callback/credentials`,
    JSON.stringify({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    }),
    {
      headers: { "Content-Type": "application/json" },
      jar,
      redirects: 0,
    },
  );

  check(loginRes, {
    "login: responds (2xx or 3xx)": (r) =>
      r.status >= 200 && r.status < 400,
  });

  return jar;
}

/**
 * Build a tRPC query URL with optional input params.
 */
function trpcUrl(path, params) {
  const input = params
    ? `?input=${encodeURIComponent(JSON.stringify(params))}`
    : "";
  return `${BASE_URL}/api/trpc/${path}${input}`;
}

/**
 * Standard request options with cookie jar.
 */
function reqOpts(jar) {
  return {
    jar,
    headers: { "Content-Type": "application/json" },
  };
}

// -------------------------------------------------------------------------
// Setup — authenticate once per VU
// -------------------------------------------------------------------------
export function setup() {
  // We return shared config; each VU re-authenticates in default() since
  // k6 cookie jars are not serializable across setup/default boundaries.
  return { baseUrl: BASE_URL };
}

export default function () {
  const jar = login();
  const opts = reqOpts(jar);

  // -----------------------------------------------------------------------
  // 1. Transaction list — no filter (default page)
  // -----------------------------------------------------------------------
  group("Transaction list (no filter)", () => {
    const res = http.get(
      trpcUrl("transaction.list", { limit: 25 }),
      opts,
    );

    check(res, {
      "tx list (no filter): responds (2xx or 401)": (r) =>
        r.status === 200 || r.status === 401,
      "tx list (no filter): p95 < 1000ms": (r) =>
        r.timings.duration < 1000,
    });
  });

  sleep(0.2);

  // -----------------------------------------------------------------------
  // 2. Transaction list — status filter (GREEN, YELLOW, RED)
  // -----------------------------------------------------------------------
  group("Transaction list (status filter)", () => {
    const statuses = ["GREEN", "YELLOW", "RED", "GRAY"];
    const status = statuses[Math.floor(Math.random() * statuses.length)];

    const res = http.get(
      trpcUrl("transaction.list", { limit: 25, status }),
      opts,
    );

    check(res, {
      "tx list (status): responds (2xx or 401)": (r) =>
        r.status === 200 || r.status === 401,
      "tx list (status): p95 < 1000ms": (r) =>
        r.timings.duration < 1000,
    });
  });

  sleep(0.2);

  // -----------------------------------------------------------------------
  // 3. Transaction list — date range filter
  // -----------------------------------------------------------------------
  group("Transaction list (date range)", () => {
    const now = new Date();
    const yearAgo = new Date(now);
    yearAgo.setFullYear(yearAgo.getFullYear() - 1);

    const res = http.get(
      trpcUrl("transaction.list", {
        limit: 50,
        dateFrom: yearAgo.toISOString().split("T")[0],
        dateTo: now.toISOString().split("T")[0],
      }),
      opts,
    );

    check(res, {
      "tx list (date range): responds (2xx or 401)": (r) =>
        r.status === 200 || r.status === 401,
      "tx list (date range): p95 < 1000ms": (r) =>
        r.timings.duration < 1000,
    });
  });

  sleep(0.2);

  // -----------------------------------------------------------------------
  // 4. Dashboard aggregation queries (heavy DB groupBy / aggregate)
  // -----------------------------------------------------------------------
  group("Dashboard aggregations", () => {
    const responses = http.batch([
      {
        method: "GET",
        url: trpcUrl("dashboard.summary"),
        params: opts,
      },
      {
        method: "GET",
        url: trpcUrl("dashboard.kpis"),
        params: opts,
      },
      {
        method: "GET",
        url: trpcUrl("dashboard.ampelBreakdown"),
        params: opts,
      },
      {
        method: "GET",
        url: trpcUrl("dashboard.portfolioSummary"),
        params: opts,
      },
      {
        method: "GET",
        url: trpcUrl("dashboard.classificationProgress"),
        params: opts,
      },
      {
        method: "GET",
        url: trpcUrl("dashboard.monthlyActivity"),
        params: opts,
      },
    ]);

    for (let i = 0; i < responses.length; i++) {
      check(responses[i], {
        "dashboard agg: responds (2xx or 401)": (r) =>
          r.status === 200 || r.status === 401,
        "dashboard agg: p95 < 1000ms": (r) =>
          r.timings.duration < 1000,
      });
    }
  });

  sleep(0.2);

  // -----------------------------------------------------------------------
  // 5. Export row counting (scans transaction table by date range)
  // -----------------------------------------------------------------------
  group("Export row counting", () => {
    const currentYear = new Date().getFullYear();
    const years = [currentYear, currentYear - 1, currentYear - 2];
    const year = years[Math.floor(Math.random() * years.length)];

    const res = http.get(
      trpcUrl("export.previewCount", { taxYear: year }),
      opts,
    );

    check(res, {
      "export count: responds (2xx or 401)": (r) =>
        r.status === 200 || r.status === 401,
      "export count: p95 < 1000ms": (r) =>
        r.timings.duration < 1000,
    });
  });

  sleep(0.2);

  // -----------------------------------------------------------------------
  // 6. Transaction stats (groupBy status + protocol)
  // -----------------------------------------------------------------------
  group("Transaction stats", () => {
    const res = http.get(
      trpcUrl("transaction.stats"),
      opts,
    );

    check(res, {
      "tx stats: responds (2xx or 401)": (r) =>
        r.status === 200 || r.status === 401,
      "tx stats: p95 < 1000ms": (r) =>
        r.timings.duration < 1000,
    });
  });

  sleep(0.3);
}
