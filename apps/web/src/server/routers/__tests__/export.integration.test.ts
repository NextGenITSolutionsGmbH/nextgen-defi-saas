import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";

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
import { addExportJob } from "../../queue";

/**
 * @spec US-004 — CoinTracking CSV export user story
 * @spec EP-07 — Export router and generation pipeline
 * @spec FR-01-04 — Plan-based export format restrictions
 */

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("export router — integration [US-004, EP-07, FR-01-04]", () => {
  let userId: string;
  let caller: TestCaller;
  let walletId: string;

  beforeAll(async () => {
    // PRO plan allows CSV and PDF exports
    const user = await createTestUser({ plan: "PRO" });
    userId = user.id;
    caller = createTestCaller(userId, "PRO");

    // Create a wallet with transactions in 2025
    const wallet = await createTestWallet({ userId, label: "Export Wallet" });
    walletId = wallet.id;

    // Create transactions within 2025
    const jun2025 = Math.floor(
      new Date("2025-06-15T12:00:00Z").getTime() / 1000,
    );
    for (let i = 0; i < 3; i++) {
      await createTestTransaction({
        walletId,
        blockTimestamp: BigInt(jun2025 + i * 3600),
        status: "GREEN",
      });
    }
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
  // export.create
  // =========================================================================

  describe("export.create", () => {
    it("creates a PENDING export record", async () => {
      const result = await caller.export.create({
        taxYear: 2025,
        method: "FIFO",
        format: "CSV",
      });

      expect(result.status).toBe("PENDING");
      expect(result.id).toBeTruthy();
      expect(result.message).toContain("queued");

      // Verify it exists in DB
      const dbExport = await prisma.export.findUnique({
        where: { id: result.id },
      });
      expect(dbExport).not.toBeNull();
      expect(dbExport!.status).toBe("PENDING");
      expect(dbExport!.format).toBe("CSV");
      expect(dbExport!.method).toBe("FIFO");
      expect(dbExport!.taxYear).toBe(2025);
    });

    it("enqueues an export job via the queue helper", async () => {
      const result = await caller.export.create({
        taxYear: 2025,
        method: "LIFO",
        format: "CSV",
      });

      expect(addExportJob).toHaveBeenCalledWith(
        result.id,
        userId,
        2025,
        "LIFO",
        "CSV",
      );
    });

    it("counts estimated rows from matching transactions", async () => {
      const result = await caller.export.create({
        taxYear: 2025,
        method: "FIFO",
        format: "CSV",
      });

      // We created 3 transactions in 2025
      expect(result.estimatedRowCount).toBe(3);
    });

    it("returns 0 estimated rows for a year with no transactions", async () => {
      const result = await caller.export.create({
        taxYear: 2023,
        method: "FIFO",
        format: "CSV",
      });

      expect(result.estimatedRowCount).toBe(0);
    });

    it("validates wallet ownership when walletIds are provided", async () => {
      const otherUser = await createTestUser();
      const otherWallet = await createTestWallet({ userId: otherUser.id });

      await expect(
        caller.export.create({
          taxYear: 2025,
          method: "FIFO",
          format: "CSV",
          walletIds: [otherWallet.id],
        }),
      ).rejects.toThrow(/do not belong/i);
    });

    it("accepts specific walletIds owned by the user", async () => {
      const result = await caller.export.create({
        taxYear: 2025,
        method: "FIFO",
        format: "CSV",
        walletIds: [walletId],
      });

      expect(result.status).toBe("PENDING");
      expect(result.estimatedRowCount).toBe(3);
    });

    it("enforces export format restrictions based on plan", async () => {
      // STARTER only allows CSV
      const starterUser = await createTestUser({ plan: "STARTER" });
      const starterCaller = createTestCaller(starterUser.id, "STARTER");

      await expect(
        starterCaller.export.create({
          taxYear: 2025,
          method: "FIFO",
          format: "XLSX",
        }),
      ).rejects.toThrow(/not available/i);
    });

    it("rejects a tax year before 2020", async () => {
      await expect(
        caller.export.create({
          taxYear: 2019,
          method: "FIFO",
          format: "CSV",
        }),
      ).rejects.toThrow();
    });

    it("rejects a tax year in the far future", async () => {
      await expect(
        caller.export.create({
          taxYear: 3000,
          method: "FIFO",
          format: "CSV",
        }),
      ).rejects.toThrow();
    });
  });

  // =========================================================================
  // export.list
  // =========================================================================

  describe("export.list", () => {
    beforeEach(async () => {
      await prisma.export.deleteMany({ where: { userId } });
    });

    it("returns an empty array when no exports exist", async () => {
      const exports = await caller.export.list();
      expect(exports).toEqual([]);
    });

    it("returns exports ordered by generatedAt desc", async () => {
      await prisma.export.create({
        data: {
          userId,
          format: "CSV",
          status: "COMPLETED",
          taxYear: 2024,
          method: "FIFO",
          rowCount: 5,
          generatedAt: new Date("2025-01-01"),
        },
      });
      await prisma.export.create({
        data: {
          userId,
          format: "CSV",
          status: "PENDING",
          taxYear: 2025,
          method: "LIFO",
          rowCount: 10,
          generatedAt: new Date("2025-06-01"),
        },
      });

      const exports = await caller.export.list();
      expect(exports).toHaveLength(2);
      // Most recent first
      expect(exports[0]!.taxYear).toBe(2025);
      expect(exports[1]!.taxYear).toBe(2024);
    });

    it("does not return exports belonging to other users", async () => {
      const otherUser = await createTestUser();
      await prisma.export.create({
        data: {
          userId: otherUser.id,
          format: "CSV",
          status: "COMPLETED",
          taxYear: 2025,
          method: "FIFO",
          rowCount: 3,
          generatedAt: new Date(),
        },
      });

      const exports = await caller.export.list();
      expect(exports).toHaveLength(0);
    });
  });

  // =========================================================================
  // Unauthenticated access
  // =========================================================================

  describe("unauthenticated access", () => {
    it("throws UNAUTHORIZED for export.create", async () => {
      const anonCaller = createUnauthenticatedCaller();
      await expect(
        anonCaller.export.create({
          taxYear: 2025,
          method: "FIFO",
          format: "CSV",
        }),
      ).rejects.toThrow(/logged in/i);
    });

    it("throws UNAUTHORIZED for export.list", async () => {
      const anonCaller = createUnauthenticatedCaller();
      await expect(anonCaller.export.list()).rejects.toThrow(/logged in/i);
    });
  });
});
