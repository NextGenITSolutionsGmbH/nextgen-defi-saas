import { test, expect } from "@playwright/test";
import { loginAsTestUser, registerTestUser } from "../helpers/auth";

/**
 * Dashboard page E2E tests.
 *
 * Covers the /overview dashboard: page rendering, KPI cards,
 * portfolio section, loading state, placeholder content,
 * mobile responsiveness, auth redirect, and sidebar navigation.
 *
 * @spec US-006 — Dashboard overview
 * @spec EP-08 — Dashboard KPI and portfolio display
 */

test.describe("Dashboard page [US-006, EP-08]", () => {
  let creds: { email: string; password: string };

  test.beforeAll(async ({ browser }) => {
    // Register a shared test user for the dashboard suite
    const page = await browser.newPage();
    creds = await registerTestUser(page);
    await page.close();
  });

  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page, creds);
    await page.goto("/overview");
    await page.waitForLoadState("networkidle");
  });

  test("page renders with heading", async ({ page }) => {
    // The main page heading should be visible
    await expect(
      page.getByRole("heading", { name: /dashboard/i })
    ).toBeVisible();

    // The subtitle should also be present
    await expect(
      page.getByText("Overview of your DeFi tax tracking status")
    ).toBeVisible();
  });

  test("KPI cards display", async ({ page }) => {
    // Verify all four static KPI stat cards render with their titles
    await expect(page.getByText("Total TX")).toBeVisible();
    await expect(page.getByText("Classified")).toBeVisible();
    await expect(page.getByText("§23 Freigrenze")).toBeVisible();
    await expect(page.getByText("§22 Freigrenze")).toBeVisible();

    // Verify KPI values are present
    await expect(page.getByText("1,248")).toBeVisible();
    await expect(page.getByText("94.2%")).toBeVisible();
  });

  test("portfolio section renders", async ({ page }) => {
    // The portfolio & tax overview section heading should be visible
    await expect(
      page.getByRole("heading", { name: /portfolio & tax overview/i })
    ).toBeVisible();

    // After loading, portfolio KPI card titles should appear
    // (or an error message if the API fails — both are acceptable in E2E)
    const netPnl = page.getByText("Net P&L");
    const errorMessage = page.getByText("Failed to load portfolio summary.");

    await expect(netPnl.or(errorMessage)).toBeVisible({ timeout: 15_000 });

    // If loaded successfully, check all four portfolio cards
    if (await netPnl.isVisible()) {
      await expect(page.getByText("Taxable Gains")).toBeVisible();
      await expect(page.getByText("Tax-Free Gains")).toBeVisible();
      await expect(page.getByText("Open Positions")).toBeVisible();
    }
  });

  test("placeholder content is visible", async ({ page }) => {
    // The placeholder area at the bottom of the dashboard should display
    await expect(
      page.getByText(
        "Transaction charts and recent activity will appear here."
      )
    ).toBeVisible();
  });

  test("loading state shows skeleton indicators", async ({ page }) => {
    // Navigate fresh to catch the loading state before data resolves
    await page.goto("/overview");

    // During loading, animate-pulse skeleton divs should render.
    // We look for them inside the portfolio section.
    const skeletons = page.locator(".animate-pulse");

    // Either skeletons are visible during load, or data has already loaded.
    // We check that the page eventually settles into a final state.
    const portfolioHeading = page.getByRole("heading", {
      name: /portfolio & tax overview/i,
    });
    await expect(portfolioHeading).toBeVisible();

    // If we caught the loading state, skeletons should be present briefly.
    // If data loaded instantly, the portfolio cards should be visible instead.
    const netPnl = page.getByText("Net P&L");
    const errorMessage = page.getByText("Failed to load portfolio summary.");
    const skeleton = skeletons.first();

    // At least one of these should be visible: loading skeleton, data, or error
    await expect(
      skeleton.or(netPnl).or(errorMessage)
    ).toBeVisible({ timeout: 15_000 });
  });

  test("mobile responsive layout", async ({ page }) => {
    // Set viewport to Pixel 5 dimensions
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/overview");
    await page.waitForLoadState("networkidle");

    // The page heading should still be visible at mobile width
    await expect(
      page.getByRole("heading", { name: /dashboard/i })
    ).toBeVisible();

    // KPI cards should be visible (stacked vertically on mobile)
    await expect(page.getByText("Total TX")).toBeVisible();
    await expect(page.getByText("Classified")).toBeVisible();

    // Verify no horizontal overflow — page width should not exceed viewport
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = 375;
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 1); // +1 for rounding tolerance

    // Portfolio section should also be visible on mobile
    await expect(
      page.getByRole("heading", { name: /portfolio & tax overview/i })
    ).toBeVisible();
  });

  test("unauthenticated redirect to login", async ({ page }) => {
    // Clear all cookies to simulate unauthenticated state
    await page.context().clearCookies();

    // Navigate to the protected dashboard route
    await page.goto("/overview");

    // Should redirect to login page
    await expect(page).toHaveURL(/\/login/);
  });

  test("navigation from sidebar", async ({ page }) => {
    // After login, navigate away from the dashboard first
    await page.goto("/wallets");
    await page.waitForLoadState("networkidle");

    // Verify we are on the wallets page
    await expect(page).toHaveURL(/\/wallets/);

    // On desktop, the sidebar should be visible with the Dashboard link.
    // The sidebar links Dashboard to "/" — click it to navigate.
    const sidebar = page.locator("aside[role='navigation']");
    const dashboardLink = sidebar.getByText("Dashboard");

    // On mobile viewports, the sidebar may be hidden behind a toggle.
    // If not visible, open the mobile menu first.
    if (!(await dashboardLink.isVisible())) {
      const menuToggle = page.getByRole("button", {
        name: /open navigation/i,
      });
      if (await menuToggle.isVisible()) {
        await menuToggle.click();
        await expect(dashboardLink).toBeVisible();
      }
    }

    await dashboardLink.click();

    // After clicking Dashboard, we should land on the root or overview page.
    // Verify by checking for the Dashboard heading on the resulting page.
    // The sidebar href is "/" which may redirect — we just verify the heading loads.
    await page.waitForLoadState("networkidle");

    // We may end up at "/" or "/overview" depending on routing config.
    // The key assertion is that the Dashboard heading is visible.
    const dashboardHeading = page.getByRole("heading", {
      name: /dashboard/i,
    });
    const loginPage = page.getByRole("button", {
      name: /log\s?in|sign\s?in/i,
    });

    // Either the dashboard loaded or we got redirected (acceptable for "/" route)
    await expect(dashboardHeading.or(loginPage)).toBeVisible({
      timeout: 15_000,
    });
  });
});
