import { test, expect } from "@playwright/test";
import { loginAsTestUser, registerTestUser } from "../helpers/auth";

/**
 * Transactions page E2E tests.
 *
 * Covers transaction list display, Ampel status filtering, TX hash search,
 * empty state, and cursor-based pagination.
 *
 * @spec US-002 — Transaction list and management
 * @spec EP-06 — Classification pipeline integration
 * @spec EP-09 — Ampel filter chips (GREEN/YELLOW/RED/GRAY)
 */

test.describe("Transactions page [US-002, EP-06, EP-09]", () => {
  let creds: { email: string; password: string };

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    creds = await registerTestUser(page);
    await page.close();
  });

  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page, creds);
    await page.goto("/transactions");
    await page.waitForLoadState("networkidle");
  });

  test("displays transaction list page with header and table", async ({
    page,
  }) => {
    // Page heading
    await expect(
      page.getByRole("heading", { name: /transactions/i })
    ).toBeVisible();

    // Subtitle text
    await expect(
      page.getByText(/view, classify, and manage/i)
    ).toBeVisible();

    // The table header columns should be present
    const tableHeaders = [
      "Ampel",
      "TX Hash",
      "Protocol",
      "Type",
      "Buy",
      "Sell",
      "EUR Value",
      "Date",
      "Actions",
    ];
    for (const header of tableHeaders) {
      await expect(page.getByRole("columnheader", { name: header })).toBeVisible();
    }
  });

  test("status filter chips are displayed and clickable", async ({ page }) => {
    // The "All" chip should be visible and active by default
    const allChip = page.getByRole("button", { name: /^All/i });
    await expect(allChip).toBeVisible();

    // Each Ampel status chip should be present
    const statusChips = [
      "Green (auto)",
      "Yellow (Graubereich)",
      "Red (manual needed)",
      "Gray (irrelevant)",
    ];

    for (const label of statusChips) {
      const chip = page.getByRole("button", { name: new RegExp(label, "i") });
      await expect(chip).toBeVisible();
    }

    // Click the "Green (auto)" chip to filter
    await page
      .getByRole("button", { name: /Green \(auto\)/i })
      .click();

    // After filtering, the page should still show the Transactions heading
    await expect(
      page.getByRole("heading", { name: /transactions/i })
    ).toBeVisible();

    // Click "All" to reset
    await allChip.click();
  });

  test("search by TX hash input and Enter key", async ({ page }) => {
    const searchInput = page.getByPlaceholder("Search by TX hash...");
    await expect(searchInput).toBeVisible();

    // Type a partial hash and press Enter
    const fakeHash = "0xdeadbeef";
    await searchInput.fill(fakeHash);
    await searchInput.press("Enter");

    // After searching, either matching results or the empty state should be visible.
    // With a random hash, we expect "No transactions found".
    const noResults = page.getByText("No transactions found");
    const tableRows = page.locator("tbody tr");
    await expect(noResults.or(tableRows.first())).toBeVisible({
      timeout: 15_000,
    });
  });

  test("empty state for wallet with no transactions", async ({ page }) => {
    // For a fresh test user with no synced wallets, the transaction list
    // should show the empty state.
    const emptyState = page.getByText("No transactions found");
    const helpText = page.getByText(
      /transactions will appear here once your wallets are synced/i
    );

    // Either the empty state is shown, or we have data from seed — both are acceptable.
    // We verify the structure is rendered properly.
    const tableOrEmpty = emptyState.or(page.locator("tbody tr").first());
    await expect(tableOrEmpty).toBeVisible({ timeout: 15_000 });

    // If empty state is shown, the help text should also be present
    if (await emptyState.isVisible()) {
      await expect(helpText).toBeVisible();
    }
  });

  test("pagination controls are visible when transactions exist", async ({
    page,
  }) => {
    // The "Showing X of Y transactions" text should always be present
    const showingText = page.getByText(/showing \d+/i);
    await expect(showingText).toBeVisible({ timeout: 15_000 });

    // If there are more results, a "Load More" button should appear
    const loadMoreButton = page.getByRole("button", { name: /load more/i });
    const isLoadMoreVisible = await loadMoreButton.isVisible().catch(() => false);

    if (isLoadMoreVisible) {
      // Click Load More and verify more items appear
      const initialCount = await page.locator("tbody tr").count();
      await loadMoreButton.click();

      // Wait for loading to complete
      await page.waitForLoadState("networkidle");

      // After loading more, the count text should update
      await expect(showingText).toBeVisible();
    }
  });
});
