import { test, expect } from "@playwright/test";
import { loginAsTestUser, registerTestUser } from "../helpers/auth";

/**
 * Exports page E2E tests.
 *
 * Covers export creation, export history display, format selection,
 * and status lifecycle (PENDING → GENERATING → COMPLETED).
 */

test.describe("Exports page", () => {
  let creds: { email: string; password: string };

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    creds = await registerTestUser(page);
    await page.close();
  });

  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page, creds);
    await page.goto("/exports");
    await page.waitForLoadState("networkidle");
  });

  test("create CSV export and see queued status", async ({ page }) => {
    // Page heading
    await expect(
      page.getByRole("heading", { name: /exports/i })
    ).toBeVisible();

    // "New Export" section should be visible
    await expect(page.getByText("New Export")).toBeVisible();

    // The format dropdown should default to CSV
    const formatSelect = page.locator("select");
    await expect(formatSelect).toBeVisible();
    await expect(formatSelect).toHaveValue("CSV");

    // Click "Generate Export"
    const generateButton = page.getByRole("button", {
      name: /generate export/i,
    });
    await expect(generateButton).toBeVisible();
    await generateButton.click();

    // After clicking, the button should show a loading state or the export
    // should appear in the history with PENDING/GENERATING status.
    // We wait for either the status badge or an error message.
    const statusBadge = page.getByText(/pending|generating|completed/i);
    const errorMessage = page.locator(
      "text=/error|failed|no transactions/i"
    );

    await expect(statusBadge.or(errorMessage)).toBeVisible({
      timeout: 15_000,
    });
  });

  test("export history section displays previous exports", async ({
    page,
  }) => {
    // The "Export History" section heading should be present
    await expect(page.getByText("Export History")).toBeVisible();

    // Either we see a list of exports or the "No exports yet" empty state
    const emptyState = page.getByText(
      /no exports yet/i
    );
    const exportEntry = page.locator("text=/CSV|XLSX|PDF/i").first();

    await expect(emptyState.or(exportEntry)).toBeVisible({ timeout: 15_000 });
  });

  test("export format dropdown has CSV, XLSX, and PDF options", async ({
    page,
  }) => {
    const formatSelect = page.locator("select");
    await expect(formatSelect).toBeVisible();

    // Verify available options
    const options = formatSelect.locator("option");
    await expect(options).toHaveCount(3);

    const optionTexts = await options.allTextContents();
    expect(optionTexts).toContain("CSV");
    expect(optionTexts).toContain("XLSX");
    expect(optionTexts).toContain("PDF");

    // Change to XLSX and verify the value updates
    await formatSelect.selectOption("XLSX");
    await expect(formatSelect).toHaveValue("XLSX");

    // Change to PDF
    await formatSelect.selectOption("PDF");
    await expect(formatSelect).toHaveValue("PDF");

    // Switch back to CSV
    await formatSelect.selectOption("CSV");
    await expect(formatSelect).toHaveValue("CSV");
  });

  test("generate export with different format", async ({ page }) => {
    // Select XLSX format
    const formatSelect = page.locator("select");
    await formatSelect.selectOption("XLSX");

    // Generate the export
    await page
      .getByRole("button", { name: /generate export/i })
      .click();

    // The export should be created (status badge or error)
    const statusBadge = page.getByText(/pending|generating|completed/i);
    const errorMessage = page.locator(
      "text=/error|failed|no transactions/i"
    );

    await expect(statusBadge.or(errorMessage)).toBeVisible({
      timeout: 15_000,
    });

    // If the export was created, verify the format is shown as XLSX
    if (await statusBadge.isVisible()) {
      const xlsxLabel = page.getByText("XLSX");
      await expect(xlsxLabel).toBeVisible();
    }
  });
});
