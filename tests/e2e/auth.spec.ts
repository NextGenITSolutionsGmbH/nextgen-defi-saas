import { test, expect } from "@playwright/test";

const TEST_USER = {
  email: `e2e-${Date.now()}@test.defi-tracker.local`,
  password: "E2eT3st!Secure#2025",
};

test.describe("Authentication flow", () => {
  test("register a new account", async ({ page }) => {
    await page.goto("/register");

    await page.getByLabel(/email/i).fill(TEST_USER.email);
    await page.getByLabel(/^password$/i).fill(TEST_USER.password);

    // Some forms have a confirm-password field
    const confirmField = page.getByLabel(/confirm/i);
    if (await confirmField.isVisible()) {
      await confirmField.fill(TEST_USER.password);
    }

    await page.getByRole("button", { name: /register|sign up|create account/i }).click();

    // Expect redirect to wallets (post-login landing), dashboard, or login page
    await expect(page).toHaveURL(/\/(wallets|dashboard|login)/);
  });

  test("login with valid credentials", async ({ page }) => {
    await page.goto("/login");

    await page.getByLabel(/email/i).fill(TEST_USER.email);
    await page.getByLabel(/password/i).fill(TEST_USER.password);
    await page.getByRole("button", { name: /log\s?in|sign\s?in/i }).click();

    // Successful login should redirect away from the login page
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("login with invalid credentials shows error", async ({ page }) => {
    await page.goto("/login");

    await page.getByLabel(/email/i).fill("nobody@invalid.example");
    await page.getByLabel(/password/i).fill("WrongPassword!99");
    await page.getByRole("button", { name: /log\s?in|sign\s?in/i }).click();

    // Should remain on login page and show an error
    await expect(page).toHaveURL(/\/login/);
    const errorMessage = page.getByText(/invalid|incorrect|failed|error/i);
    await expect(errorMessage).toBeVisible({ timeout: 5_000 });
  });

  test("protected route redirects unauthenticated users", async ({ page }) => {
    // Clear any existing cookies / storage
    await page.context().clearCookies();

    await page.goto("/wallets");

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
  });

  test("protected route is accessible after login", async ({ page }) => {
    // Login first
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(TEST_USER.email);
    await page.getByLabel(/password/i).fill(TEST_USER.password);
    await page.getByRole("button", { name: /log\s?in|sign\s?in/i }).click();
    await expect(page).not.toHaveURL(/\/login/);

    // Now navigate to a protected route
    await page.goto("/wallets");
    await expect(page).toHaveURL(/\/wallets/);
  });
});
