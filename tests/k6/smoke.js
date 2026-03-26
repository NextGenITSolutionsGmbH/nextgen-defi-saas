import http from "k6/http";
import { check, sleep } from "k6";

/**
 * k6 smoke test — light load to verify the system is alive.
 *
 * Run:  k6 run tests/k6/smoke.js
 */

export const options = {
  vus: 10,
  duration: "2m",
  thresholds: {
    http_req_duration: ["p(95)<500"],     // 95th percentile < 500 ms
    http_req_failed: ["rate<0.01"],       // < 1 % errors
    checks: ["rate>0.99"],                // > 99 % checks pass
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

export default function () {
  const res = http.get(`${BASE_URL}/api/health`);

  check(res, {
    "status is 200": (r) => r.status === 200,
    "body contains ok": (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.status === "ok";
      } catch {
        return false;
      }
    },
    "response time < 500ms": (r) => r.timings.duration < 500,
  });

  sleep(1);
}
