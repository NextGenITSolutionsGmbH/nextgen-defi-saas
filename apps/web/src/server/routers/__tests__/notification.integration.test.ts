import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — vitest hoists these to the top of the file before any imports
// ---------------------------------------------------------------------------
vi.mock("../../queue", () => ({
  addWalletSyncJob: vi.fn().mockResolvedValue("mock-job-id"),
  addExportJob: vi.fn().mockResolvedValue("mock-job-id"),
  addPriceFetchJob: vi.fn().mockResolvedValue("mock-job-id"),
  addEmailJob: vi.fn().mockResolvedValue("mock-job-id"),
  getWalletSyncQueue: vi.fn(),
  getExportQueue: vi.fn(),
  getPriceFetchQueue: vi.fn(),
  getEmailQueue: vi.fn(),
  WALLET_SYNC_QUEUE: "wallet-sync",
  EXPORT_QUEUE: "export",
  PRICE_FETCH_QUEUE: "price-fetch",
  EMAIL_QUEUE: "email",
}));

vi.mock("server-only", () => ({}));

vi.mock("../../../lib/stripe", () => ({
  stripe: {},
  getStripe: vi.fn(),
  STRIPE_PRICE_IDS: { PRO: "price_pro", BUSINESS: "price_biz", KANZLEI: "price_kanzlei" },
}));

vi.mock("../../../lib/auth", () => ({
  auth: vi.fn().mockResolvedValue(null),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------
import {
  createTestUser,
  disconnectTestDb,
  prisma,
} from "../../../../../../tests/helpers/db";
import {
  createTestCaller,
  createUnauthenticatedCaller,
} from "../../../../../../tests/helpers/trpc";
import type { TestCaller } from "../../../../../../tests/helpers/trpc";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

/**
 * @spec FR-02-05 — Notification preferences management
 * @spec US-010 — User notification settings
 */

describe("notification router — integration [FR-02-05, US-010]", () => {
  let userId: string;
  let caller: TestCaller;

  beforeAll(async () => {
    const user = await createTestUser({ plan: "PRO" });
    userId = user.id;
    caller = createTestCaller(userId, "PRO");
  });

  afterAll(async () => {
    // Clean up only this suite's data
    await prisma.notificationPreference
      .deleteMany({ where: { userId } })
      .catch(() => {});
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    await disconnectTestDb();
  });

  // =========================================================================
  // notification.getPreferences
  // =========================================================================

  describe("notification.getPreferences", () => {
    it("returns default preferences (all false) for a new user", async () => {
      // Ensure no row exists yet
      await prisma.notificationPreference
        .deleteMany({ where: { userId } })
        .catch(() => {});

      const prefs = await caller.notification.getPreferences();

      expect(prefs).toMatchObject({
        exportComplete: false,
        syncError: false,
        taxReminder: false,
      });
      expect(prefs.id).toBeDefined();
    });

    it("returns existing preferences after they have been set", async () => {
      // First set a preference
      await caller.notification.updatePreferences({ exportComplete: true });

      const prefs = await caller.notification.getPreferences();

      expect(prefs.exportComplete).toBe(true);
      expect(prefs.syncError).toBe(false);
      expect(prefs.taxReminder).toBe(false);
    });
  });

  // =========================================================================
  // notification.updatePreferences
  // =========================================================================

  describe("notification.updatePreferences", () => {
    it("sets exportComplete: true and returns updated preferences", async () => {
      // Reset to defaults
      await prisma.notificationPreference
        .deleteMany({ where: { userId } })
        .catch(() => {});

      const prefs = await caller.notification.updatePreferences({
        exportComplete: true,
      });

      expect(prefs.exportComplete).toBe(true);
      expect(prefs.syncError).toBe(false);
      expect(prefs.taxReminder).toBe(false);
    });

    it("sets syncError: true", async () => {
      await prisma.notificationPreference
        .deleteMany({ where: { userId } })
        .catch(() => {});

      const prefs = await caller.notification.updatePreferences({
        syncError: true,
      });

      expect(prefs.syncError).toBe(true);
      expect(prefs.exportComplete).toBe(false);
      expect(prefs.taxReminder).toBe(false);
    });

    it("sets taxReminder: true", async () => {
      await prisma.notificationPreference
        .deleteMany({ where: { userId } })
        .catch(() => {});

      const prefs = await caller.notification.updatePreferences({
        taxReminder: true,
      });

      expect(prefs.taxReminder).toBe(true);
      expect(prefs.exportComplete).toBe(false);
      expect(prefs.syncError).toBe(false);
    });

    it("partial update: updating one field does not affect others", async () => {
      // Start with exportComplete and syncError both true
      await prisma.notificationPreference
        .deleteMany({ where: { userId } })
        .catch(() => {});
      await caller.notification.updatePreferences({
        exportComplete: true,
        syncError: true,
      });

      // Now update only taxReminder
      const prefs = await caller.notification.updatePreferences({
        taxReminder: true,
      });

      expect(prefs.exportComplete).toBe(true);
      expect(prefs.syncError).toBe(true);
      expect(prefs.taxReminder).toBe(true);
    });

    it("creates preferences row if it does not exist (upsert)", async () => {
      // Ensure no row exists
      await prisma.notificationPreference
        .deleteMany({ where: { userId } })
        .catch(() => {});

      // Verify no row in DB
      const before = await prisma.notificationPreference.findUnique({
        where: { userId },
      });
      expect(before).toBeNull();

      const prefs = await caller.notification.updatePreferences({
        exportComplete: true,
      });

      expect(prefs.exportComplete).toBe(true);
      expect(prefs.id).toBeDefined();

      // Verify row was created in DB
      const after = await prisma.notificationPreference.findUnique({
        where: { userId },
      });
      expect(after).not.toBeNull();
    });

    it("toggles a preference off after setting it on", async () => {
      await prisma.notificationPreference
        .deleteMany({ where: { userId } })
        .catch(() => {});

      // Turn on
      await caller.notification.updatePreferences({ syncError: true });

      // Turn off
      const prefs = await caller.notification.updatePreferences({
        syncError: false,
      });

      expect(prefs.syncError).toBe(false);
    });
  });

  // =========================================================================
  // Unauthenticated access
  // =========================================================================

  describe("unauthenticated access", () => {
    it("throws UNAUTHORIZED for getPreferences", async () => {
      const anonCaller = createUnauthenticatedCaller();
      await expect(
        anonCaller.notification.getPreferences(),
      ).rejects.toThrow(/logged in/i);
    });

    it("throws UNAUTHORIZED for updatePreferences", async () => {
      const anonCaller = createUnauthenticatedCaller();
      await expect(
        anonCaller.notification.updatePreferences({ exportComplete: true }),
      ).rejects.toThrow(/logged in/i);
    });
  });
});
