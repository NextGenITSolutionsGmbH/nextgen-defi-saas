import { test, expect } from "@playwright/test";
import { loginAsTestUser, registerTestUser } from "../helpers/auth";

/**
 * Wallets page E2E tests.
 *
 * Covers the wallet CRUD lifecycle: empty state, add via manual input,
 * duplicate detection, chain badge display, removal, and mobile layout.
 */

test.describe("Wallets page", () => {
  const VALID_FLARE_ADDRESS = "0x1234567890abcdef1234567890abcdef12345678";
  const SECOND_FLARE_ADDRESS = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";

  let creds: { email: string; password: string };

  test.beforeAll(async ({ browser }) => {
    // Register a shared test user for the wallet suite
    const page = await browser.newPage();
    creds = await registerTestUser(page);
    await page.close();
  });

  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page, creds);
    await page.goto("/wallets");
    await page.waitForLoadState("networkidle");
  });

  test("shows empty state when no wallets exist", async ({ page }) => {
    // The empty state should display the "No wallets yet" message
    const emptyHeading = page.getByText("No wallets yet");
    await expect(emptyHeading).toBeVisible();

    const emptyDescription = page.getByText(
      "Add your first wallet to start tracking transactions."
    );
    await expect(emptyDescription).toBeVisible();
  });

  test("add wallet via manual address input", async ({ page }) => {
    // Click the "Add Wallet" button to reveal the form
    await page.getByRole("button", { name: /add wallet/i }).click();

    // The form should be visible
    await expect(page.getByText("Add New Wallet")).toBeVisible();

    // Fill in wallet address manually
    const addressInput = page.getByPlaceholder("0x...");
    await addressInput.fill(VALID_FLARE_ADDRESS);

    // Optionally set a label
    const labelInput = page.getByPlaceholder("My main wallet");
    await labelInput.fill("E2E Test Wallet");

    // Submit the form — use the submit button inside the form (not the top-level Add Wallet button)
    const submitButton = page.getByRole("button", { name: /^add wallet$/i });
    await submitButton.click();

    // Wait for the wallet to appear in the list
    await expect(page.getByText("E2E Test Wallet")).toBeVisible({
      timeout: 15_000,
    });

    // The wallet address should be displayed (truncated)
    await expect(page.getByText(VALID_FLARE_ADDRESS)).toBeVisible();
  });

  test("adding a duplicate wallet shows an error", async ({ page }) => {
    // First, add a wallet
    await page.getByRole("button", { name: /add wallet/i }).click();
    await page.getByPlaceholder("0x...").fill(VALID_FLARE_ADDRESS);
    await page.getByPlaceholder("My main wallet").fill("First Wallet");
    await page.getByRole("button", { name: /^add wallet$/i }).click();

    // Wait for it to appear
    await expect(page.getByText("First Wallet")).toBeVisible({
      timeout: 15_000,
    });

    // Try to add the same address again
    await page.getByRole("button", { name: /add wallet/i }).click();
    await page.getByPlaceholder("0x...").fill(VALID_FLARE_ADDRESS);
    await page.getByRole("button", { name: /^add wallet$/i }).click();

    // Should see an error message (e.g., "already exists", "duplicate", etc.)
    const errorMessage = page.locator("text=/already|duplicate|exists|error/i");
    await expect(errorMessage).toBeVisible({ timeout: 10_000 });
  });

  test("wallet list shows chain badge", async ({ page }) => {
    // Add a wallet with default chain (Flare)
    await page.getByRole("button", { name: /add wallet/i }).click();
    await page.getByPlaceholder("0x...").fill(SECOND_FLARE_ADDRESS);
    await page.getByPlaceholder("My main wallet").fill("Chain Badge Wallet");
    await page.getByRole("button", { name: /^add wallet$/i }).click();

    // Wait for the wallet card to appear
    await expect(page.getByText("Chain Badge Wallet")).toBeVisible({
      timeout: 15_000,
    });

    // The chain badge "Flare" should be visible on the wallet card
    await expect(page.getByText("Flare")).toBeVisible();
  });

  test("remove wallet disappears from list", async ({ page }) => {
    // Add a wallet first
    await page.getByRole("button", { name: /add wallet/i }).click();
    await page.getByPlaceholder("0x...").fill(SECOND_FLARE_ADDRESS);
    await page.getByPlaceholder("My main wallet").fill("To Be Removed");
    await page.getByRole("button", { name: /^add wallet$/i }).click();

    await expect(page.getByText("To Be Removed")).toBeVisible({
      timeout: 15_000,
    });

    // Accept the confirmation dialog when it appears
    page.on("dialog", (dialog) => dialog.accept());

    // Click the trash/remove button on the wallet card.
    // The remove button is inside the wallet card that contains our label.
    const walletCard = page.locator("div").filter({ hasText: "To Be Removed" }).first();
    const removeButton = walletCard.locator("button").filter({ has: page.locator("svg") }).last();
    await removeButton.click();

    // The wallet should disappear from the list
    await expect(page.getByText("To Be Removed")).not.toBeVisible({
      timeout: 15_000,
    });
  });

  test("mobile responsive layout", async ({ page, browserName }) => {
    // This test is most meaningful on the mobile-chrome project,
    // but we verify basic responsiveness at a narrow viewport too.
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/wallets");
    await page.waitForLoadState("networkidle");

    // The page heading should still be visible
    await expect(
      page.getByRole("heading", { name: /wallets/i })
    ).toBeVisible();

    // The "Add Wallet" button should be accessible
    const addButton = page.getByRole("button", { name: /add wallet/i });
    await expect(addButton).toBeVisible();

    // Click to open the form — it should fit within the mobile viewport
    await addButton.click();
    await expect(page.getByText("Add New Wallet")).toBeVisible();

    // The form inputs should be visible and not overflow
    await expect(page.getByPlaceholder("0x...")).toBeVisible();
  });
});
