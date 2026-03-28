import { test, expect } from "@playwright/test";
import { loginAsTestUser, registerTestUser } from "../helpers/auth";

/**
 * Settings page E2E tests.
 *
 * Covers profile display, plan badge, 2FA setup flow initiation,
 * password change form toggle, and notification preference toggles.
 *
 * @spec EP-08 — FIFO/LIFO selection and German tax settings
 */

test.describe("Settings page [EP-08]", () => {
  let creds: { email: string; password: string };

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    creds = await registerTestUser(page);
    await page.close();
  });

  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page, creds);
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");
  });

  test("displays profile information with email and plan", async ({
    page,
  }) => {
    // Page heading
    await expect(
      page.getByRole("heading", { name: /settings/i })
    ).toBeVisible();

    // Profile section should be present
    await expect(page.getByText("Profile")).toBeVisible();

    // Email label and value
    await expect(page.getByText("Email")).toBeVisible();
    await expect(page.getByText(creds.email)).toBeVisible();

    // Plan label should be visible (use exact to avoid matching "Aktueller Plan" button)
    await expect(page.getByText("Plan", { exact: true })).toBeVisible();

    // "Mitglied seit" (Member since) label
    await expect(page.getByText("Mitglied seit")).toBeVisible();

    // Wallets / Transaktionen stats label
    await expect(page.getByText("Wallets / Transaktionen")).toBeVisible();
  });

  test("plan badge displays current plan", async ({ page }) => {
    // The plan badge should show STARTER for a fresh test user
    const planBadge = page.locator("span").filter({ hasText: /^STARTER$/ });
    await expect(planBadge).toBeVisible({ timeout: 15_000 });

    // Plan options section (Steuereinstellungen / Tax Settings) should be present
    await expect(page.getByRole("heading", { name: "Steuereinstellungen" })).toBeVisible();

    // Verify FIFO is the default tax method
    const fifoRadio = page.locator("input[name='taxMethod'][value='FIFO']");
    await expect(fifoRadio).toBeChecked();
  });

  test("2FA setup flow shows QR generation step", async ({ page }) => {
    // Security section heading
    await expect(page.getByRole("heading", { name: "Sicherheit" })).toBeVisible();

    // 2FA label should be visible
    await expect(
      page.getByText("Zwei-Faktor-Authentifizierung (2FA)")
    ).toBeVisible();

    // For a new user, 2FA should not be enabled — "Aktivieren" button visible
    const enableButton = page.getByRole("button", {
      name: /aktivieren/i,
    });
    await expect(enableButton).toBeVisible();

    // Click to start 2FA setup
    await enableButton.click();

    // The setup flow should show the first step
    await expect(
      page.getByText("Schritt 1: Authenticator App vorbereiten")
    ).toBeVisible();

    // The "QR-Code generieren" button should be present
    const generateQrButton = page.getByRole("button", {
      name: /qr-code generieren/i,
    });
    await expect(generateQrButton).toBeVisible();

    // The "Abbrechen" (Cancel) button should be present
    await expect(
      page.getByRole("button", { name: /abbrechen/i })
    ).toBeVisible();

    // Cancel the flow
    await page.getByRole("button", { name: /abbrechen/i }).click();

    // After cancelling, the Aktivieren button should reappear
    await expect(enableButton).toBeVisible();
  });

  test("password change form opens and closes", async ({ page }) => {
    // The "Passwort ändern" label should be visible
    await expect(page.getByText("Passwort ändern")).toBeVisible();

    // Click the expand/chevron button next to password change.
    // The button is a sibling of the text container within the password section.
    // Use a tighter scope: the border-t div that contains "Passwort ändern"
    const passwordSection = page
      .locator("div.border-t")
      .filter({ hasText: /Passwort ändern/ });
    const expandButton = passwordSection.getByRole("button").first();
    await expandButton.click();

    // The password form fields should now be visible
    await expect(
      page.getByPlaceholder("Ihr aktuelles Passwort")
    ).toBeVisible();
    await expect(
      page.getByPlaceholder(/min\. 8 zeichen/i)
    ).toBeVisible();
    await expect(
      page.getByPlaceholder("Passwort wiederholen")
    ).toBeVisible();

    // The "Passwort ändern" submit button should be visible
    const submitButton = page.getByRole("button", {
      name: /passwort ändern/i,
    });
    await expect(submitButton).toBeVisible();

    // Cancel button should be present
    const cancelButton = page.getByRole("button", { name: /abbrechen/i });
    await expect(cancelButton).toBeVisible();

    // Close the form
    await cancelButton.click();

    // The password form fields should be hidden again
    await expect(
      page.getByPlaceholder("Ihr aktuelles Passwort")
    ).not.toBeVisible();
  });

  test("notification and data sections are displayed", async ({ page }) => {
    // Data & Privacy (DSGVO) section should be present
    await expect(
      page.getByText("Daten & Datenschutz (DSGVO)")
    ).toBeVisible();

    // "Meine Daten exportieren" (Export my data) should be visible
    await expect(page.getByText("Meine Daten exportieren")).toBeVisible();

    // DSGVO Art. 15 reference should be visible
    await expect(page.getByText(/DSGVO Art\. 15/i)).toBeVisible();

    // The tax year selector should be present in the tax settings section
    const taxYearSelect = page
      .locator("select")
      .filter({ has: page.locator(`option[value="${new Date().getFullYear()}"]`) });
    await expect(taxYearSelect.first()).toBeVisible();

    // Verify LIFO option is available but not selected by default
    const lifoLabel = page.getByText("LIFO — Last In, First Out");
    await expect(lifoLabel).toBeVisible();

    // Click LIFO and verify the warning appears
    await lifoLabel.click();
    await expect(
      page.getByText(/LIFO kann zu erhöhten Rückfragen/i)
    ).toBeVisible();

    // Switch back to FIFO
    await page.getByText("FIFO — First In, First Out").click();
    await expect(
      page.getByText(/LIFO kann zu erhöhten Rückfragen/i)
    ).not.toBeVisible();
  });
});
