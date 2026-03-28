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
  disconnectTestDb,
  prisma,
} from "../../../../../../tests/helpers/db";
import {
  createTestCaller,
  createUnauthenticatedCaller,
} from "../../../../../../tests/helpers/trpc";
import type { TestCaller } from "../../../../../../tests/helpers/trpc";
import { addWalletSyncJob } from "../../queue";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

/**
 * @spec US-001 — Wallet management (add, list, remove, sync)
 * @spec EP-01 — Wallet endpoints
 * @spec FR-01-04 — Wallet plan limits and chain mapping
 */

describe("wallet router — integration [US-001, EP-01, FR-01-04]", () => {
  let userId: string;
  let caller: TestCaller;

  beforeAll(async () => {
    const user = await createTestUser({ plan: "PRO" }); // PRO allows 5 wallets
    userId = user.id;
    caller = createTestCaller(userId, "PRO");
  });

  afterAll(async () => {
    // Clean up only this suite's data
    await prisma.transaction.deleteMany({
      where: { wallet: { userId } },
    });
    await prisma.wallet.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    await disconnectTestDb();
  });

  // Reset wallet state between tests that mutate
  beforeEach(async () => {
    await prisma.wallet.deleteMany({ where: { userId } });
  });

  // =========================================================================
  // wallet.list
  // =========================================================================

  describe("wallet.list", () => {
    it("returns an empty array when the user has no wallets", async () => {
      const wallets = await caller.wallet.list();
      expect(wallets).toEqual([]);
    });

    it("returns wallets after adding one", async () => {
      await createTestWallet({ userId, label: "My Flare Wallet" });

      const wallets = await caller.wallet.list();
      expect(wallets).toHaveLength(1);
      expect(wallets[0]).toMatchObject({
        label: "My Flare Wallet",
        chainId: 14,
        syncStatus: "IDLE",
      });
    });

    it("does not return wallets owned by other users", async () => {
      const otherUser = await createTestUser();
      await createTestWallet({ userId: otherUser.id, label: "Other" });
      await createTestWallet({ userId, label: "Mine" });

      const wallets = await caller.wallet.list();
      expect(wallets).toHaveLength(1);
      expect(wallets[0]!.label).toBe("Mine");
    });

    it("returns wallets ordered by createdAt desc", async () => {
      await createTestWallet({ userId, label: "First" });
      // Small delay to guarantee ordering
      await new Promise((r) => setTimeout(r, 50));
      await createTestWallet({ userId, label: "Second" });

      const wallets = await caller.wallet.list();
      expect(wallets).toHaveLength(2);
      expect(wallets[0]!.label).toBe("Second");
      expect(wallets[1]!.label).toBe("First");
    });
  });

  // =========================================================================
  // wallet.add
  // =========================================================================

  describe("wallet.add", () => {
    it("creates a wallet with the correct chainId for Flare", async () => {
      const wallet = await caller.wallet.add({
        address: "0x1234567890abcdef1234567890abcdef12345678",
        chain: "flare",
        label: "Test Flare",
      });

      expect(wallet.chainId).toBe(14);
      expect(wallet.label).toBe("Test Flare");
    });

    it("lowercases the wallet address on save", async () => {
      const wallet = await caller.wallet.add({
        address: "0xABCDEF1234567890ABCDEF1234567890ABCDEF12",
        chain: "flare",
      });

      expect(wallet.address).toBe(
        "0xabcdef1234567890abcdef1234567890abcdef12",
      );
    });

    it("maps chain names to correct chainIds", async () => {
      const flare = await caller.wallet.add({
        address: "0x0000000000000000000000000000000000000001",
        chain: "flare",
      });
      expect(flare.chainId).toBe(14);

      const eth = await caller.wallet.add({
        address: "0x0000000000000000000000000000000000000002",
        chain: "ethereum",
      });
      expect(eth.chainId).toBe(1);

      const polygon = await caller.wallet.add({
        address: "0x0000000000000000000000000000000000000003",
        chain: "polygon",
      });
      expect(polygon.chainId).toBe(137);
    });

    it("rejects duplicate wallet address on the same chain", async () => {
      const addr = "0xdead000000000000000000000000000000beef01";

      await caller.wallet.add({ address: addr, chain: "flare" });

      await expect(
        caller.wallet.add({ address: addr, chain: "flare" }),
      ).rejects.toThrow("Wallet already exists for this chain");
    });

    it("allows the same address on different chains", async () => {
      const addr = "0xfeed000000000000000000000000000000cafe01";

      const flare = await caller.wallet.add({ address: addr, chain: "flare" });
      const eth = await caller.wallet.add({ address: addr, chain: "ethereum" });

      expect(flare.chainId).toBe(14);
      expect(eth.chainId).toBe(1);
    });

    it("enforces wallet limit for STARTER plan", async () => {
      const starterUser = await createTestUser({ plan: "STARTER" });
      const starterCaller = createTestCaller(starterUser.id, "STARTER");

      // STARTER allows 1 wallet — use unique addresses to avoid global unique constraint
      const addr1 = `0x${starterUser.id.replace(/-/g, "").slice(0, 38)}a1`;
      const addr2 = `0x${starterUser.id.replace(/-/g, "").slice(0, 38)}a2`;

      await starterCaller.wallet.add({
        address: addr1,
        chain: "flare",
      });

      await expect(
        starterCaller.wallet.add({
          address: addr2,
          chain: "flare",
        }),
      ).rejects.toThrow(/maximum of 1 wallet/i);
    });
  });

  // =========================================================================
  // wallet.remove
  // =========================================================================

  describe("wallet.remove", () => {
    it("deletes an owned wallet", async () => {
      const wallet = await createTestWallet({ userId });

      const result = await caller.wallet.remove({ walletId: wallet.id });
      expect(result.success).toBe(true);

      const remaining = await caller.wallet.list();
      expect(remaining).toHaveLength(0);
    });

    it("throws when removing a wallet not owned by the user", async () => {
      const otherUser = await createTestUser();
      const otherWallet = await createTestWallet({ userId: otherUser.id });

      await expect(
        caller.wallet.remove({ walletId: otherWallet.id }),
      ).rejects.toThrow("Wallet not found");
    });

    it("throws for a non-existent walletId", async () => {
      await expect(
        caller.wallet.remove({
          walletId: "00000000-0000-0000-0000-000000000000",
        }),
      ).rejects.toThrow("Wallet not found");
    });
  });

  // =========================================================================
  // wallet.sync
  // =========================================================================

  describe("wallet.sync", () => {
    it("triggers a sync job and sets status to SYNCING", async () => {
      const wallet = await createTestWallet({ userId });

      const result = await caller.wallet.sync({ walletId: wallet.id });

      expect(result.status).toBe("queued");
      expect(result.walletId).toBe(wallet.id);

      // Verify the wallet's syncStatus was updated in DB
      const updated = await prisma.wallet.findUnique({
        where: { id: wallet.id },
      });
      expect(updated!.syncStatus).toBe("SYNCING");

      // Verify the queue helper was called
      expect(addWalletSyncJob).toHaveBeenCalledWith(
        wallet.id,
        wallet.chainId,
        undefined,
      );
    });

    it("throws when syncing a wallet not owned by the user", async () => {
      const otherUser = await createTestUser();
      const otherWallet = await createTestWallet({ userId: otherUser.id });

      await expect(
        caller.wallet.sync({ walletId: otherWallet.id }),
      ).rejects.toThrow("Wallet not found");
    });
  });

  // =========================================================================
  // Unauthenticated access
  // =========================================================================

  describe("unauthenticated access", () => {
    it("throws UNAUTHORIZED for wallet.list", async () => {
      const anonCaller = createUnauthenticatedCaller();
      await expect(anonCaller.wallet.list()).rejects.toThrow(/logged in/i);
    });

    it("throws UNAUTHORIZED for wallet.add", async () => {
      const anonCaller = createUnauthenticatedCaller();
      await expect(
        anonCaller.wallet.add({
          address: "0x0000000000000000000000000000000000000000",
          chain: "flare",
        }),
      ).rejects.toThrow(/logged in/i);
    });

    it("throws UNAUTHORIZED for wallet.remove", async () => {
      const anonCaller = createUnauthenticatedCaller();
      await expect(
        anonCaller.wallet.remove({
          walletId: "00000000-0000-0000-0000-000000000000",
        }),
      ).rejects.toThrow(/logged in/i);
    });

    it("throws UNAUTHORIZED for wallet.sync", async () => {
      const anonCaller = createUnauthenticatedCaller();
      await expect(
        anonCaller.wallet.sync({
          walletId: "00000000-0000-0000-0000-000000000000",
        }),
      ).rejects.toThrow(/logged in/i);
    });
  });
});
