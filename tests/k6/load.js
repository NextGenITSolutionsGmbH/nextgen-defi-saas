import http from "k6/http";
import { check, group, sleep } from "k6";

/**
 * k6 load test — sustained load to surface performance regressions.
 *
 * Run:  k6 run tests/k6/load.js
 *
 * @spec NFR-P01 — 500 concurrent VU sustained load
 * @spec NFR-P02 — p95 response time < 500ms under load
 * @spec NFR-P03 — Error rate < 5% under sustained load
 */

export const options = {
  stages: [
    { duration: "30s", target: 100 },   // ramp-up
    { duration: "3m",  target: 500 },   // sustain at 500 VUs
    { duration: "30s", target: 100 },   // ramp-down partially
    { duration: "1m",  target: 0 },     // ramp-down to 0
  ],
  thresholds: {
    http_req_duration: ["p(95)<500"],    // 95th percentile < 500 ms
    http_req_failed: ["rate<0.05"],      // < 5 % errors
    checks: ["rate>0.95"],               // > 95 % checks pass
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

export default function () {
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

  group("API endpoints", () => {
    // Login endpoint — expect 401 for invalid creds (ensures the route responds)
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
}
