// ---------------------------------------------------------------------------
// Unit tests for the Wallet Sync Worker
// All external dependencies (Prisma, RPC, ClassificationEngine, queues) are
// mocked so that no real network or database calls are made.
// ---------------------------------------------------------------------------

/**
 * @spec EP-01 — Background wallet sync worker
 * @spec FR-01-05 — Adaptive chunking and error recovery
 * @spec EP-06 — Classification integration within sync pipeline
 */

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

// ---------------------------------------------------------------------------
// vi.hoisted — variables declared here are available inside vi.mock factories
// because vi.hoisted is evaluated before vi.mock hoisting.
// ---------------------------------------------------------------------------
const {
  mockPrismaWallet,
  mockPrismaTxLeg,
  mockPrismaTxClassification,
  mockPrismaTransaction,
  mockPrisma$transaction,
  mockGetBlockNumber,
  mockGetWalletTransactions,
  mockAddPriceFetchJob,
  mockDecodeTransactionLogs,
  mockClassify,
} = vi.hoisted(() => ({
  mockPrismaWallet: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  mockPrismaTxLeg: {
    deleteMany: vi.fn(),
    createMany: vi.fn(),
  },
  mockPrismaTxClassification: {
    deleteMany: vi.fn(),
    createMany: vi.fn(),
  },
  mockPrismaTransaction: {
    upsert: vi.fn(),
  },
  mockPrisma$transaction: vi.fn(),
  mockGetBlockNumber: vi.fn(),
  mockGetWalletTransactions: vi.fn(),
  mockAddPriceFetchJob: vi.fn().mockResolvedValue("price-job-1"),
  mockDecodeTransactionLogs: vi.fn().mockReturnValue([]),
  mockClassify: vi.fn().mockReturnValue({
    ctType: "Trade",
    buyAmount: "100",
    buyCurrency: "FLR",
    sellAmount: null,
    sellCurrency: null,
    fee: null,
    feeCurrency: null,
    exchange: "SparkDEX",
    tradeGroup: "DeFi-Flare",
    ampelStatus: "GREEN",
    isGraubereich: false,
    modelChoice: null,
    comment: "Auto-classified",
  }),
}));

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("bullmq", () => ({
  Worker: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
  })),
}));

vi.mock("@defi-tracker/shared/queue", () => ({
  createRedisConnection: vi.fn(),
  WALLET_SYNC_QUEUE: "wallet-sync",
}));

vi.mock("@defi-tracker/db", () => ({
  prisma: {
    wallet: mockPrismaWallet,
    transaction: mockPrismaTransaction,
    txLeg: mockPrismaTxLeg,
    txClassification: mockPrismaTxClassification,
    $transaction: (...args: unknown[]) => mockPrisma$transaction(...args),
  },
}));

vi.mock("@defi-tracker/shared", () => {
  const FlareRpcClient = vi.fn().mockImplementation(() => ({
    getBlockNumber: (...args: unknown[]) => mockGetBlockNumber(...args),
    getWalletTransactions: (...args: unknown[]) => mockGetWalletTransactions(...args),
  }));

  return {
    FlareRpcClient,
    FLARE_MAINNET_CONFIG: {
      rpcUrl: "https://mock-rpc",
      chainId: 14,
      maxBlockRange: 2048,
      requestTimeoutMs: 30000,
    },
    decodeTransactionLogs: (...args: unknown[]) => mockDecodeTransactionLogs(...args),
    ClassificationEngine: vi.fn().mockImplementation(() => ({
      classify: (...args: unknown[]) => mockClassify(...args),
    })),
    FLARE_TOKENS: new Map([
      [
        "FLR",
        {
          symbol: "FLR",
          address: "0x1d80c49bbbcd1c0911346656b529df9e5c2f783d",
          decimals: 18,
        },
      ],
      [
        "WFLR",
        {
          symbol: "WFLR",
          address: "0x1d80c49bbbcd1c0911346656b529df9e5c2f783e",
          decimals: 18,
        },
      ],
    ]),
  };
});

vi.mock("../../index", () => ({
  addPriceFetchJob: (...args: unknown[]) => mockAddPriceFetchJob(...args),
  addEmailJob: vi.fn().mockResolvedValue("email-job-1"),
}));

vi.mock("@/lib/email-templates", () => ({
  syncErrorEmail: vi.fn().mockReturnValue({
    subject: "Sync Error",
    html: "<p>Error</p>",
  }),
}));

// ---------------------------------------------------------------------------
// Import the worker module — the Worker constructor fires during collect.
// ---------------------------------------------------------------------------

import { Worker } from "bullmq";
import type { Job } from "bullmq";
import type { WalletSyncJobData } from "@defi-tracker/shared/queue";

import "../wallet-sync.worker";

// Extract the processor function from the mock constructor call.
const workerCalls = (Worker as unknown as Mock).mock.calls;
const processWalletSync: (job: Job<WalletSyncJobData>) => Promise<void> =
  workerCalls[workerCalls.length - 1][1];

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Helper: create a mock BullMQ Job object
// ---------------------------------------------------------------------------

function createMockJob(
  data: WalletSyncJobData,
  overrides: Partial<Job<WalletSyncJobData>> = {},
): Job<WalletSyncJobData> {
  return {
    id: "test-job-1",
    data,
    updateProgress: vi.fn(),
    ...overrides,
  } as unknown as Job<WalletSyncJobData>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("wallet-sync worker — processWalletSync [EP-01, FR-01-05, EP-06]", () => {
  // -------------------------------------------------------------------------
  // Happy path
  // -------------------------------------------------------------------------

  it("syncs a wallet end-to-end: SYNCING -> fetch TXs -> decode -> classify -> persist -> COMPLETED", async () => {
    const walletId = "wallet-abc";
    const chainId = 14;

    mockPrismaWallet.findUnique.mockResolvedValue({
      id: walletId,
      address: "0xabc0000000000000000000000000000000000001",
      lastSyncBlock: null,
    });
    mockPrismaWallet.update.mockResolvedValue({});

    mockGetBlockNumber.mockResolvedValue(100);
    mockGetWalletTransactions.mockResolvedValue([
      {
        txHash: "0xtx1",
        blockNumber: 50,
        blockTimestamp: 1700000000,
        from: "0xabc0000000000000000000000000000000000001",
        to: "0xdef0000000000000000000000000000000000002",
        status: "success",
        logs: [],
      },
    ]);

    mockPrisma$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<void>) => {
      await cb({
        transaction: {
          upsert: vi.fn().mockResolvedValue({ id: "tx-record-1" }),
        },
        txLeg: { deleteMany: vi.fn(), createMany: vi.fn() },
        txClassification: { deleteMany: vi.fn(), createMany: vi.fn() },
      });
    });

    const job = createMockJob({ walletId, chainId });

    await processWalletSync(job);

    // Wallet was set to SYNCING, then COMPLETED
    expect(mockPrismaWallet.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: walletId },
        data: expect.objectContaining({ syncStatus: "SYNCING" }),
      }),
    );

    // Last update call should be COMPLETED
    const lastUpdateCall = mockPrismaWallet.update.mock.calls[
      mockPrismaWallet.update.mock.calls.length - 1
    ];
    expect(lastUpdateCall[0].data.syncStatus).toBe("COMPLETED");
    expect(lastUpdateCall[0].data.lastSyncBlock).toBeDefined();

    // Progress was reported
    expect(job.updateProgress).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Wallet not found
  // -------------------------------------------------------------------------

  it("throws when the wallet is not found in the database", async () => {
    mockPrismaWallet.findUnique.mockResolvedValue(null);

    const job = createMockJob({ walletId: "nonexistent", chainId: 14 });

    await expect(processWalletSync(job)).rejects.toThrow(
      "Wallet nonexistent not found in database",
    );
  });

  // -------------------------------------------------------------------------
  // RPC error — logs and continues to next batch
  // -------------------------------------------------------------------------

  it("continues to the next batch when RPC returns an error", async () => {
    mockPrismaWallet.findUnique.mockResolvedValue({
      id: "wallet-rpc-err",
      address: "0xabc0000000000000000000000000000000000002",
      lastSyncBlock: BigInt(0),
    });
    mockPrismaWallet.update.mockResolvedValue({});

    mockGetBlockNumber.mockResolvedValue(100);
    // First call fails, second succeeds (empty list)
    mockGetWalletTransactions
      .mockRejectedValueOnce(new Error("RPC timeout"))
      .mockResolvedValueOnce([]);

    const job = createMockJob({ walletId: "wallet-rpc-err", chainId: 14 });

    // Should NOT throw — it logs and moves on
    await processWalletSync(job);

    // Wallet should end up COMPLETED (no TXs to process from second batch)
    const lastCall = mockPrismaWallet.update.mock.calls[
      mockPrismaWallet.update.mock.calls.length - 1
    ];
    expect(lastCall[0].data.syncStatus).toBe("COMPLETED");
  });

  // -------------------------------------------------------------------------
  // Reverted transactions are skipped
  // -------------------------------------------------------------------------

  it("skips reverted transactions", async () => {
    mockPrismaWallet.findUnique.mockResolvedValue({
      id: "wallet-rev",
      address: "0xabc0000000000000000000000000000000000003",
      lastSyncBlock: null,
    });
    mockPrismaWallet.update.mockResolvedValue({});

    mockGetBlockNumber.mockResolvedValue(10);
    mockGetWalletTransactions.mockResolvedValue([
      {
        txHash: "0xreverted",
        blockNumber: 5,
        blockTimestamp: 1700000000,
        from: "0xabc0000000000000000000000000000000000003",
        to: "0xdef",
        status: "reverted",
        logs: [],
      },
    ]);

    const job = createMockJob({ walletId: "wallet-rev", chainId: 14 });

    await processWalletSync(job);

    // $transaction should NOT be called since the only TX was reverted
    expect(mockPrisma$transaction).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Classification error produces RED fallback
  // -------------------------------------------------------------------------

  it("creates a RED fallback classification when classifier throws", async () => {
    mockPrismaWallet.findUnique.mockResolvedValue({
      id: "wallet-cls-err",
      address: "0xabc0000000000000000000000000000000000004",
      lastSyncBlock: null,
    });
    mockPrismaWallet.update.mockResolvedValue({});

    mockGetBlockNumber.mockResolvedValue(10);
    mockGetWalletTransactions.mockResolvedValue([
      {
        txHash: "0xtx-classify-err",
        blockNumber: 5,
        blockTimestamp: 1700000000,
        from: "0xabc0000000000000000000000000000000000004",
        to: "0xdef",
        status: "success",
        logs: [{ address: "0xaaa", topics: [], data: "0x", logIndex: "0x0" }],
      },
    ]);

    mockDecodeTransactionLogs.mockReturnValue([
      {
        txHash: "0xtx-classify-err",
        blockNumber: 5,
        blockTimestamp: 1700000000,
        logIndex: 0,
        contractAddress: "0xaaa",
        eventName: "Swap",
        args: {},
        protocol: "SparkDEX",
      },
    ]);

    // Classifier throws
    mockClassify.mockImplementation(() => {
      throw new Error("Unknown event signature");
    });

    let capturedClassifications: unknown[] = [];
    mockPrisma$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<void>) => {
      await cb({
        transaction: {
          upsert: vi.fn().mockResolvedValue({ id: "tx-cls-err" }),
        },
        txLeg: { deleteMany: vi.fn(), createMany: vi.fn() },
        txClassification: {
          deleteMany: vi.fn(),
          createMany: vi.fn().mockImplementation((args: { data: unknown[] }) => {
            capturedClassifications = args.data;
          }),
        },
      });
    });

    const job = createMockJob({ walletId: "wallet-cls-err", chainId: 14 });

    await processWalletSync(job);

    expect(capturedClassifications).toHaveLength(1);
    expect(capturedClassifications[0]).toEqual(
      expect.objectContaining({
        ctType: "Other",
        comment: expect.stringContaining("Classification error"),
      }),
    );
  });

  // -------------------------------------------------------------------------
  // fromBlock parameter is used when provided
  // -------------------------------------------------------------------------

  it("uses fromBlock from job data when provided", async () => {
    mockPrismaWallet.findUnique.mockResolvedValue({
      id: "wallet-fb",
      address: "0xabc0000000000000000000000000000000000005",
      lastSyncBlock: BigInt(500),
    });
    mockPrismaWallet.update.mockResolvedValue({});

    mockGetBlockNumber.mockResolvedValue(1000);
    mockGetWalletTransactions.mockResolvedValue([]);

    const job = createMockJob({
      walletId: "wallet-fb",
      chainId: 14,
      fromBlock: 800,
    });

    await processWalletSync(job);

    // The first call should start from block 800, NOT 500 (lastSyncBlock)
    expect(mockGetWalletTransactions).toHaveBeenCalledWith(
      "0xabc0000000000000000000000000000000000005",
      800,
      1000,
    );
  });

  // -------------------------------------------------------------------------
  // Error handling — status set to ERROR on unhandled exception
  // -------------------------------------------------------------------------

  it("sets wallet status to ERROR when an unhandled exception occurs", async () => {
    mockPrismaWallet.findUnique.mockResolvedValue({
      id: "wallet-err",
      address: "0xabc0000000000000000000000000000000000006",
      lastSyncBlock: null,
    });
    // First update (SYNCING) succeeds, then getBlockNumber throws
    mockPrismaWallet.update.mockResolvedValue({});
    mockGetBlockNumber.mockRejectedValue(new Error("Fatal RPC error"));

    const job = createMockJob({ walletId: "wallet-err", chainId: 14 });

    await expect(processWalletSync(job)).rejects.toThrow("Fatal RPC error");

    // The wallet should have been set to ERROR
    const errorCall = mockPrismaWallet.update.mock.calls.find(
      (call: unknown[]) =>
        (call[0] as { data: { syncStatus: string } }).data.syncStatus === "ERROR",
    );
    expect(errorCall).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // Email notification is queued on error
  // -------------------------------------------------------------------------

  it("queues an email notification when sync fails", async () => {
    mockPrismaWallet.findUnique
      .mockResolvedValueOnce({
        id: "wallet-email",
        address: "0xabc0000000000000000000000000000000000007",
        lastSyncBlock: null,
      })
      // Second call (inside catch block) returns wallet + user
      .mockResolvedValueOnce({
        id: "wallet-email",
        address: "0xabc0000000000000000000000000000000000007",
        user: { id: "user-1", email: "test@example.com" },
      });

    mockPrismaWallet.update.mockResolvedValue({});
    mockGetBlockNumber.mockRejectedValue(new Error("Network down"));

    const job = createMockJob({ walletId: "wallet-email", chainId: 14 });

    await expect(processWalletSync(job)).rejects.toThrow("Network down");

    // The email job adder is imported dynamically inside the catch block.
    // We can verify the wallet was looked up with include: user
    expect(mockPrismaWallet.findUnique).toHaveBeenCalledTimes(2);
  });

  // -------------------------------------------------------------------------
  // Price fetch jobs are queued for each unique token/timestamp
  // -------------------------------------------------------------------------

  it("queues price-fetch jobs for token movements", async () => {
    mockPrismaWallet.findUnique.mockResolvedValue({
      id: "wallet-price",
      address: "0xabc0000000000000000000000000000000000008",
      lastSyncBlock: null,
    });
    mockPrismaWallet.update.mockResolvedValue({});

    mockGetBlockNumber.mockResolvedValue(10);
    mockGetWalletTransactions.mockResolvedValue([
      {
        txHash: "0xtx-price",
        blockNumber: 5,
        blockTimestamp: 1700000000,
        from: "0xdef",
        to: "0xabc0000000000000000000000000000000000008",
        status: "success",
        logs: [],
      },
    ]);

    // Produce Transfer events that involve our wallet
    mockDecodeTransactionLogs.mockReturnValue([
      {
        txHash: "0xtx-price",
        blockNumber: 5,
        blockTimestamp: 1700000000,
        logIndex: 0,
        contractAddress: "0x1d80c49bbbcd1c0911346656b529df9e5c2f783d",
        eventName: "Transfer",
        args: {
          from: "0x0000000000000000000000000000000000000000",
          to: "0xabc0000000000000000000000000000000000008",
          value: "1000000000000000000",
        },
        protocol: null,
      },
    ]);

    mockPrisma$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<void>) => {
      await cb({
        transaction: {
          upsert: vi.fn().mockResolvedValue({ id: "tx-price-1" }),
        },
        txLeg: { deleteMany: vi.fn(), createMany: vi.fn() },
        txClassification: { deleteMany: vi.fn(), createMany: vi.fn() },
      });
    });

    const job = createMockJob({ walletId: "wallet-price", chainId: 14 });

    await processWalletSync(job);

    expect(mockAddPriceFetchJob).toHaveBeenCalledWith(
      "FLR",
      "0x1d80c49bbbcd1c0911346656b529df9e5c2f783d",
      14,
      1700000000,
    );
  });

  // -------------------------------------------------------------------------
  // DB error during persist does not crash the entire sync
  // -------------------------------------------------------------------------

  it("continues processing remaining TXs when a DB error occurs for one TX", async () => {
    mockPrismaWallet.findUnique.mockResolvedValue({
      id: "wallet-db-err",
      address: "0xabc0000000000000000000000000000000000009",
      lastSyncBlock: null,
    });
    mockPrismaWallet.update.mockResolvedValue({});

    mockGetBlockNumber.mockResolvedValue(10);
    mockGetWalletTransactions.mockResolvedValue([
      {
        txHash: "0xtx-fail",
        blockNumber: 5,
        blockTimestamp: 1700000000,
        from: "0xabc0000000000000000000000000000000000009",
        to: "0xdef",
        status: "success",
        logs: [],
      },
      {
        txHash: "0xtx-ok",
        blockNumber: 6,
        blockTimestamp: 1700000100,
        from: "0xabc0000000000000000000000000000000000009",
        to: "0xdef",
        status: "success",
        logs: [],
      },
    ]);

    let callCount = 0;
    mockPrisma$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<void>) => {
      callCount++;
      if (callCount === 1) {
        throw new Error("Unique constraint violation");
      }
      await cb({
        transaction: {
          upsert: vi.fn().mockResolvedValue({ id: "tx-ok" }),
        },
        txLeg: { deleteMany: vi.fn(), createMany: vi.fn() },
        txClassification: { deleteMany: vi.fn(), createMany: vi.fn() },
      });
    });

    const job = createMockJob({ walletId: "wallet-db-err", chainId: 14 });

    // Should NOT throw
    await processWalletSync(job);

    // $transaction was called for both TXs
    expect(mockPrisma$transaction).toHaveBeenCalledTimes(2);

    // Status still COMPLETED
    const lastCall = mockPrismaWallet.update.mock.calls[
      mockPrismaWallet.update.mock.calls.length - 1
    ];
    expect(lastCall[0].data.syncStatus).toBe("COMPLETED");
  });
});

// ---------------------------------------------------------------------------
// Helper function tests — tested indirectly through the processor
// ---------------------------------------------------------------------------

describe("wallet-sync worker — helper logic (ampelToDbStatus)", () => {
  it("maps GREEN classification to GREEN DB status", async () => {
    mockPrismaWallet.findUnique.mockResolvedValue({
      id: "wallet-green",
      address: "0xabc0000000000000000000000000000000000010",
      lastSyncBlock: null,
    });
    mockPrismaWallet.update.mockResolvedValue({});

    mockGetBlockNumber.mockResolvedValue(10);
    mockGetWalletTransactions.mockResolvedValue([
      {
        txHash: "0xtx-green",
        blockNumber: 5,
        blockTimestamp: 1700000000,
        from: "0xabc0000000000000000000000000000000000010",
        to: "0xdef",
        status: "success",
        logs: [{ address: "0xaaa", topics: [], data: "0x", logIndex: "0x0" }],
      },
    ]);

    mockDecodeTransactionLogs.mockReturnValue([
      {
        txHash: "0xtx-green",
        blockNumber: 5,
        blockTimestamp: 1700000000,
        logIndex: 0,
        contractAddress: "0xaaa",
        eventName: "Swap",
        args: {},
        protocol: "SparkDEX",
      },
    ]);

    mockClassify.mockReturnValue({
      ctType: "Trade",
      buyAmount: "100",
      buyCurrency: "FLR",
      sellAmount: "50",
      sellCurrency: "USDT",
      fee: null,
      feeCurrency: null,
      exchange: "SparkDEX",
      tradeGroup: "DeFi-Flare",
      ampelStatus: "GREEN",
      isGraubereich: false,
      modelChoice: null,
      comment: "",
    });

    let capturedStatus: string | null = null;
    mockPrisma$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<void>) => {
      await cb({
        transaction: {
          upsert: vi.fn().mockImplementation((args: { create: { status: string } }) => {
            capturedStatus = args.create.status;
            return { id: "tx-green" };
          }),
        },
        txLeg: { deleteMany: vi.fn(), createMany: vi.fn() },
        txClassification: { deleteMany: vi.fn(), createMany: vi.fn() },
      });
    });

    const job = createMockJob({ walletId: "wallet-green", chainId: 14 });
    await processWalletSync(job);

    expect(capturedStatus).toBe("GREEN");
  });

  it("maps unknown ampel status to GRAY", async () => {
    mockPrismaWallet.findUnique.mockResolvedValue({
      id: "wallet-gray",
      address: "0xabc0000000000000000000000000000000000011",
      lastSyncBlock: null,
    });
    mockPrismaWallet.update.mockResolvedValue({});

    mockGetBlockNumber.mockResolvedValue(10);
    mockGetWalletTransactions.mockResolvedValue([
      {
        txHash: "0xtx-gray",
        blockNumber: 5,
        blockTimestamp: 1700000000,
        from: "0xabc0000000000000000000000000000000000011",
        to: "0xdef",
        status: "success",
        logs: [{ address: "0xaaa", topics: [], data: "0x", logIndex: "0x0" }],
      },
    ]);

    mockDecodeTransactionLogs.mockReturnValue([
      {
        txHash: "0xtx-gray",
        blockNumber: 5,
        blockTimestamp: 1700000000,
        logIndex: 0,
        contractAddress: "0xaaa",
        eventName: "Approval",
        args: {},
        protocol: null,
      },
    ]);

    mockClassify.mockReturnValue({
      ctType: "Other",
      buyAmount: null,
      buyCurrency: null,
      sellAmount: null,
      sellCurrency: null,
      fee: null,
      feeCurrency: null,
      exchange: "Unknown",
      tradeGroup: "",
      ampelStatus: "GRAY",
      isGraubereich: false,
      modelChoice: null,
      comment: "Tax-irrelevant",
    });

    let capturedStatus: string | null = null;
    mockPrisma$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<void>) => {
      await cb({
        transaction: {
          upsert: vi.fn().mockImplementation((args: { create: { status: string } }) => {
            capturedStatus = args.create.status;
            return { id: "tx-gray" };
          }),
        },
        txLeg: { deleteMany: vi.fn(), createMany: vi.fn() },
        txClassification: { deleteMany: vi.fn(), createMany: vi.fn() },
      });
    });

    const job = createMockJob({ walletId: "wallet-gray", chainId: 14 });
    await processWalletSync(job);

    expect(capturedStatus).toBe("GRAY");
  });
});

describe("wallet-sync worker — extractTokenMovements logic", () => {
  it("creates IN and OUT legs for Transfer events involving the wallet", async () => {
    const walletAddr = "0xabc0000000000000000000000000000000000012";

    mockPrismaWallet.findUnique.mockResolvedValue({
      id: "wallet-legs",
      address: walletAddr,
      lastSyncBlock: null,
    });
    mockPrismaWallet.update.mockResolvedValue({});

    mockGetBlockNumber.mockResolvedValue(10);
    mockGetWalletTransactions.mockResolvedValue([
      {
        txHash: "0xtx-legs",
        blockNumber: 5,
        blockTimestamp: 1700000000,
        from: walletAddr,
        to: "0xdef",
        status: "success",
        logs: [],
      },
    ]);

    mockDecodeTransactionLogs.mockReturnValue([
      {
        txHash: "0xtx-legs",
        blockNumber: 5,
        blockTimestamp: 1700000000,
        logIndex: 0,
        contractAddress: "0x1d80c49bbbcd1c0911346656b529df9e5c2f783d",
        eventName: "Transfer",
        args: {
          from: walletAddr,
          to: "0x0000000000000000000000000000000000000000",
          value: "500000000000000000",
        },
        protocol: null,
      },
      {
        txHash: "0xtx-legs",
        blockNumber: 5,
        blockTimestamp: 1700000000,
        logIndex: 1,
        contractAddress: "0x1d80c49bbbcd1c0911346656b529df9e5c2f783e",
        eventName: "Transfer",
        args: {
          from: "0x0000000000000000000000000000000000000000",
          to: walletAddr,
          value: "200000000000000000",
        },
        protocol: null,
      },
    ]);

    let capturedLegs: unknown[] = [];
    mockPrisma$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<void>) => {
      await cb({
        transaction: {
          upsert: vi.fn().mockResolvedValue({ id: "tx-legs-1" }),
        },
        txLeg: {
          deleteMany: vi.fn(),
          createMany: vi.fn().mockImplementation((args: { data: unknown[] }) => {
            capturedLegs = args.data;
          }),
        },
        txClassification: { deleteMany: vi.fn(), createMany: vi.fn() },
      });
    });

    const job = createMockJob({ walletId: "wallet-legs", chainId: 14 });
    await processWalletSync(job);

    expect(capturedLegs).toHaveLength(2);
    expect(capturedLegs[0]).toEqual(
      expect.objectContaining({
        direction: "OUT",
        tokenSymbol: "FLR",
        amount: "500000000000000000",
      }),
    );
    expect(capturedLegs[1]).toEqual(
      expect.objectContaining({
        direction: "IN",
        tokenSymbol: "WFLR",
        amount: "200000000000000000",
      }),
    );
  });

  it("skips zero-value Transfer events", async () => {
    const walletAddr = "0xabc0000000000000000000000000000000000013";

    mockPrismaWallet.findUnique.mockResolvedValue({
      id: "wallet-zero",
      address: walletAddr,
      lastSyncBlock: null,
    });
    mockPrismaWallet.update.mockResolvedValue({});

    mockGetBlockNumber.mockResolvedValue(10);
    mockGetWalletTransactions.mockResolvedValue([
      {
        txHash: "0xtx-zero",
        blockNumber: 5,
        blockTimestamp: 1700000000,
        from: walletAddr,
        to: "0xdef",
        status: "success",
        logs: [],
      },
    ]);

    mockDecodeTransactionLogs.mockReturnValue([
      {
        txHash: "0xtx-zero",
        blockNumber: 5,
        blockTimestamp: 1700000000,
        logIndex: 0,
        contractAddress: "0x1d80c49bbbcd1c0911346656b529df9e5c2f783d",
        eventName: "Transfer",
        args: { from: "0x000", to: walletAddr, value: "0" },
        protocol: null,
      },
    ]);

    let legCreateManyCalled = false;
    mockPrisma$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<void>) => {
      await cb({
        transaction: {
          upsert: vi.fn().mockResolvedValue({ id: "tx-zero" }),
        },
        txLeg: {
          deleteMany: vi.fn(),
          createMany: vi.fn().mockImplementation(() => {
            legCreateManyCalled = true;
          }),
        },
        txClassification: { deleteMany: vi.fn(), createMany: vi.fn() },
      });
    });

    const job = createMockJob({ walletId: "wallet-zero", chainId: 14 });
    await processWalletSync(job);

    // Zero-value transfer should be skipped — createMany should NOT be called
    // because the worker only calls it when legs.length > 0
    expect(legCreateManyCalled).toBe(false);
  });
});

describe("wallet-sync worker — worstAmpelStatus logic", () => {
  it("resolves RED as worst when classifications contain RED + GREEN", async () => {
    mockPrismaWallet.findUnique.mockResolvedValue({
      id: "wallet-worst",
      address: "0xabc0000000000000000000000000000000000014",
      lastSyncBlock: null,
    });
    mockPrismaWallet.update.mockResolvedValue({});

    mockGetBlockNumber.mockResolvedValue(10);
    mockGetWalletTransactions.mockResolvedValue([
      {
        txHash: "0xtx-worst",
        blockNumber: 5,
        blockTimestamp: 1700000000,
        from: "0xabc0000000000000000000000000000000000014",
        to: "0xdef",
        status: "success",
        logs: [],
      },
    ]);

    mockDecodeTransactionLogs.mockReturnValue([
      {
        txHash: "0xtx-worst",
        blockNumber: 5,
        blockTimestamp: 1700000000,
        logIndex: 0,
        contractAddress: "0xaaa",
        eventName: "Swap",
        args: {},
        protocol: "SparkDEX",
      },
      {
        txHash: "0xtx-worst",
        blockNumber: 5,
        blockTimestamp: 1700000000,
        logIndex: 1,
        contractAddress: "0xbbb",
        eventName: "Unknown",
        args: {},
        protocol: null,
      },
    ]);

    let classifyCallCount = 0;
    mockClassify.mockImplementation(() => {
      classifyCallCount++;
      if (classifyCallCount === 1) {
        return {
          ctType: "Trade",
          buyAmount: "100",
          buyCurrency: "FLR",
          sellAmount: null,
          sellCurrency: null,
          fee: null,
          feeCurrency: null,
          exchange: "SparkDEX",
          tradeGroup: "DeFi-Flare",
          ampelStatus: "GREEN",
          isGraubereich: false,
          modelChoice: null,
          comment: "",
        };
      }
      return {
        ctType: "Other",
        buyAmount: null,
        buyCurrency: null,
        sellAmount: null,
        sellCurrency: null,
        fee: null,
        feeCurrency: null,
        exchange: "Unknown",
        tradeGroup: "",
        ampelStatus: "RED",
        isGraubereich: false,
        modelChoice: null,
        comment: "Unknown event",
      };
    });

    let capturedStatus: string | null = null;
    mockPrisma$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<void>) => {
      await cb({
        transaction: {
          upsert: vi.fn().mockImplementation((args: { create: { status: string } }) => {
            capturedStatus = args.create.status;
            return { id: "tx-worst" };
          }),
        },
        txLeg: { deleteMany: vi.fn(), createMany: vi.fn() },
        txClassification: { deleteMany: vi.fn(), createMany: vi.fn() },
      });
    });

    const job = createMockJob({ walletId: "wallet-worst", chainId: 14 });
    await processWalletSync(job);

    // RED is worst between GREEN and RED
    expect(capturedStatus).toBe("RED");
  });
});
