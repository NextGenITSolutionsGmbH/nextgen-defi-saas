// ---------------------------------------------------------------------------
// Unit tests for the Price Fetch Worker
// All external dependencies (Prisma, price APIs, Redis) are fully mocked.
// ---------------------------------------------------------------------------

/**
 * @spec EP-05 — EUR price engine with 4-tier waterfall fallback
 * @spec FR-05-01 — FTSO on-chain price source
 * @spec FR-05-02 — CoinGecko fallback
 * @spec FR-05-03 — CoinMarketCap fallback
 * @spec FR-05-04 — Manual fallback with zero price
 * @spec FR-05-05 — Price audit log for GoBD compliance
 */

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

// ---------------------------------------------------------------------------
// vi.hoisted — variables available inside vi.mock factories
// ---------------------------------------------------------------------------
const {
  mockTokenPrice,
  mockPriceAuditLog,
  mockGetFtsoPrice,
  mockIsFtsoSupported,
  mockGetCoinGeckoPrice,
  mockIsCoinGeckoSupported,
  mockGetCmcPrice,
  mockIsCmcSupported,
} = vi.hoisted(() => ({
  mockTokenPrice: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  mockPriceAuditLog: {
    create: vi.fn(),
  },
  mockGetFtsoPrice: vi.fn(),
  mockIsFtsoSupported: vi.fn(),
  mockGetCoinGeckoPrice: vi.fn(),
  mockIsCoinGeckoSupported: vi.fn(),
  mockGetCmcPrice: vi.fn(),
  mockIsCmcSupported: vi.fn(),
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
  PRICE_FETCH_QUEUE: "price-fetch",
}));

vi.mock("@defi-tracker/db", () => ({
  prisma: {
    tokenPrice: mockTokenPrice,
    priceAuditLog: mockPriceAuditLog,
  },
}));

vi.mock("@defi-tracker/shared", () => ({
  getFtsoPrice: (...args: unknown[]) => mockGetFtsoPrice(...args),
  isFtsoSupported: (...args: unknown[]) => mockIsFtsoSupported(...args),
  getCoinGeckoPrice: (...args: unknown[]) => mockGetCoinGeckoPrice(...args),
  isCoinGeckoSupported: (...args: unknown[]) => mockIsCoinGeckoSupported(...args),
  getCmcPrice: (...args: unknown[]) => mockGetCmcPrice(...args),
  isCmcSupported: (...args: unknown[]) => mockIsCmcSupported(...args),
}));

// ---------------------------------------------------------------------------
// Import the worker and capture the processor
// ---------------------------------------------------------------------------

import { Worker } from "bullmq";
import type { Job } from "bullmq";
import type { PriceFetchJobData } from "@defi-tracker/shared/queue";

import "../price-fetch.worker";

const workerCalls = (Worker as unknown as Mock).mock.calls;
const processPriceFetch: (job: Job<PriceFetchJobData>) => Promise<void> =
  workerCalls[workerCalls.length - 1][1];

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function createMockJob(data: PriceFetchJobData): Job<PriceFetchJobData> {
  return {
    id: "price-job-1",
    data,
    updateProgress: vi.fn(),
  } as unknown as Job<PriceFetchJobData>;
}

const baseJobData: PriceFetchJobData = {
  tokenSymbol: "FLR",
  tokenAddress: "0x1d80c49bbbcd1c0911346656b529df9e5c2f783d",
  chainId: 14,
  timestampUnix: 1700000000,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("price-fetch worker — processPriceFetch [EP-05, FR-05-01..FR-05-05]", () => {
  // -----------------------------------------------------------------------
  // Cache hit
  // -----------------------------------------------------------------------

  it("returns early when the price is already cached", async () => {
    mockTokenPrice.findFirst.mockResolvedValue({
      id: "existing-price",
      tokenSymbol: "FLR",
      chainId: 14,
      timestampUnix: BigInt(1700000000),
      eurPrice: 0.035,
      source: "FTSO",
    });

    const job = createMockJob(baseJobData);
    await processPriceFetch(job);

    // No price creation or audit log should happen
    expect(mockTokenPrice.create).not.toHaveBeenCalled();
    expect(mockPriceAuditLog.create).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // Happy path: FTSO returns price
  // -----------------------------------------------------------------------

  it("fetches price from FTSO and creates TokenPrice + PriceAuditLog", async () => {
    mockTokenPrice.findFirst.mockResolvedValue(null);
    mockIsFtsoSupported.mockReturnValue(true);
    mockGetFtsoPrice.mockResolvedValue({ eurPrice: 0.042 });

    mockTokenPrice.create.mockResolvedValue({});
    mockPriceAuditLog.create.mockResolvedValue({});

    const job = createMockJob(baseJobData);
    await processPriceFetch(job);

    expect(mockTokenPrice.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tokenSymbol: "FLR",
        eurPrice: 0.042,
        source: "FTSO",
        sourceUrl: "ftso://flare-mainnet",
      }),
    });

    expect(mockPriceAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tokenSymbol: "FLR",
        attemptedSource: "FTSO",
        resultSource: "FTSO",
        eurPrice: 0.042,
        fallbackReason: null,
      }),
    });
  });

  // -----------------------------------------------------------------------
  // Fallback: FTSO fails -> CoinGecko succeeds
  // -----------------------------------------------------------------------

  it("falls back to CoinGecko when FTSO fails", async () => {
    mockTokenPrice.findFirst.mockResolvedValue(null);
    mockIsFtsoSupported.mockReturnValue(true);
    mockGetFtsoPrice.mockRejectedValue(new Error("FTSO returned no price for FLR"));

    mockIsCoinGeckoSupported.mockReturnValue(true);
    mockGetCoinGeckoPrice.mockResolvedValue({ eurPrice: 0.041 });

    mockTokenPrice.create.mockResolvedValue({});
    mockPriceAuditLog.create.mockResolvedValue({});

    const job = createMockJob(baseJobData);
    await processPriceFetch(job);

    expect(mockTokenPrice.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eurPrice: 0.041,
        source: "COINGECKO",
        sourceUrl: "https://api.coingecko.com",
      }),
    });

    expect(mockPriceAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        attemptedSource: "COINGECKO",
        resultSource: "COINGECKO",
        fallbackReason: expect.stringContaining("FTSO"),
      }),
    });
  });

  // -----------------------------------------------------------------------
  // Fallback: FTSO + CoinGecko fail -> CMC succeeds
  // -----------------------------------------------------------------------

  it("falls back to CMC when both FTSO and CoinGecko fail", async () => {
    mockTokenPrice.findFirst.mockResolvedValue(null);
    mockIsFtsoSupported.mockReturnValue(true);
    mockGetFtsoPrice.mockRejectedValue(new Error("FTSO timeout"));

    mockIsCoinGeckoSupported.mockReturnValue(true);
    mockGetCoinGeckoPrice.mockRejectedValue(new Error("CoinGecko rate limited"));

    mockIsCmcSupported.mockReturnValue(true);
    process.env.CMC_API_KEY = "test-api-key";
    mockGetCmcPrice.mockResolvedValue({ eurPrice: 0.040 });

    mockTokenPrice.create.mockResolvedValue({});
    mockPriceAuditLog.create.mockResolvedValue({});

    const job = createMockJob(baseJobData);
    await processPriceFetch(job);

    expect(mockTokenPrice.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eurPrice: 0.040,
        source: "CMC",
        sourceUrl: "https://pro-api.coinmarketcap.com",
      }),
    });

    expect(mockPriceAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        attemptedSource: "CMC",
        resultSource: "CMC",
        fallbackReason: expect.stringContaining("FTSO"),
      }),
    });
  });

  // -----------------------------------------------------------------------
  // Fallback: All fail -> MANUAL with price 0
  // -----------------------------------------------------------------------

  it("falls back to MANUAL with zero price when all sources fail", async () => {
    mockTokenPrice.findFirst.mockResolvedValue(null);
    mockIsFtsoSupported.mockReturnValue(true);
    mockGetFtsoPrice.mockRejectedValue(new Error("FTSO down"));

    mockIsCoinGeckoSupported.mockReturnValue(true);
    mockGetCoinGeckoPrice.mockRejectedValue(new Error("CoinGecko down"));

    mockIsCmcSupported.mockReturnValue(true);
    process.env.CMC_API_KEY = "test-api-key";
    mockGetCmcPrice.mockRejectedValue(new Error("CMC down"));

    mockTokenPrice.create.mockResolvedValue({});
    mockPriceAuditLog.create.mockResolvedValue({});

    const job = createMockJob(baseJobData);
    await processPriceFetch(job);

    expect(mockTokenPrice.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eurPrice: 0,
        source: "MANUAL",
        sourceUrl: null,
      }),
    });

    expect(mockPriceAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        resultSource: "MANUAL",
        eurPrice: 0,
        fallbackReason: expect.stringContaining("FTSO"),
      }),
    });
  });

  // -----------------------------------------------------------------------
  // FTSO unsupported token skips straight to CoinGecko
  // -----------------------------------------------------------------------

  it("skips FTSO when token is not FTSO-supported", async () => {
    mockTokenPrice.findFirst.mockResolvedValue(null);
    mockIsFtsoSupported.mockReturnValue(false);

    mockIsCoinGeckoSupported.mockReturnValue(true);
    mockGetCoinGeckoPrice.mockResolvedValue({ eurPrice: 1.05 });

    mockTokenPrice.create.mockResolvedValue({});
    mockPriceAuditLog.create.mockResolvedValue({});

    const job = createMockJob({
      ...baseJobData,
      tokenSymbol: "SPRK",
      tokenAddress: "0xsprk",
    });
    await processPriceFetch(job);

    // FTSO was NOT called for price
    expect(mockGetFtsoPrice).not.toHaveBeenCalled();

    expect(mockTokenPrice.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eurPrice: 1.05,
        source: "COINGECKO",
      }),
    });
  });

  // -----------------------------------------------------------------------
  // CoinGecko unsupported skips to CMC
  // -----------------------------------------------------------------------

  it("skips CoinGecko when token is not CoinGecko-supported", async () => {
    mockTokenPrice.findFirst.mockResolvedValue(null);
    mockIsFtsoSupported.mockReturnValue(false);
    mockIsCoinGeckoSupported.mockReturnValue(false);

    mockIsCmcSupported.mockReturnValue(true);
    process.env.CMC_API_KEY = "test-api-key";
    mockGetCmcPrice.mockResolvedValue({ eurPrice: 0.99 });

    mockTokenPrice.create.mockResolvedValue({});
    mockPriceAuditLog.create.mockResolvedValue({});

    const job = createMockJob({
      ...baseJobData,
      tokenSymbol: "EXOTIC",
      tokenAddress: "0xexotic",
    });
    await processPriceFetch(job);

    expect(mockGetFtsoPrice).not.toHaveBeenCalled();
    expect(mockGetCoinGeckoPrice).not.toHaveBeenCalled();

    expect(mockTokenPrice.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eurPrice: 0.99,
        source: "CMC",
      }),
    });
  });

  // -----------------------------------------------------------------------
  // Audit log records the correct attemptedSource and resultSource
  // -----------------------------------------------------------------------

  it("records FTSO as attemptedSource when FTSO is tried first", async () => {
    mockTokenPrice.findFirst.mockResolvedValue(null);
    mockIsFtsoSupported.mockReturnValue(true);
    mockGetFtsoPrice.mockResolvedValue({ eurPrice: 0.05 });

    mockTokenPrice.create.mockResolvedValue({});
    mockPriceAuditLog.create.mockResolvedValue({});

    const job = createMockJob(baseJobData);
    await processPriceFetch(job);

    const auditCall = mockPriceAuditLog.create.mock.calls[0][0];
    expect(auditCall.data.attemptedSource).toBe("FTSO");
    expect(auditCall.data.resultSource).toBe("FTSO");
  });

  // -----------------------------------------------------------------------
  // FTSO returns null -> fallback
  // -----------------------------------------------------------------------

  it("falls back when FTSO returns null result", async () => {
    mockTokenPrice.findFirst.mockResolvedValue(null);
    mockIsFtsoSupported.mockReturnValue(true);
    mockGetFtsoPrice.mockResolvedValue(null);

    mockIsCoinGeckoSupported.mockReturnValue(true);
    mockGetCoinGeckoPrice.mockResolvedValue({ eurPrice: 0.038 });

    mockTokenPrice.create.mockResolvedValue({});
    mockPriceAuditLog.create.mockResolvedValue({});

    const job = createMockJob(baseJobData);
    await processPriceFetch(job);

    expect(mockTokenPrice.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eurPrice: 0.038,
        source: "COINGECKO",
      }),
    });
  });

  // -----------------------------------------------------------------------
  // Timestamp is stored as BigInt
  // -----------------------------------------------------------------------

  it("stores timestampUnix as BigInt in both TokenPrice and PriceAuditLog", async () => {
    mockTokenPrice.findFirst.mockResolvedValue(null);
    mockIsFtsoSupported.mockReturnValue(true);
    mockGetFtsoPrice.mockResolvedValue({ eurPrice: 0.05 });

    mockTokenPrice.create.mockResolvedValue({});
    mockPriceAuditLog.create.mockResolvedValue({});

    const job = createMockJob(baseJobData);
    await processPriceFetch(job);

    const priceCall = mockTokenPrice.create.mock.calls[0][0];
    expect(priceCall.data.timestampUnix).toBe(BigInt(1700000000));

    const auditCall = mockPriceAuditLog.create.mock.calls[0][0];
    expect(auditCall.data.timestampUnix).toBe(BigInt(1700000000));
  });

  // -----------------------------------------------------------------------
  // CMC missing API key -> falls through to MANUAL
  // -----------------------------------------------------------------------

  it("falls to MANUAL when CMC_API_KEY is missing", async () => {
    mockTokenPrice.findFirst.mockResolvedValue(null);
    mockIsFtsoSupported.mockReturnValue(false);
    mockIsCoinGeckoSupported.mockReturnValue(false);
    mockIsCmcSupported.mockReturnValue(true);

    const originalKey = process.env.CMC_API_KEY;
    delete process.env.CMC_API_KEY;

    mockTokenPrice.create.mockResolvedValue({});
    mockPriceAuditLog.create.mockResolvedValue({});

    const job = createMockJob(baseJobData);
    await processPriceFetch(job);

    expect(mockTokenPrice.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eurPrice: 0,
        source: "MANUAL",
      }),
    });

    // Restore
    if (originalKey) process.env.CMC_API_KEY = originalKey;
  });

  // -----------------------------------------------------------------------
  // Fallback reason includes all failed sources
  // -----------------------------------------------------------------------

  it("includes all failure reasons in fallbackReason when falling to MANUAL", async () => {
    mockTokenPrice.findFirst.mockResolvedValue(null);
    mockIsFtsoSupported.mockReturnValue(true);
    mockGetFtsoPrice.mockRejectedValue(new Error("FTSO: network timeout"));

    mockIsCoinGeckoSupported.mockReturnValue(true);
    mockGetCoinGeckoPrice.mockRejectedValue(new Error("CoinGecko: 429 rate limit"));

    mockIsCmcSupported.mockReturnValue(true);
    process.env.CMC_API_KEY = "test-api-key";
    mockGetCmcPrice.mockRejectedValue(new Error("CMC: invalid response"));

    mockTokenPrice.create.mockResolvedValue({});
    mockPriceAuditLog.create.mockResolvedValue({});

    const job = createMockJob(baseJobData);
    await processPriceFetch(job);

    const auditCall = mockPriceAuditLog.create.mock.calls[0][0];
    expect(auditCall.data.fallbackReason).toContain("FTSO: network timeout");
    expect(auditCall.data.fallbackReason).toContain("CoinGecko: 429 rate limit");
    expect(auditCall.data.fallbackReason).toContain("CMC: invalid response");
  });
});
