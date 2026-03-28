import { defineConfig, devices } from "@playwright/test";

const isCI = !!process.env.CI;
const port = process.env.E2E_PORT ?? "3008";
const baseURL = process.env.BASE_URL ?? `http://localhost:${port}`;

export default defineConfig({
  testDir: ".",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : 2,
  reporter: isCI ? "github" : "html",
  timeout: 90_000,
  expect: {
    timeout: 30_000,
  },

  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    ...(process.env.CI_FULL !== "false"
      ? [
          {
            name: "mobile-chrome",
            use: { ...devices["Pixel 5"] },
          },
        ]
      : []),
  ],

  globalSetup: "./global-setup.ts",

  webServer: {
    command: isCI
      ? `PORT=${port} pnpm --filter @defi-tracker/web start`
      : `PORT=${port} pnpm --filter @defi-tracker/web dev`,
    url: `${baseURL}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
