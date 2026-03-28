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
  createTestWallet,
  createTestTransaction,
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
 * @spec US-006 — Dashboard summary and Ampel breakdown
 * @spec EP-08 — Dashboard data endpoint
 */

describe("dashboard router — integration [US-006, EP-08]", () => {
  let userId: string;
  let caller: TestCaller;

  beforeAll(async () => {
    const user = await createTestUser({ plan: "PRO" });
    userId = user.id;
    caller = createTestCaller(userId, "PRO");

    // Seed test data: 2 wallets, transactions with different statuses
    const wallet1 = await createTestWallet({
      userId,
      label: "Dashboard Wallet 1",
    });
    const wallet2 = await createTestWallet({
      userId,
      label: "Dashboard Wallet 2",
    });

    const now = Math.floor(Date.now() / 1000);

    // Wallet 1: 2 GREEN, 1 YELLOW
    await createTestTransaction({
      walletId: wallet1.id,
      status: "GREEN",
      blockTimestamp: BigInt(now - 1000),
    });
    await createTestTransaction({
      walletId: wallet1.id,
      status: "GREEN",
      blockTimestamp: BigInt(now - 2000),
    });
    await createTestTransaction({
      walletId: wallet1.id,
      status: "YELLOW",
      blockTimestamp: BigInt(now - 3000),
    });

    // Wallet 2: 1 RED, 2 GRAY
    await createTestTransaction({
      walletId: wallet2.id,
      status: "RED",
      blockTimestamp: BigInt(now - 4000),
    });
    await createTestTransaction({
      walletId: wallet2.id,
      status: "GRAY",
      blockTimestamp: BigInt(now - 5000),
    });
    await createTestTransaction({
      walletId: wallet2.id,
      status: "GRAY",
      blockTimestamp: BigInt(now - 6000),
    });

    // Create a pending export
    await prisma.export.create({
      data: {
        userId,
        format: "CSV",
        status: "PENDING",
        taxYear: 2025,
        method: "FIFO",
        rowCount: 0,
        generatedAt: new Date(),
      },
    });
  });

  afterAll(async () => {
    // Clean up only this suite's data
    await prisma.export.deleteMany({ where: { userId } });
    await prisma.transaction.deleteMany({
      where: { wallet: { userId } },
    });
    await prisma.wallet.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    await disconnectTestDb();
  });

  // =========================================================================
  // dashboard.summary
  // =========================================================================

  describe("dashboard.summary", () => {
    it("returns correct wallet count", async () => {
      const summary = await caller.dashboard.summary();
      expect(summary.walletCount).toBe(2);
    });

    it("returns correct total transaction count", async () => {
      const summary = await caller.dashboard.summary();
      expect(summary.totalTxCount).toBe(6);
    });

    it("returns correct pending exports count", async () => {
      const summary = await caller.dashboard.summary();
      expect(summary.pendingExports).toBe(1);
    });

    it("returns zero for classifiedTxCount when none are classified", async () => {
      const summary = await caller.dashboard.summary();
      expect(summary.classifiedTxCount).toBe(0);
    });

    it("returns zero syncing wallets when none are syncing", async () => {
      const summary = await caller.dashboard.summary();
      expect(summary.syncingWallets).toBe(0);
    });
  });

  // =========================================================================
  // dashboard.ampelBreakdown
  // =========================================================================

  describe("dashboard.ampelBreakdown", () => {
    it("returns all four status entries in order", async () => {
      const breakdown = await caller.dashboard.ampelBreakdown();

      expect(breakdown).toHaveLength(4);

      const statuses = breakdown.map((b) => b.status);
      expect(statuses).toEqual(["GREEN", "YELLOW", "RED", "GRAY"]);
    });

    it("returns correct counts for each status", async () => {
      const breakdown = await caller.dashboard.ampelBreakdown();

      const byStatus = Object.fromEntries(
        breakdown.map((b) => [b.status, b.count]),
      );

      expect(byStatus.GREEN).toBe(2);
      expect(byStatus.YELLOW).toBe(1);
      expect(byStatus.RED).toBe(1);
      expect(byStatus.GRAY).toBe(2);
    });

    it("returns correct percentages", async () => {
      const breakdown = await caller.dashboard.ampelBreakdown();

      const green = breakdown.find((b) => b.status === "GREEN")!;
      // 2 out of 6 = 33.33%
      expect(green.percentage).toBeCloseTo(33.33, 1);

      const gray = breakdown.find((b) => b.status === "GRAY")!;
      // 2 out of 6 = 33.33%
      expect(gray.percentage).toBeCloseTo(33.33, 1);

      const yellow = breakdown.find((b) => b.status === "YELLOW")!;
      // 1 out of 6 = 16.67%
      expect(yellow.percentage).toBeCloseTo(16.67, 1);
    });

    it("returns zero counts for a user with no transactions", async () => {
      const emptyUser = await createTestUser();
      const emptyCaller = createTestCaller(emptyUser.id);

      const breakdown = await emptyCaller.dashboard.ampelBreakdown();

      expect(breakdown).toHaveLength(4);
      for (const entry of breakdown) {
        expect(entry.count).toBe(0);
        expect(entry.percentage).toBe(0);
      }
    });
  });

  // =========================================================================
  // Unauthenticated access
  // =========================================================================

  describe("unauthenticated access", () => {
    it("throws UNAUTHORIZED for dashboard.summary", async () => {
      const anonCaller = createUnauthenticatedCaller();
      await expect(anonCaller.dashboard.summary()).rejects.toThrow(
        /logged in/i,
      );
    });

    it("throws UNAUTHORIZED for dashboard.ampelBreakdown", async () => {
      const anonCaller = createUnauthenticatedCaller();
      await expect(anonCaller.dashboard.ampelBreakdown()).rejects.toThrow(
        /logged in/i,
      );
    });
  });
});
