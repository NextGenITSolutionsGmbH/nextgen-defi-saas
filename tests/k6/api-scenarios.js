import http from "k6/http";
import { check, group, sleep } from "k6";

/**
 * k6 API scenario tests — authenticated flows exercising tRPC endpoints.
 *
 * Covers login, dashboard load (parallel batch), wallet sync, and export creation.
 * Gated on workflow_dispatch only (not scheduled).
 *
 * Run:  k6 run --env BASE_URL=http://localhost:3000 \
 *              --env TEST_EMAIL=test@example.com \
 *              --env TEST_PASSWORD=TestP@ss1 \
 *              tests/k6/api-scenarios.js
 */

export const options = {
  stages: [
    { duration: "15s", target: 20 },   // ramp-up
    { duration: "2m",  target: 50 },   // sustain at 50 VUs
    { duration: "15s", target: 0 },    // ramp-down
  ],
  thresholds: {
    http_req_duration: ["p(95)<500"],   // 95th percentile < 500 ms
    http_req_failed: ["rate<0.05"],     // < 5 % errors
    checks: ["rate>0.95"],             // > 95 % checks pass
    "group_duration{group:::Login}": ["p(95)<1000"],
    "group_duration{group:::Dashboard batch}": ["p(95)<500"],
    "group_duration{group:::Wallet sync}": ["p(95)<500"],
    "group_duration{group:::Export creation}": ["p(95)<500"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const TEST_EMAIL = __ENV.TEST_EMAIL || "loadtest@example.com";
const TEST_PASSWORD = __ENV.TEST_PASSWORD || "LoadT3st!Password";

/**
 * Authenticate via NextAuth credentials callback and return the session cookie jar.
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
    "login: response time < 1000ms": (r) => r.timings.duration < 1000,
  });

  return jar;
}

/**
 * Helper to call a tRPC query endpoint (GET).
 */
function trpcQuery(path, params, jar) {
  const input = params ? `?input=${encodeURIComponent(JSON.stringify(params))}` : "";
  return {
    method: "GET",
    url: `${BASE_URL}/api/trpc/${path}${input}`,
    params: {
      jar,
      headers: { "Content-Type": "application/json" },
    },
  };
}

/**
 * Helper to call a tRPC mutation endpoint (POST).
 */
function trpcMutate(path, input, jar) {
  return http.post(
    `${BASE_URL}/api/trpc/${path}`,
    JSON.stringify(input),
    {
      headers: { "Content-Type": "application/json" },
      jar,
    },
  );
}

export default function () {
  let jar;

  // -----------------------------------------------------------------------
  // 1. Login scenario
  // -----------------------------------------------------------------------
  group("Login", () => {
    jar = login();
  });

  sleep(0.5);

  // -----------------------------------------------------------------------
  // 2. Dashboard load — parallel batch of all dashboard endpoints
  // -----------------------------------------------------------------------
  group("Dashboard batch", () => {
    const responses = http.batch([
      trpcQuery("dashboard.summary", undefined, jar),
      trpcQuery("dashboard.kpis", undefined, jar),
      trpcQuery("dashboard.ampelBreakdown", undefined, jar),
      trpcQuery("dashboard.recentTransactions", undefined, jar),
      trpcQuery("dashboard.monthlyActivity", undefined, jar),
      trpcQuery("dashboard.portfolioSummary", undefined, jar),
      trpcQuery("dashboard.classificationProgress", undefined, jar),
      trpcQuery("dashboard.haltefristUpcoming", undefined, jar),
    ]);

    for (let i = 0; i < responses.length; i++) {
      const r = responses[i];
      check(r, {
        "dashboard: responds (2xx or 401)": (res) =>
          res.status === 200 || res.status === 401,
        "dashboard: response time < 500ms": (res) =>
          res.timings.duration < 500,
      });
    }
  });

  sleep(0.5);

  // -----------------------------------------------------------------------
  // 3. Transaction list with filters
  // -----------------------------------------------------------------------
  group("Transaction list", () => {
    const listRes = http.get(
      `${BASE_URL}/api/trpc/transaction.list?input=${encodeURIComponent(
        JSON.stringify({ limit: 25 }),
      )}`,
      { jar, headers: { "Content-Type": "application/json" } },
    );

    check(listRes, {
      "tx list: responds (2xx or 401)": (r) =>
        r.status === 200 || r.status === 401,
      "tx list: response time < 500ms": (r) => r.timings.duration < 500,
    });
  });

  sleep(0.3);

  // -----------------------------------------------------------------------
  // 4. Wallet sync trigger
  // -----------------------------------------------------------------------
  group("Wallet sync", () => {
    // First fetch wallets to get a valid wallet ID
    const walletsRes = http.get(`${BASE_URL}/api/trpc/wallet.list`, {
      jar,
      headers: { "Content-Type": "application/json" },
    });

    check(walletsRes, {
      "wallet list: responds (2xx or 401)": (r) =>
        r.status === 200 || r.status === 401,
    });

    // Attempt sync with a placeholder UUID — expect 401 (unauthed) or error
    // In real perf test with valid auth, this would trigger the sync queue.
    const syncRes = trpcMutate(
      "wallet.sync",
      { walletId: "00000000-0000-0000-0000-000000000000" },
      jar,
    );

    check(syncRes, {
      "wallet sync: responds (not 5xx)": (r) => r.status < 500,
      "wallet sync: response time < 500ms": (r) => r.timings.duration < 500,
    });
  });

  sleep(0.3);

  // -----------------------------------------------------------------------
  // 5. Export creation
  // -----------------------------------------------------------------------
  group("Export creation", () => {
    // Preview count first (read-only)
    const previewRes = http.get(
      `${BASE_URL}/api/trpc/export.previewCount?input=${encodeURIComponent(
        JSON.stringify({ taxYear: new Date().getFullYear() }),
      )}`,
      { jar, headers: { "Content-Type": "application/json" } },
    );

    check(previewRes, {
      "export preview: responds (2xx or 401)": (r) =>
        r.status === 200 || r.status === 401,
      "export preview: response time < 500ms": (r) =>
        r.timings.duration < 500,
    });

    // Attempt export creation
    const createRes = trpcMutate(
      "export.create",
      {
        taxYear: new Date().getFullYear(),
        method: "FIFO",
        format: "CSV",
      },
      jar,
    );

    check(createRes, {
      "export create: responds (not 5xx)": (r) => r.status < 500,
      "export create: response time < 500ms": (r) =>
        r.timings.duration < 500,
    });

    // List exports
    const listRes = http.get(`${BASE_URL}/api/trpc/export.list`, {
      jar,
      headers: { "Content-Type": "application/json" },
    });

    check(listRes, {
      "export list: responds (2xx or 401)": (r) =>
        r.status === 200 || r.status === 401,
      "export list: response time < 500ms": (r) =>
        r.timings.duration < 500,
    });
  });

  sleep(0.5);
}
