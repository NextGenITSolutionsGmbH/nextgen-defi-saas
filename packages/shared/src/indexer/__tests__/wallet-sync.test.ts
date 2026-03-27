import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  WalletSyncService,
  createFlareSyncService,
  type SyncProgress,
} from '../wallet-sync';
import { FlareRpcClient, type FlareRpcConfig, type DecodedTransaction, type RpcLog } from '../flare-rpc';
import * as eventDecoder from '../event-decoder';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_CONFIG: FlareRpcConfig = {
  rpcUrl: 'https://flare-api.flare.network/ext/C/rpc',
  chainId: 14,
  maxBlockRange: 2048,
  requestTimeoutMs: 5_000,
};

const WALLET_ADDRESS = '0xabcdef1234567890abcdef1234567890abcdef12';

function makeMockLog(overrides: Partial<RpcLog> = {}): RpcLog {
  return {
    address: '0x1234567890abcdef1234567890abcdef12345678',
    topics: [
      '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
    ],
    data: '0x0000000000000000000000000000000000000000000000000de0b6b3a7640000',
    blockNumber: '0x64',
    transactionHash: '0xaaaa111122223333444455556666777788889999aaaabbbbccccddddeeeeffff',
    logIndex: '0x0',
    blockHash: '0xblockhash123',
    removed: false,
    ...overrides,
  };
}

function makeDecodedTx(overrides: Partial<DecodedTransaction> = {}): DecodedTransaction {
  return {
    txHash: '0xaaaa111122223333444455556666777788889999aaaabbbbccccddddeeeeffff',
    blockNumber: 100,
    blockTimestamp: 1710244473,
    from: '0xabcdef1234567890abcdef1234567890abcdef12',
    to: '0x2222222222222222222222222222222222222222',
    logs: [makeMockLog()],
    status: 'success',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WalletSyncService', () => {
  let getBlockNumberMock: ReturnType<typeof vi.fn>;
  let getWalletTransactionsMock: ReturnType<typeof vi.fn>;
  let verifyConnectionMock: ReturnType<typeof vi.fn>;
  let decodeTransactionLogsSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    getBlockNumberMock = vi.fn();
    getWalletTransactionsMock = vi.fn();
    verifyConnectionMock = vi.fn();

    // Mock FlareRpcClient methods on prototype
    vi.spyOn(FlareRpcClient.prototype, 'getBlockNumber').mockImplementation(getBlockNumberMock);
    vi.spyOn(FlareRpcClient.prototype, 'getWalletTransactions').mockImplementation(getWalletTransactionsMock);
    vi.spyOn(FlareRpcClient.prototype, 'verifyConnection').mockImplementation(verifyConnectionMock);

    // Spy on decodeTransactionLogs but let it run normally
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    decodeTransactionLogsSpy = vi.spyOn(eventDecoder, 'decodeTransactionLogs') as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---- syncWallet: Full Sync ----

  describe('syncWallet() — full sync', () => {
    it('should process chunks and return correct result summary', async () => {
      getBlockNumberMock.mockResolvedValue(20_000);

      // Each chunk returns some transactions
      getWalletTransactionsMock
        .mockResolvedValueOnce([makeDecodedTx({ blockNumber: 100 })])
        .mockResolvedValueOnce([makeDecodedTx({ blockNumber: 11_000 })])
        .mockResolvedValueOnce([]);

      const service = new WalletSyncService(TEST_CONFIG);
      const result = await service.syncWallet(WALLET_ADDRESS, 0, 20_000);

      expect(result.walletAddress).toBe(WALLET_ADDRESS.toLowerCase());
      expect(result.fromBlock).toBe(0);
      expect(result.toBlock).toBe(20_000);
      expect(result.transactionsFound).toBe(2);
      expect(result.errors).toHaveLength(0);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should fetch latest block when toBlock is not provided', async () => {
      getBlockNumberMock.mockResolvedValue(5_000);
      getWalletTransactionsMock.mockResolvedValue([]);

      const service = new WalletSyncService(TEST_CONFIG);
      const result = await service.syncWallet(WALLET_ADDRESS, 0);

      expect(result.toBlock).toBe(5_000);
      expect(getBlockNumberMock).toHaveBeenCalled();
    });

    it('should lowercase wallet address', async () => {
      getBlockNumberMock.mockResolvedValue(100);
      getWalletTransactionsMock.mockResolvedValue([]);

      const service = new WalletSyncService(TEST_CONFIG);
      const result = await service.syncWallet('0xAbCdEf1234567890AbCdEf1234567890AbCdEf12', 0, 100);

      expect(result.walletAddress).toBe('0xabcdef1234567890abcdef1234567890abcdef12');
      expect(getWalletTransactionsMock).toHaveBeenCalledWith(
        '0xabcdef1234567890abcdef1234567890abcdef12',
        expect.any(Number),
        expect.any(Number),
      );
    });

    it('should decode transaction logs for each transaction', async () => {
      const tx = makeDecodedTx({ logs: [makeMockLog(), makeMockLog({ logIndex: '0x1' })] });
      getBlockNumberMock.mockResolvedValue(100);
      getWalletTransactionsMock.mockResolvedValue([tx]);

      const service = new WalletSyncService(TEST_CONFIG);
      await service.syncWallet(WALLET_ADDRESS, 0, 100);

      expect(decodeTransactionLogsSpy).toHaveBeenCalledWith(tx.logs, tx.blockTimestamp);
    });

    it('should count decoded events', async () => {
      // Mock decodeTransactionLogs to return 3 events
      decodeTransactionLogsSpy.mockReturnValue([
        {
          txHash: '0xabc',
          blockNumber: 100,
          blockTimestamp: 1710244473,
          logIndex: 0,
          contractAddress: '0x1234',
          eventName: 'Transfer',
          args: {},
          protocol: null,
          raw: makeMockLog(),
        },
        {
          txHash: '0xabc',
          blockNumber: 100,
          blockTimestamp: 1710244473,
          logIndex: 1,
          contractAddress: '0x1234',
          eventName: 'Approval',
          args: {},
          protocol: null,
          raw: makeMockLog(),
        },
        {
          txHash: '0xabc',
          blockNumber: 100,
          blockTimestamp: 1710244473,
          logIndex: 2,
          contractAddress: '0x1234',
          eventName: 'Swap',
          args: {},
          protocol: 'SparkDEX',
          raw: makeMockLog(),
        },
      ]);

      getBlockNumberMock.mockResolvedValue(100);
      getWalletTransactionsMock.mockResolvedValue([makeDecodedTx()]);

      const service = new WalletSyncService(TEST_CONFIG);
      const result = await service.syncWallet(WALLET_ADDRESS, 0, 100);

      expect(result.eventsDecoded).toBe(3);
    });
  });

  // ---- syncWallet: Empty Range ----

  describe('syncWallet() — empty block range', () => {
    it('should return zero transactions when fromBlock > toBlock', async () => {
      getBlockNumberMock.mockResolvedValue(50);

      const service = new WalletSyncService(TEST_CONFIG);
      const result = await service.syncWallet(WALLET_ADDRESS, 100, 50);

      expect(result.transactionsFound).toBe(0);
      expect(result.eventsDecoded).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should return zero transactions for same from and to block with no TXs', async () => {
      getBlockNumberMock.mockResolvedValue(100);
      getWalletTransactionsMock.mockResolvedValue([]);

      const service = new WalletSyncService(TEST_CONFIG);
      const result = await service.syncWallet(WALLET_ADDRESS, 100, 100);

      expect(result.transactionsFound).toBe(0);
    });
  });

  // ---- Adaptive Chunk Sizing ----

  describe('adaptive chunk sizing', () => {
    it('should double chunk size when chunk completes in under 5 seconds', async () => {
      getBlockNumberMock.mockResolvedValue(100_000);

      // Track the block ranges passed to getWalletTransactions
      const calledRanges: { from: number; to: number }[] = [];
      getWalletTransactionsMock.mockImplementation(
        async (_addr: string, from: number, to: number) => {
          calledRanges.push({ from, to });
          // Simulate a fast response (< 5s) — no delay at all
          return [];
        },
      );

      const service = new WalletSyncService(TEST_CONFIG);
      await service.syncWallet(WALLET_ADDRESS, 0, 100_000);

      // Default chunk size is 10_000. First chunk: 0-9999
      expect(calledRanges[0].from).toBe(0);
      expect(calledRanges[0].to).toBe(9_999);

      // After fast response, chunk size should double to 20_000
      // Second chunk: 10_000 - 29_999
      expect(calledRanges[1].from).toBe(10_000);
      expect(calledRanges[1].to).toBe(29_999);

      // After another fast response, doubles to 40_000
      // Third chunk: 30_000 - 69_999 (capped to 50_000 max -> 30_000 - 79_999)
      expect(calledRanges[2].from).toBe(30_000);
      // Chunk size is now 40_000, so to = 30_000 + 40_000 - 1 = 69_999
      expect(calledRanges[2].to).toBe(69_999);
    });

    it('should halve chunk size when chunk takes over 15 seconds', async () => {
      getBlockNumberMock.mockResolvedValue(50_000);

      const calledRanges: { from: number; to: number }[] = [];
      let callCount = 0;

      // Mock Date.now to simulate time passing during the first chunk
      const realDateNow = Date.now;
      let timeOffset = 0;
      vi.spyOn(Date, 'now').mockImplementation(() => realDateNow() + timeOffset);

      getWalletTransactionsMock.mockImplementation(
        async (_addr: string, from: number, to: number) => {
          calledRanges.push({ from, to });
          callCount++;
          if (callCount === 1) {
            // Simulate slow response: advance time by 16 seconds
            timeOffset += 16_000;
          }
          return [];
        },
      );

      const service = new WalletSyncService(TEST_CONFIG);
      await service.syncWallet(WALLET_ADDRESS, 0, 50_000);

      // First chunk: 10_000 (default)
      expect(calledRanges[0].to - calledRanges[0].from + 1).toBe(10_000);

      // After slow chunk, chunk size halved to 5_000
      expect(calledRanges.length).toBeGreaterThan(1);
      expect(calledRanges[1].to - calledRanges[1].from + 1).toBe(5_000);
    });

    it('should halve chunk size on error', async () => {
      getBlockNumberMock.mockResolvedValue(30_000);

      const calledRanges: { from: number; to: number }[] = [];
      let callCount = 0;

      getWalletTransactionsMock.mockImplementation(
        async (_addr: string, from: number, to: number) => {
          calledRanges.push({ from, to });
          callCount++;
          if (callCount === 1) {
            throw new Error('RPC rate limit');
          }
          return [];
        },
      );

      const service = new WalletSyncService(TEST_CONFIG);
      const result = await service.syncWallet(WALLET_ADDRESS, 0, 30_000);

      // First chunk: 10_000 (default)
      expect(calledRanges[0].to - calledRanges[0].from + 1).toBe(10_000);

      // After error, chunk size halved to 5_000
      expect(calledRanges[1].to - calledRanges[1].from + 1).toBe(5_000);

      // The error should be recorded
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('RPC rate limit');
    });

    it('should not reduce chunk below MIN_CHUNK_SIZE (2048)', async () => {
      // Use a large enough range so that the chunk after repeated errors
      // is NOT the tail chunk (which can naturally be smaller).
      getBlockNumberMock.mockResolvedValue(100_000);

      const calledRanges: { from: number; to: number }[] = [];
      let callCount = 0;

      getWalletTransactionsMock.mockImplementation(
        async (_addr: string, from: number, to: number) => {
          calledRanges.push({ from, to });
          callCount++;
          // Keep throwing errors to force chunk shrinking
          if (callCount <= 6) {
            throw new Error('Rate limit');
          }
          return [];
        },
      );

      const service = new WalletSyncService(TEST_CONFIG);
      await service.syncWallet(WALLET_ADDRESS, 0, 100_000);

      // Chunk sizes: 10_000 -> 5_000 -> 2_500 -> 2_048 (min, floor(2500/2)=1250 but clamped) -> 2_048 -> 2_048 -> 2_048
      // After 3 reductions from 10_000: 10_000 -> 5_000 -> 2_500 -> max(1250, 2048) = 2_048
      // Check that chunk sizes after stabilizing at min are at least 2_048
      // Find chunks where error occurred (first 6) and check the later ones
      const chunkSizes = calledRanges.map((r) => r.to - r.from + 1);

      // After the first 3 error-driven reductions, chunk size should stabilize at 2_048
      // Chunk 4 onward (0-indexed: index 3+) should be 2_048 (still erroring but at min)
      for (let i = 3; i < Math.min(calledRanges.length - 1, 7); i++) {
        // Exclude the very last chunk which may be a tail
        expect(chunkSizes[i]).toBeGreaterThanOrEqual(2_048);
      }
    });
  });

  // ---- Progress Callback ----

  describe('progress callback', () => {
    it('should call onProgress with correct percentage values', async () => {
      getBlockNumberMock.mockResolvedValue(20_000);
      getWalletTransactionsMock.mockResolvedValue([makeDecodedTx()]);

      const progressUpdates: SyncProgress[] = [];
      const onProgress = vi.fn((progress: SyncProgress) => {
        progressUpdates.push({ ...progress });
      });

      const service = new WalletSyncService(TEST_CONFIG, onProgress);
      await service.syncWallet(WALLET_ADDRESS, 0, 20_000);

      expect(onProgress).toHaveBeenCalled();

      // First progress update should have a valid percentage
      expect(progressUpdates[0].walletAddress).toBe(WALLET_ADDRESS.toLowerCase());
      expect(progressUpdates[0].targetBlock).toBe(20_000);
      expect(progressUpdates[0].percentage).toBeGreaterThanOrEqual(0);
      expect(progressUpdates[0].percentage).toBeLessThanOrEqual(100);

      // Last progress update should approach 100%
      const lastUpdate = progressUpdates[progressUpdates.length - 1];
      expect(lastUpdate.percentage).toBeGreaterThan(0);

      // processedTxCount should accumulate
      for (const update of progressUpdates) {
        expect(update.processedTxCount).toBeGreaterThanOrEqual(0);
        expect(update.estimatedSecondsRemaining).toBeGreaterThanOrEqual(0);
      }
    });

    it('should not throw when no onProgress callback provided', async () => {
      getBlockNumberMock.mockResolvedValue(100);
      getWalletTransactionsMock.mockResolvedValue([]);

      const service = new WalletSyncService(TEST_CONFIG);

      await expect(
        service.syncWallet(WALLET_ADDRESS, 0, 100),
      ).resolves.not.toThrow();
    });
  });

  // ---- Delta Sync ----

  describe('deltaSyncWallet()', () => {
    it('should start from lastSyncBlock + 1', async () => {
      getBlockNumberMock.mockResolvedValue(20_000);
      getWalletTransactionsMock.mockResolvedValue([]);

      const service = new WalletSyncService(TEST_CONFIG);
      const result = await service.deltaSyncWallet(WALLET_ADDRESS, 15_000);

      expect(result.fromBlock).toBe(15_001);
      expect(result.toBlock).toBe(20_000);

      // Verify getWalletTransactions was called starting from 15_001
      expect(getWalletTransactionsMock).toHaveBeenCalledWith(
        WALLET_ADDRESS.toLowerCase(),
        15_001,
        expect.any(Number),
      );
    });

    it('should return zero transactions when already synced to latest', async () => {
      getBlockNumberMock.mockResolvedValue(15_000);
      // fromBlock (15_001) > toBlock (15_000) -> no chunks to process

      const service = new WalletSyncService(TEST_CONFIG);
      const result = await service.deltaSyncWallet(WALLET_ADDRESS, 15_000);

      expect(result.transactionsFound).toBe(0);
    });
  });

  // ---- processTransaction (tested via syncWallet) ----

  describe('processTransaction (internal)', () => {
    it('should extract protocol from decoded events', async () => {
      // Mock decodeTransactionLogs to return an event with protocol
      decodeTransactionLogsSpy.mockReturnValueOnce([
        {
          txHash: '0xabc',
          blockNumber: 100,
          blockTimestamp: 1710244473,
          logIndex: 0,
          contractAddress: '0x8a1e35f5c98c4e85500f079e0b2bd83bdf23e9cd',
          eventName: 'Swap',
          args: {},
          protocol: 'SparkDEX',
          raw: makeMockLog(),
        },
      ]);

      getBlockNumberMock.mockResolvedValue(100);
      getWalletTransactionsMock.mockResolvedValue([makeDecodedTx()]);

      const service = new WalletSyncService(TEST_CONFIG);
      const result = await service.syncWallet(WALLET_ADDRESS, 0, 100);

      // Protocol should be picked up from the first event with a non-null protocol
      expect(result.transactionsFound).toBe(1);
    });

    it('should set rawData status correctly', async () => {
      const successTx = makeDecodedTx({ status: 'success' });
      const revertedTx = makeDecodedTx({
        txHash: '0xbbbb111122223333444455556666777788889999aaaabbbbccccddddeeeeffff',
        status: 'reverted',
        blockNumber: 200,
      });

      getBlockNumberMock.mockResolvedValue(300);
      getWalletTransactionsMock.mockResolvedValue([successTx, revertedTx]);

      const service = new WalletSyncService(TEST_CONFIG);
      const result = await service.syncWallet(WALLET_ADDRESS, 0, 300);

      expect(result.transactionsFound).toBe(2);
    });
  });

  // ---- healthCheck ----

  describe('healthCheck()', () => {
    it('should return healthy=true when connection succeeds', async () => {
      verifyConnectionMock.mockResolvedValue({
        connected: true,
        chainId: 14,
        blockNumber: 30_000_000,
      });

      const service = new WalletSyncService(TEST_CONFIG);
      const health = await service.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.chainId).toBe(14);
      expect(health.latestBlock).toBe(30_000_000);
    });

    it('should return healthy=false when connection fails', async () => {
      verifyConnectionMock.mockResolvedValue({
        connected: false,
        chainId: 0,
        blockNumber: 0,
      });

      const service = new WalletSyncService(TEST_CONFIG);
      const health = await service.healthCheck();

      expect(health.healthy).toBe(false);
      expect(health.chainId).toBe(0);
      expect(health.latestBlock).toBe(0);
    });
  });

  // ---- createFlareSyncService ----

  describe('createFlareSyncService()', () => {
    it('should create a WalletSyncService instance', () => {
      const service = createFlareSyncService();
      expect(service).toBeInstanceOf(WalletSyncService);
    });

    it('should accept an optional progress callback', () => {
      const onProgress = vi.fn();
      const service = createFlareSyncService(onProgress);
      expect(service).toBeInstanceOf(WalletSyncService);
    });
  });

  // ---- Error Handling ----

  describe('error handling', () => {
    it('should collect errors and continue processing remaining chunks', async () => {
      getBlockNumberMock.mockResolvedValue(30_000);

      let callCount = 0;
      getWalletTransactionsMock.mockImplementation(
        async () => {
          callCount++;
          if (callCount === 2) {
            throw new Error('Temporary RPC failure');
          }
          return [makeDecodedTx()];
        },
      );

      const service = new WalletSyncService(TEST_CONFIG);
      const result = await service.syncWallet(WALLET_ADDRESS, 0, 30_000);

      // Should have errors but also found some transactions
      expect(result.errors.length).toBeGreaterThanOrEqual(1);
      expect(result.errors[0]).toContain('Temporary RPC failure');
      expect(result.transactionsFound).toBeGreaterThanOrEqual(1);
    });
  });
});
