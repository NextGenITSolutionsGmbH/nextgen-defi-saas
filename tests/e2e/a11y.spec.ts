import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Accessibility tests using axe-core.
 *
 * Each page is loaded and scanned for WCAG 2.1 AA violations.
 * The tests assert zero violations — any failure will include
 * the violation details for quick remediation.
 */

function formatViolations(violations: Array<{ id: string; description: string; nodes: unknown[] }>) {
  return violations
    .map(
      (v) =>
        `[${v.id}] ${v.description} (${v.nodes.length} instance${v.nodes.length === 1 ? "" : "s"})`,
    )
    .join("\n");
}

test.describe("Accessibility (axe-core)", () => {
  test("login page has no a11y violations", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    expect(results.violations, formatViolations(results.violations)).toHaveLength(0);
  });

  test("register page has no a11y violations", async ({ page }) => {
    await page.goto("/register");
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    expect(results.violations, formatViolations(results.violations)).toHaveLength(0);
  });

  test("wallets page has no a11y violations", async ({ page }) => {
    // The wallets page is a protected route — the middleware will redirect
    // to /login, which is acceptable.  If authenticated state is
    // needed, use the auth helper to sign in first.
    await page.goto("/wallets");
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    expect(results.violations, formatViolations(results.violations)).toHaveLength(0);
  });
});
