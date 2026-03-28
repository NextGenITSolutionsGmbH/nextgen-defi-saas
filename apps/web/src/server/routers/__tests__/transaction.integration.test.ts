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

vi.mock("../../../lib/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ success: true, remaining: 10, resetInMs: 60000 }),
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

/**
 * @spec US-002 — Transaction listing and filtering
 * @spec US-003 — Transaction classification and dual-scenario
 * @spec US-005 — Bulk classification
 * @spec US-008 — Transaction statistics
 * @spec EP-06 — Transaction list endpoint
 * @spec EP-09 — Classification endpoint
 * @spec EP-10 — Dual-scenario endpoint
 */

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("transaction router — integration [US-002, US-003, US-005, US-008, EP-06, EP-09, EP-10]", () => {
  let userId: string;
  let otherUserId: string;
  let caller: TestCaller;
  let wallet1Id: string;
  let wallet2Id: string;
  let otherWalletId: string;

  // Transaction IDs for reference in mutation tests
  let greenTxId: string;
  let yellowTxId: string;
  let redTxId: string;
  let grayTx1Id: string;
  let grayTx2Id: string;
  let sparkTx1Id: string;
  let kineticTxId: string;
  let flareTxId: string;
  let searchableTxId: string;
  let otherUserTxId: string;

  // Timestamps for ordering/filtering
  const baseTs = Math.floor(new Date("2025-06-01T12:00:00Z").getTime() / 1000);

  beforeAll(async () => {
    // Create PRO user with 2 wallets
    const user = await createTestUser({ plan: "PRO" });
    userId = user.id;
    caller = createTestCaller(userId, "PRO");

    const wallet1 = await createTestWallet({ userId, label: "Wallet A" });
    wallet1Id = wallet1.id;

    const wallet2 = await createTestWallet({ userId, label: "Wallet B" });
    wallet2Id = wallet2.id;

    // Create another user for isolation tests
    const otherUser = await createTestUser({ plan: "STARTER" });
    otherUserId = otherUser.id;
    const otherWallet = await createTestWallet({ userId: otherUser.id, label: "Other Wallet" });
    otherWalletId = otherWallet.id;

    // Seed transactions with varied statuses, protocols, and timestamps
    // Wallet 1: 7 transactions
    const greenTx = await createTestTransaction({
      walletId: wallet1Id,
      status: "GREEN",
      protocol: "SparkDEX",
      blockTimestamp: BigInt(baseTs + 7000),
    });
    greenTxId = greenTx.id;

    const yellowTx = await createTestTransaction({
      walletId: wallet1Id,
      status: "YELLOW",
      protocol: "SparkDEX",
      blockTimestamp: BigInt(baseTs + 6000),
    });
    yellowTxId = yellowTx.id;

    const redTx = await createTestTransaction({
      walletId: wallet1Id,
      status: "RED",
      protocol: "Kinetic",
      blockTimestamp: BigInt(baseTs + 5000),
    });
    redTxId = redTx.id;

    const grayTx1 = await createTestTransaction({
      walletId: wallet1Id,
      status: "GRAY",
      protocol: "Kinetic",
      blockTimestamp: BigInt(baseTs + 4000),
    });
    grayTx1Id = grayTx1.id;

    const grayTx2 = await createTestTransaction({
      walletId: wallet1Id,
      status: "GRAY",
      protocol: "Flare",
      blockTimestamp: BigInt(baseTs + 3000),
    });
    grayTx2Id = grayTx2.id;

    const sparkTx1 = await createTestTransaction({
      walletId: wallet1Id,
      status: "GREEN",
      protocol: "SparkDEX",
      blockTimestamp: BigInt(baseTs + 2000),
    });
    sparkTx1Id = sparkTx1.id;

    // Searchable tx with known hash prefix
    const searchableTx = await createTestTransaction({
      walletId: wallet1Id,
      txHash: "0xdeadbeef0000111122223333444455556666777788889999aaaabbbbccccdddd",
      status: "GRAY",
      protocol: "Flare",
      blockTimestamp: BigInt(baseTs + 1000),
    });
    searchableTxId = searchableTx.id;

    // Wallet 2: 2 transactions
    const sparkTx2 = await createTestTransaction({
      walletId: wallet2Id,
      status: "GREEN",
      protocol: "SparkDEX",
      blockTimestamp: BigInt(baseTs + 8000),
    });
    void sparkTx2.id;

    const kineticTx = await createTestTransaction({
      walletId: wallet2Id,
      status: "YELLOW",
      protocol: "Kinetic",
      blockTimestamp: BigInt(baseTs + 500),
    });
    kineticTxId = kineticTx.id;

    // Flare protocol tx (on wallet 2 for protocol count test)
    const flareTx = await createTestTransaction({
      walletId: wallet2Id,
      status: "RED",
      protocol: "Flare",
      blockTimestamp: BigInt(baseTs + 200),
    });
    flareTxId = flareTx.id;

    // Other user's transaction (should never appear in our results)
    const otherUserTx = await createTestTransaction({
      walletId: otherWalletId,
      status: "GREEN",
      protocol: "SparkDEX",
      blockTimestamp: BigInt(baseTs + 9000),
    });
    otherUserTxId = otherUserTx.id;
  });

  afterAll(async () => {
    // Clean up in dependency order
    await prisma.txClassification.deleteMany({
      where: { transaction: { wallet: { userId: { in: [userId, otherUserId] } } } },
    });
    await prisma.transaction.deleteMany({
      where: { wallet: { userId: { in: [userId, otherUserId] } } },
    });
    await prisma.wallet.deleteMany({ where: { userId: { in: [userId, otherUserId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
    await disconnectTestDb();
  });

  // =========================================================================
  // transaction.list
  // =========================================================================

  describe("transaction.list", () => {
    it("returns paginated transactions for authenticated user", async () => {
      const result = await caller.transaction.list({ limit: 25 });

      // 10 transactions total across both wallets
      expect(result.items).toHaveLength(10);
      expect(result.totalCount).toBe(10);
      expect(result.nextCursor).toBeUndefined();
    });

    it("filters by walletId", async () => {
      const result = await caller.transaction.list({
        walletId: wallet1Id,
        limit: 25,
      });

      expect(result.items).toHaveLength(7);
      expect(result.totalCount).toBe(7);
      // All returned TXs should belong to wallet1
      for (const tx of result.items) {
        expect(tx.walletId).toBe(wallet1Id);
      }
    });

    it("filters by status (Ampel color)", async () => {
      const greenResult = await caller.transaction.list({
        status: "GREEN",
        limit: 25,
      });
      // greenTx, sparkTx1, sparkTx2 = 3 GREEN
      expect(greenResult.items).toHaveLength(3);
      expect(greenResult.totalCount).toBe(3);
      for (const tx of greenResult.items) {
        expect(tx.status).toBe("GREEN");
      }

      const yellowResult = await caller.transaction.list({
        status: "YELLOW",
        limit: 25,
      });
      // yellowTx, kineticTx = 2 YELLOW
      expect(yellowResult.items).toHaveLength(2);
      for (const tx of yellowResult.items) {
        expect(tx.status).toBe("YELLOW");
      }
    });

    it("filters by protocol", async () => {
      const result = await caller.transaction.list({
        protocol: "SparkDEX",
        limit: 25,
      });

      // greenTx, yellowTx, sparkTx1 (wallet1) + sparkTx2 (wallet2) = 4
      expect(result.items).toHaveLength(4);
      expect(result.totalCount).toBe(4);
    });

    it("searches by partial txHash (case-insensitive)", async () => {
      // Search with uppercase — should match due to insensitive mode
      const result = await caller.transaction.list({
        search: "DEADBEEF",
        limit: 25,
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.id).toBe(searchableTxId);
    });

    it("cursor-based pagination works correctly", async () => {
      // Fetch first page with limit 3
      const page1 = await caller.transaction.list({ limit: 3 });
      expect(page1.items).toHaveLength(3);
      expect(page1.nextCursor).toBeTruthy();

      // Fetch second page using cursor
      const page2 = await caller.transaction.list({
        limit: 3,
        cursor: page1.nextCursor,
      });
      expect(page2.items).toHaveLength(3);
      expect(page2.nextCursor).toBeTruthy();

      // Ensure no overlap between pages
      const page1Ids = page1.items.map((tx) => tx.id);
      const page2Ids = page2.items.map((tx) => tx.id);
      for (const id of page2Ids) {
        expect(page1Ids).not.toContain(id);
      }

      // Collect remaining items across pages
      let remaining: unknown[] = [];
      let cursor = page2.nextCursor;
      while (cursor) {
        const page = await caller.transaction.list({
          limit: 3,
          cursor,
        });
        remaining = remaining.concat(page.items);
        cursor = page.nextCursor;
      }
      // Total across all pages should capture all user transactions
      const total = page1.items.length + page2.items.length + remaining.length;
      expect(total).toBeGreaterThanOrEqual(8);
      expect(total).toBeLessThanOrEqual(10);
    });

    it("does not return other users' transactions", async () => {
      const result = await caller.transaction.list({ limit: 100 });

      const ids = result.items.map((tx) => tx.id);
      expect(ids).not.toContain(otherUserTxId);
    });

    it("respects limit parameter", async () => {
      const result = await caller.transaction.list({ limit: 2 });

      expect(result.items).toHaveLength(2);
      expect(result.nextCursor).toBeTruthy();
      // totalCount should still reflect the full count
      expect(result.totalCount).toBe(10);
    });
  });

  // =========================================================================
  // transaction.classify
  // =========================================================================

  describe("transaction.classify", () => {
    it("creates classification and updates status to GREEN", async () => {
      // Use a GRAY transaction for classification
      const result = await caller.transaction.classify({
        transactionId: grayTx1Id,
        ctType: "Trade",
        buyAmount: 100,
        buyCurrency: "FLR",
        sellAmount: 50,
        sellCurrency: "USDT",
        fee: 0.1,
        feeCurrency: "FLR",
        priceSource: "FTSO",
        comment: "Test classification",
      });

      expect(result.ctType).toBe("Trade");
      expect(result.transactionId).toBe(grayTx1Id);
      expect(result.isManual).toBe(true);
      expect(result.comment).toBe("Test classification");

      // Verify status was updated in DB
      const updated = await prisma.transaction.findUnique({
        where: { id: grayTx1Id },
      });
      expect(updated!.status).toBe("GREEN");
    });

    it("throws NOT_FOUND for transaction not owned by user", async () => {
      await expect(
        caller.transaction.classify({
          transactionId: otherUserTxId,
          ctType: "Trade",
        }),
      ).rejects.toThrow("Transaction not found");
    });

    it("throws NOT_FOUND for non-existent transaction", async () => {
      await expect(
        caller.transaction.classify({
          transactionId: "00000000-0000-0000-0000-000000000000",
          ctType: "Staking",
        }),
      ).rejects.toThrow("Transaction not found");
    });

    it("accepts valid CoinTracking types", async () => {
      const validTypes = [
        "Staking",
        "LP Rewards",
        "Lending Einnahme",
        "Airdrop",
      ] as const;

      for (const ctType of validTypes) {
        const result = await caller.transaction.classify({
          transactionId: grayTx2Id,
          ctType,
          priceSource: "MANUAL",
        });
        expect(result.ctType).toBe(ctType);
      }
    });
  });

  // =========================================================================
  // transaction.setDualScenario
  // =========================================================================

  describe("transaction.setDualScenario", () => {
    it("updates YELLOW transaction with scenario choice MODEL_A", async () => {
      const result = await caller.transaction.setDualScenario({
        transactionId: yellowTxId,
        modelChoice: "MODEL_A",
      });

      expect(result.modelChoice).toBe("MODEL_A");

      // Verify status was updated to GREEN
      const updated = await prisma.transaction.findUnique({
        where: { id: yellowTxId },
      });
      expect(updated!.status).toBe("GREEN");
    });

    it("throws BAD_REQUEST for non-YELLOW transaction", async () => {
      // greenTxId has status GREEN
      await expect(
        caller.transaction.setDualScenario({
          transactionId: greenTxId,
          modelChoice: "MODEL_B",
        }),
      ).rejects.toThrow(/YELLOW/i);
    });

    it("throws NOT_FOUND for transaction not owned by user", async () => {
      await expect(
        caller.transaction.setDualScenario({
          transactionId: otherUserTxId,
          modelChoice: "MODEL_A",
        }),
      ).rejects.toThrow("Transaction not found");
    });

    it("creates classification when none exists for YELLOW tx", async () => {
      // kineticTxId is YELLOW and has no prior classification
      const result = await caller.transaction.setDualScenario({
        transactionId: kineticTxId,
        modelChoice: "MODEL_B",
      });

      expect(result.modelChoice).toBe("MODEL_B");
      expect(result.ctType).toBe("Other Income");

      // Verify the classification was created
      const classifications = await prisma.txClassification.findMany({
        where: { transactionId: kineticTxId },
      });
      expect(classifications.length).toBeGreaterThanOrEqual(1);
    });
  });

  // =========================================================================
  // transaction.bulkClassify
  // =========================================================================

  describe("transaction.bulkClassify", () => {
    it("classifies multiple transactions at once", async () => {
      // Reset statuses for these txs to GRAY for a clean bulk test
      await prisma.transaction.updateMany({
        where: { id: { in: [searchableTxId, redTxId] } },
        data: { status: "GRAY" },
      });

      const result = await caller.transaction.bulkClassify({
        items: [
          {
            transactionId: searchableTxId,
            ctType: "Deposit",
            priceSource: "COINGECKO",
          },
          {
            transactionId: redTxId,
            ctType: "Withdrawal",
            buyAmount: 10,
            buyCurrency: "WFLR",
            priceSource: "FTSO",
            comment: "Bulk test",
          },
        ],
      });

      expect(result.count).toBe(2);

      // Verify both were updated to GREEN
      const tx1 = await prisma.transaction.findUnique({
        where: { id: searchableTxId },
      });
      expect(tx1!.status).toBe("GREEN");

      const tx2 = await prisma.transaction.findUnique({
        where: { id: redTxId },
      });
      expect(tx2!.status).toBe("GREEN");
    });

    it("returns count of classified transactions", async () => {
      // Reset a tx for this test
      await prisma.transaction.update({
        where: { id: flareTxId },
        data: { status: "RED" },
      });

      const result = await caller.transaction.bulkClassify({
        items: [
          {
            transactionId: flareTxId,
            ctType: "Mining",
            priceSource: "MANUAL",
          },
        ],
      });

      expect(result.count).toBe(1);
    });

    it("throws NOT_FOUND when any transaction is not owned by user", async () => {
      await expect(
        caller.transaction.bulkClassify({
          items: [
            {
              transactionId: sparkTx1Id,
              ctType: "Trade",
              priceSource: "MANUAL",
            },
            {
              transactionId: otherUserTxId,
              ctType: "Trade",
              priceSource: "MANUAL",
            },
          ],
        }),
      ).rejects.toThrow(/not found/i);
    });

    it("throws NOT_FOUND for non-existent transaction IDs", async () => {
      await expect(
        caller.transaction.bulkClassify({
          items: [
            {
              transactionId: "00000000-0000-0000-0000-000000000000",
              ctType: "Staking",
              priceSource: "MANUAL",
            },
          ],
        }),
      ).rejects.toThrow(/not found/i);
    });
  });

  // =========================================================================
  // transaction.stats
  // =========================================================================

  describe("transaction.stats", () => {
    it("returns correct total count", async () => {
      const result = await caller.transaction.stats();

      expect(result.total).toBe(10);
    });

    it("returns correct byStatus counts", async () => {
      // First, get the actual current statuses from DB for our user
      const statuses = await prisma.transaction.groupBy({
        by: ["status"],
        where: { wallet: { userId } },
        _count: { _all: true },
      });
      const expected: Record<string, number> = { GREEN: 0, YELLOW: 0, RED: 0, GRAY: 0 };
      for (const s of statuses) {
        expected[s.status] = s._count._all;
      }

      const result = await caller.transaction.stats();

      expect(result.byStatus).toEqual(expected);
      // Ensure all four Ampel colors are present as keys
      expect(result.byStatus).toHaveProperty("GREEN");
      expect(result.byStatus).toHaveProperty("YELLOW");
      expect(result.byStatus).toHaveProperty("RED");
      expect(result.byStatus).toHaveProperty("GRAY");
    });

    it("returns correct byProtocol counts", async () => {
      const protocols = await prisma.transaction.groupBy({
        by: ["protocol"],
        where: { wallet: { userId } },
        _count: { _all: true },
      });
      const expected: Record<string, number> = {};
      for (const p of protocols) {
        expected[p.protocol ?? "Unknown"] = p._count._all;
      }

      const result = await caller.transaction.stats();

      expect(result.byProtocol).toEqual(expected);
    });
  });

  // =========================================================================
  // transaction.detail
  // =========================================================================

  describe("transaction.detail", () => {
    it("returns full transaction details for owned transaction", async () => {
      const result = await caller.transaction.detail({
        transactionId: greenTxId,
      });

      expect(result.id).toBe(greenTxId);
      expect(result.wallet).toBeDefined();
      expect(result.wallet.address).toBeTruthy();
      expect(result.legs).toBeDefined();
      expect(result.classifications).toBeDefined();
    });

    it("throws NOT_FOUND for transaction not owned by user", async () => {
      await expect(
        caller.transaction.detail({
          transactionId: otherUserTxId,
        }),
      ).rejects.toThrow("Transaction not found");
    });

    it("throws NOT_FOUND for non-existent transaction", async () => {
      await expect(
        caller.transaction.detail({
          transactionId: "00000000-0000-0000-0000-000000000000",
        }),
      ).rejects.toThrow("Transaction not found");
    });
  });

  // =========================================================================
  // Unauthenticated access
  // =========================================================================

  describe("unauthenticated access", () => {
    it("throws UNAUTHORIZED for transaction.list", async () => {
      const anonCaller = createUnauthenticatedCaller();
      await expect(
        anonCaller.transaction.list({ limit: 10 }),
      ).rejects.toThrow(/logged in/i);
    });

    it("throws UNAUTHORIZED for transaction.detail", async () => {
      const anonCaller = createUnauthenticatedCaller();
      await expect(
        anonCaller.transaction.detail({
          transactionId: "00000000-0000-0000-0000-000000000000",
        }),
      ).rejects.toThrow(/logged in/i);
    });

    it("throws UNAUTHORIZED for transaction.classify", async () => {
      const anonCaller = createUnauthenticatedCaller();
      await expect(
        anonCaller.transaction.classify({
          transactionId: "00000000-0000-0000-0000-000000000000",
          ctType: "Trade",
        }),
      ).rejects.toThrow(/logged in/i);
    });

    it("throws UNAUTHORIZED for transaction.setDualScenario", async () => {
      const anonCaller = createUnauthenticatedCaller();
      await expect(
        anonCaller.transaction.setDualScenario({
          transactionId: "00000000-0000-0000-0000-000000000000",
          modelChoice: "MODEL_A",
        }),
      ).rejects.toThrow(/logged in/i);
    });

    it("throws UNAUTHORIZED for transaction.bulkClassify", async () => {
      const anonCaller = createUnauthenticatedCaller();
      await expect(
        anonCaller.transaction.bulkClassify({
          items: [
            {
              transactionId: "00000000-0000-0000-0000-000000000000",
              ctType: "Trade",
            },
          ],
        }),
      ).rejects.toThrow(/logged in/i);
    });

    it("throws UNAUTHORIZED for transaction.stats", async () => {
      const anonCaller = createUnauthenticatedCaller();
      await expect(
        anonCaller.transaction.stats(),
      ).rejects.toThrow(/logged in/i);
    });
  });
});
