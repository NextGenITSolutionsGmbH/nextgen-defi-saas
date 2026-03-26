import type { Page } from "@playwright/test";
import { createTestUser, type CreateTestUserOptions } from "./db";

// -------------------- E2E auth helper --------------------

export interface TestCredentials {
  email: string;
  password: string;
}

/**
 * Log in as a test user via the UI.
 *
 * Navigates to /login, fills the form, and waits for the redirect
 * away from the login page.
 */
export async function loginAsTestUser(
  page: Page,
  credentials: TestCredentials,
): Promise<void> {
  await page.goto("/login");

  await page.getByLabel(/email/i).fill(credentials.email);
  await page.getByLabel(/password/i).fill(credentials.password);
  await page.getByRole("button", { name: /log\s?in|sign\s?in/i }).click();

  // Wait until we leave the login page (successful auth)
  await page.waitForURL((url) => !url.pathname.includes("/login"), {
    timeout: 10_000,
  });
}

/**
 * Register a fresh test user via the UI and return the credentials.
 */
export async function registerTestUser(
  page: Page,
  credentials?: Partial<TestCredentials>,
): Promise<TestCredentials> {
  const creds: TestCredentials = {
    email: credentials?.email ?? `e2e-${Date.now()}@test.defi-tracker.local`,
    password: credentials?.password ?? "E2eTestP@ss!2025",
  };

  await page.goto("/register");

  await page.getByLabel(/email/i).fill(creds.email);
  await page.getByLabel(/^password$/i).fill(creds.password);

  const confirmField = page.getByLabel(/confirm/i);
  if (await confirmField.isVisible()) {
    await confirmField.fill(creds.password);
  }

  await page.getByRole("button", { name: /register|sign up/i }).click();

  await page.waitForURL((url) => !url.pathname.includes("/register"), {
    timeout: 10_000,
  });

  return creds;
}

// -------------------- Integration / tRPC auth helper --------------------

/**
 * Create an authenticated tRPC caller context for integration tests.
 *
 * This creates a real User row in the test database and returns a
 * session-like object that can be injected into a tRPC caller.
 */
export async function createAuthenticatedCaller(
  options?: CreateTestUserOptions,
): Promise<{
  user: { id: string; email: string; plan: string };
  session: { user: { id: string; email: string }; expires: string };
}> {
  const user = await createTestUser(options);

  const session = {
    user: {
      id: user.id,
      email: user.email,
    },
    expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour
  };

  return {
    user: {
      id: user.id,
      email: user.email,
      plan: user.plan,
    },
    session,
  };
}
