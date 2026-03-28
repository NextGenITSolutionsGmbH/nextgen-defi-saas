import http from "k6/http";
import { check, group, sleep } from "k6";
import { Trend } from "k6/metrics";

/**
 * k6 load test — sustained load to surface performance regressions.
 *
 * Includes unauthenticated health/page checks AND authenticated tRPC endpoint
 * testing (dashboard queries, wallet list, transaction list).
 *
 * Run:  k6 run tests/k6/load.js
 * Auth: k6 run --env TEST_EMAIL=test@example.com \
 *              --env TEST_PASSWORD=TestP@ss1 \
 *              tests/k6/load.js
 *
 * @spec NFR-P01 — 500 concurrent VU sustained load
 * @spec NFR-P02 — p95 response time < 500ms under load
 * @spec NFR-P03 — Error rate < 5% under sustained load
 * @spec NFR-P08 — Dashboard tRPC queries p95 < 300ms
 * @spec NFR-P09 — Transaction list tRPC query p95 < 500ms
 */

// Custom metrics for tRPC endpoint tracking
const dashboardDuration = new Trend("trpc_dashboard_duration", true);
const transactionListDuration = new Trend("trpc_transaction_list_duration", true);
const walletListDuration = new Trend("trpc_wallet_list_duration", true);

export const options = {
  stages: [
    { duration: "30s", target: 100 },   // ramp-up
    { duration: "3m",  target: 500 },   // sustain at 500 VUs
    { duration: "30s", target: 100 },   // ramp-down partially
    { duration: "1m",  target: 0 },     // ramp-down to 0
  ],
  thresholds: {
    http_req_duration: ["p(95)<500"],                        // 95th percentile < 500 ms
    http_req_failed: ["rate<0.05"],                          // < 5 % errors
    checks: ["rate>0.95"],                                   // > 95 % checks pass
    trpc_dashboard_duration: ["p(95)<300"],                  // dashboard queries p95 < 300ms
    trpc_transaction_list_duration: ["p(95)<500"],           // transaction list p95 < 500ms
    trpc_wallet_list_duration: ["p(95)<500"],                // wallet list p95 < 500ms
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const TEST_EMAIL = __ENV.TEST_EMAIL || "loadtest@example.com";
const TEST_PASSWORD = __ENV.TEST_PASSWORD || "LoadT3st!Password";

/**
 * setup() runs once before VU execution. Authenticates and returns a session
 * cookie string that each VU can reuse for authenticated requests.
 */
export function setup() {
  // Attempt login to get session cookies for authenticated tRPC tests
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

  const loginSucceeded =
    loginRes.status >= 200 && loginRes.status < 400;

  // Extract cookies from the cookie jar for the base URL
  const cookies = jar.cookiesForURL(BASE_URL);

  return {
    authenticated: loginSucceeded,
    cookies,
  };
}

/**
 * Build cookie header string from cookie object returned by setup().
 */
function buildCookieHeader(cookies) {
  if (!cookies) return "";
  return Object.entries(cookies)
    .map(([name, values]) => {
      const val = Array.isArray(values) ? values[0] : values;
      return `${name}=${val}`;
    })
    .join("; ");
}

/**
 * Helper to call a tRPC query endpoint (GET) with auth cookies.
 */
function trpcGet(path, params, cookieHeader) {
  const input = params
    ? `?input=${encodeURIComponent(JSON.stringify(params))}`
    : "";
  return http.get(`${BASE_URL}/api/trpc/${path}${input}`, {
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader,
    },
  });
}

export default function (data) {
  // -------------------------------------------------------------------------
  // 1. Health endpoint (unauthenticated)
  // -------------------------------------------------------------------------
  group("Health endpoint", () => {
    const res = http.get(`${BASE_URL}/api/health`);

    check(res, {
      "health: status 200": (r) => r.status === 200,
      "health: body ok": (r) => {
        try {
          return JSON.parse(r.body).status === "ok";
        } catch {
          return false;
        }
      },
      "health: p95 < 500ms": (r) => r.timings.duration < 500,
    });
  });

  sleep(0.3);

  // -------------------------------------------------------------------------
  // 2. Auth endpoint probe (unauthenticated — expects 401/redirect)
  // -------------------------------------------------------------------------
  group("API endpoints", () => {
    const loginRes = http.post(
      `${BASE_URL}/api/auth/callback/credentials`,
      JSON.stringify({
        email: "loadtest@example.com",
        password: "LoadT3st!Invalid",
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );

    check(loginRes, {
      "login: responds (2xx or 4xx)": (r) =>
        r.status >= 200 && r.status < 500,
      "login: p95 < 500ms": (r) => r.timings.duration < 500,
    });
  });

  sleep(0.5);

  // -------------------------------------------------------------------------
  // 3. Static pages (unauthenticated)
  // -------------------------------------------------------------------------
  group("Static pages", () => {
    const pages = ["/login", "/register"];
    const page = pages[Math.floor(Math.random() * pages.length)];

    const res = http.get(`${BASE_URL}${page}`);

    check(res, {
      [`${page}: status 200`]: (r) => r.status === 200,
      [`${page}: p95 < 500ms`]: (r) => r.timings.duration < 500,
    });
  });

  sleep(0.5);

  // -------------------------------------------------------------------------
  // 4. Authenticated tRPC — Dashboard batch queries
  // -------------------------------------------------------------------------
  if (data.authenticated) {
    const cookieHeader = buildCookieHeader(data.cookies);

    group("tRPC dashboard batch", () => {
      const endpoints = [
        "dashboard.summary",
        "dashboard.kpis",
        "dashboard.ampelBreakdown",
        "dashboard.recentTransactions",
        "dashboard.monthlyActivity",
        "dashboard.portfolioSummary",
        "dashboard.classificationProgress",
        "dashboard.haltefristUpcoming",
      ];

      const batchRequests = endpoints.map((ep) => ({
        method: "GET",
        url: `${BASE_URL}/api/trpc/${ep}`,
        params: {
          headers: {
            "Content-Type": "application/json",
            Cookie: cookieHeader,
          },
        },
      }));

      const responses = http.batch(batchRequests);

      for (let i = 0; i < responses.length; i++) {
        const r = responses[i];
        dashboardDuration.add(r.timings.duration);

        check(r, {
          "dashboard: responds (2xx or 401)": (res) =>
            res.status === 200 || res.status === 401,
          "dashboard: response time < 300ms": (res) =>
            res.timings.duration < 300,
        });
      }
    });

    sleep(0.3);

    // -----------------------------------------------------------------------
    // 5. Authenticated tRPC — Wallet list
    // -----------------------------------------------------------------------
    group("tRPC wallet list", () => {
      const res = trpcGet("wallet.list", undefined, cookieHeader);
      walletListDuration.add(res.timings.duration);

      check(res, {
        "wallet list: responds (2xx or 401)": (r) =>
          r.status === 200 || r.status === 401,
        "wallet list: response time < 500ms": (r) =>
          r.timings.duration < 500,
      });
    });

    sleep(0.3);

    // -----------------------------------------------------------------------
    // 6. Authenticated tRPC — Transaction list with pagination
    // -----------------------------------------------------------------------
    group("tRPC transaction list", () => {
      const res = trpcGet(
        "transaction.list",
        { limit: 25 },
        cookieHeader,
      );
      transactionListDuration.add(res.timings.duration);

      check(res, {
        "tx list: responds (2xx or 401)": (r) =>
          r.status === 200 || r.status === 401,
        "tx list: response time < 500ms": (r) =>
          r.timings.duration < 500,
      });

      // Second request with offset to test paginated performance
      const res2 = trpcGet(
        "transaction.list",
        { limit: 25, cursor: "page-2" },
        cookieHeader,
      );
      transactionListDuration.add(res2.timings.duration);

      check(res2, {
        "tx list page 2: responds (2xx or 401)": (r) =>
          r.status === 200 || r.status === 401,
        "tx list page 2: response time < 500ms": (r) =>
          r.timings.duration < 500,
      });
    });

    sleep(0.3);
  }
}
