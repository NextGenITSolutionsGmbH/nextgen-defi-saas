import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  FlareRpcClient,
  FLARE_MAINNET_CONFIG,
  FLARE_TESTNET_CONFIG,
  type FlareRpcConfig,
  type RpcBlock,
  type RpcTransactionReceipt,
  type RpcLog,
} from '../flare-rpc';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal JSON-RPC success response */
function rpcSuccess(result: unknown, id: number = 1) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => ({ jsonrpc: '2.0', id, result }),
  };
}

/** Build a JSON-RPC error response */
function rpcError(code: number, message: string, id: number = 1) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => ({ jsonrpc: '2.0', id, error: { code, message } }),
  };
}

/** Build an HTTP error response */
function httpError(status: number, statusText: string) {
  return {
    ok: false,
    status,
    statusText,
    json: async () => ({}),
  };
}

function makeMockLog(overrides: Partial<RpcLog> = {}): RpcLog {
  return {
    address: '0x1234567890abcdef1234567890abcdef12345678',
    topics: [
      '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
      '0x0000000000000000000000001111111111111111111111111111111111111111',
      '0x0000000000000000000000002222222222222222222222222222222222222222',
    ],
    data: '0x0000000000000000000000000000000000000000000000000de0b6b3a7640000',
    blockNumber: '0xbeef',
    transactionHash: '0xaaaa111122223333444455556666777788889999aaaabbbbccccddddeeeeffff',
    logIndex: '0x0',
    blockHash: '0xblockhash1234567890abcdef1234567890abcdef1234567890abcdef12345678',
    removed: false,
    ...overrides,
  };
}

function makeMockReceipt(overrides: Partial<RpcTransactionReceipt> = {}): RpcTransactionReceipt {
  return {
    transactionHash: '0xaaaa111122223333444455556666777788889999aaaabbbbccccddddeeeeffff',
    blockNumber: '0xbeef',
    blockHash: '0xblockhash1234567890abcdef1234567890abcdef1234567890abcdef12345678',
    from: '0x1111111111111111111111111111111111111111',
    to: '0x2222222222222222222222222222222222222222',
    status: '0x1',
    gasUsed: '0x5208',
    logs: [makeMockLog()],
    ...overrides,
  };
}

function makeMockBlock(overrides: Partial<RpcBlock> = {}): RpcBlock {
  return {
    number: '0xbeef',
    timestamp: '0x65d8a200',
    hash: '0xblockhash1234567890abcdef1234567890abcdef1234567890abcdef12345678',
    transactions: [
      '0xaaaa111122223333444455556666777788889999aaaabbbbccccddddeeeeffff',
    ],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test config with short timeout for faster tests
// ---------------------------------------------------------------------------

const TEST_CONFIG: FlareRpcConfig = {
  rpcUrl: 'https://flare-api.flare.network/ext/C/rpc',
  chainId: 14,
  maxBlockRange: 2048,
  requestTimeoutMs: 5_000,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

/**
 * @spec EP-01 — Flare RPC connectivity
 * @spec NFR-I04 — RPC reliability and error handling
 */

describe('FlareRpcClient [EP-01, NFR-I04]', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // ---- Config Defaults ----

  describe('default configs', () => {
    it('should expose Flare mainnet config with chain ID 14', () => {
      expect(FLARE_MAINNET_CONFIG.chainId).toBe(14);
      expect(FLARE_MAINNET_CONFIG.rpcUrl).toContain('flare-api.flare.network');
      expect(FLARE_MAINNET_CONFIG.maxBlockRange).toBe(2048);
    });

    it('should expose Flare testnet config with chain ID 114', () => {
      expect(FLARE_TESTNET_CONFIG.chainId).toBe(114);
      expect(FLARE_TESTNET_CONFIG.rpcUrl).toContain('coston2');
    });
  });

  // ---- getBlockNumber ----

  describe('getBlockNumber()', () => {
    it('should return parsed hex block number', async () => {
      fetchMock.mockResolvedValueOnce(rpcSuccess('0x1a2b3c'));
      const client = new FlareRpcClient(TEST_CONFIG);

      const blockNumber = await client.getBlockNumber();

      expect(blockNumber).toBe(0x1a2b3c);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      // Verify the JSON-RPC payload
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.method).toBe('eth_blockNumber');
      expect(body.params).toEqual([]);
    });

    it('should handle block number zero', async () => {
      fetchMock.mockResolvedValueOnce(rpcSuccess('0x0'));
      const client = new FlareRpcClient(TEST_CONFIG);

      const blockNumber = await client.getBlockNumber();
      expect(blockNumber).toBe(0);
    });

    it('should handle large block numbers', async () => {
      // Block ~30 million
      fetchMock.mockResolvedValueOnce(rpcSuccess('0x1c9c380'));
      const client = new FlareRpcClient(TEST_CONFIG);

      const blockNumber = await client.getBlockNumber();
      expect(blockNumber).toBe(30_000_000);
    });
  });

  // ---- getBlock ----

  describe('getBlock()', () => {
    it('should return block with parsed fields', async () => {
      const mockBlock = makeMockBlock();
      fetchMock.mockResolvedValueOnce(rpcSuccess(mockBlock));
      const client = new FlareRpcClient(TEST_CONFIG);

      const block = await client.getBlock(0xbeef);

      expect(block.number).toBe('0xbeef');
      expect(block.timestamp).toBe('0x65d8a200');
      expect(block.hash).toBeTruthy();
      expect(block.transactions).toHaveLength(1);

      // Verify hex block number is sent in params
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.method).toBe('eth_getBlockByNumber');
      expect(body.params[0]).toBe('0xbeef');
      expect(body.params[1]).toBe(false); // No full TX objects
    });

    it('should convert block number to hex for the RPC call', async () => {
      const mockBlock = makeMockBlock({ number: '0x100' });
      fetchMock.mockResolvedValueOnce(rpcSuccess(mockBlock));
      const client = new FlareRpcClient(TEST_CONFIG);

      await client.getBlock(256);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.params[0]).toBe('0x100');
    });
  });

  // ---- getTransactionReceipt ----

  describe('getTransactionReceipt()', () => {
    it('should parse receipt with logs', async () => {
      const receipt = makeMockReceipt();
      fetchMock.mockResolvedValueOnce(rpcSuccess(receipt));
      const client = new FlareRpcClient(TEST_CONFIG);

      const result = await client.getTransactionReceipt(receipt.transactionHash);

      expect(result).not.toBeNull();
      expect(result!.transactionHash).toBe(receipt.transactionHash);
      expect(result!.status).toBe('0x1');
      expect(result!.logs).toHaveLength(1);
      expect(result!.from).toBe('0x1111111111111111111111111111111111111111');
    });

    it('should return null for unknown transaction', async () => {
      fetchMock.mockResolvedValueOnce(rpcSuccess(null));
      const client = new FlareRpcClient(TEST_CONFIG);

      const result = await client.getTransactionReceipt('0x0000000000000000000000000000000000000000000000000000000000000000');

      expect(result).toBeNull();
    });

    it('should pass tx hash in params', async () => {
      fetchMock.mockResolvedValueOnce(rpcSuccess(null));
      const client = new FlareRpcClient(TEST_CONFIG);
      const txHash = '0xdeadbeef1234567890abcdef1234567890abcdef1234567890abcdef12345678';

      await client.getTransactionReceipt(txHash);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.method).toBe('eth_getTransactionReceipt');
      expect(body.params).toEqual([txHash]);
    });
  });

  // ---- getLogs ----

  describe('getLogs()', () => {
    it('should return logs for a single chunk', async () => {
      const logs = [makeMockLog(), makeMockLog({ logIndex: '0x1' })];
      fetchMock.mockResolvedValueOnce(rpcSuccess(logs));
      const client = new FlareRpcClient(TEST_CONFIG);

      const result = await client.getLogs({
        address: '0x1234567890abcdef1234567890abcdef12345678',
        fromBlock: 100,
        toBlock: 200,
      });

      expect(result).toHaveLength(2);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('should chunk across maxBlockRange intervals', async () => {
      const config: FlareRpcConfig = { ...TEST_CONFIG, maxBlockRange: 100 };
      const client = new FlareRpcClient(config);

      // Range 0-249 with maxBlockRange=100 should need 3 chunks:
      // 0-99, 100-199, 200-249
      fetchMock
        .mockResolvedValueOnce(rpcSuccess([makeMockLog({ blockNumber: '0x10' })]))
        .mockResolvedValueOnce(rpcSuccess([makeMockLog({ blockNumber: '0x80' })]))
        .mockResolvedValueOnce(rpcSuccess([makeMockLog({ blockNumber: '0xf0' })]))

      const result = await client.getLogs({
        fromBlock: 0,
        toBlock: 249,
      });

      expect(result).toHaveLength(3);
      expect(fetchMock).toHaveBeenCalledTimes(3);

      // Verify chunk boundaries
      const call1Body = JSON.parse(fetchMock.mock.calls[0][1].body);
      const call2Body = JSON.parse(fetchMock.mock.calls[1][1].body);
      const call3Body = JSON.parse(fetchMock.mock.calls[2][1].body);

      expect(call1Body.params[0].fromBlock).toBe('0x0');
      expect(call1Body.params[0].toBlock).toBe('0x63');   // 99

      expect(call2Body.params[0].fromBlock).toBe('0x64');  // 100
      expect(call2Body.params[0].toBlock).toBe('0xc7');    // 199

      expect(call3Body.params[0].fromBlock).toBe('0xc8');  // 200
      expect(call3Body.params[0].toBlock).toBe('0xf9');    // 249
    });

    it('should return empty array when no logs found', async () => {
      fetchMock.mockResolvedValueOnce(rpcSuccess([]));
      const client = new FlareRpcClient(TEST_CONFIG);

      const result = await client.getLogs({
        fromBlock: 100,
        toBlock: 200,
      });

      expect(result).toEqual([]);
    });

    it('should pass address and topics filters', async () => {
      fetchMock.mockResolvedValueOnce(rpcSuccess([]));
      const client = new FlareRpcClient(TEST_CONFIG);
      const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

      await client.getLogs({
        address: '0xabcdef1234567890abcdef1234567890abcdef12',
        fromBlock: 1000,
        toBlock: 2000,
        topics: [transferTopic, null],
      });

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.params[0].address).toBe('0xabcdef1234567890abcdef1234567890abcdef12');
      expect(body.params[0].topics).toEqual([transferTopic, null]);
    });

    it('should handle single-block range without chunking', async () => {
      fetchMock.mockResolvedValueOnce(rpcSuccess([]));
      const client = new FlareRpcClient(TEST_CONFIG);

      await client.getLogs({ fromBlock: 500, toBlock: 500 });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.params[0].fromBlock).toBe('0x1f4');
      expect(body.params[0].toBlock).toBe('0x1f4');
    });
  });

  // ---- getTransactionReceiptsBatch ----

  describe('getTransactionReceiptsBatch()', () => {
    it('should return empty array for empty input', async () => {
      const client = new FlareRpcClient(TEST_CONFIG);
      const result = await client.getTransactionReceiptsBatch([]);
      expect(result).toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('should batch receipts and return in order', async () => {
      const receipt1 = makeMockReceipt({
        transactionHash: '0xaaaa000000000000000000000000000000000000000000000000000000000001',
        status: '0x1',
      });
      const receipt2 = makeMockReceipt({
        transactionHash: '0xaaaa000000000000000000000000000000000000000000000000000000000002',
        status: '0x0',
      });

      // We need to capture the IDs dynamically
      fetchMock.mockImplementationOnce(async (_url: string, opts: { body: string }) => {
        const payload = JSON.parse(opts.body);
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () =>
            payload.map((req: { id: number; params: string[] }) => ({
              jsonrpc: '2.0',
              id: req.id,
              result:
                req.params[0] === receipt1.transactionHash ? receipt1 : receipt2,
            })),
        };
      });

      const client = new FlareRpcClient(TEST_CONFIG);
      const result = await client.getTransactionReceiptsBatch([
        receipt1.transactionHash,
        receipt2.transactionHash,
      ]);

      expect(result).toHaveLength(2);
      expect(result[0]!.transactionHash).toBe(receipt1.transactionHash);
      expect(result[1]!.transactionHash).toBe(receipt2.transactionHash);
    });

    it('should handle per-item errors gracefully', async () => {
      fetchMock.mockImplementationOnce(async (_url: string, opts: { body: string }) => {
        const payload = JSON.parse(opts.body);
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => [
            { jsonrpc: '2.0', id: payload[0].id, result: makeMockReceipt() },
            {
              jsonrpc: '2.0',
              id: payload[1].id,
              error: { code: -32000, message: 'execution reverted' },
            },
          ],
        };
      });

      const client = new FlareRpcClient(TEST_CONFIG);
      const result = await client.getTransactionReceiptsBatch([
        '0x1111000000000000000000000000000000000000000000000000000000000001',
        '0x2222000000000000000000000000000000000000000000000000000000000002',
      ]);

      expect(result).toHaveLength(2);
      expect(result[0]).not.toBeNull();
      // Per-item error is returned as null (logged as warning)
      expect(result[1]).toBeNull();
    });

    it('should split into sub-batches of specified size', async () => {
      const hashes = Array.from({ length: 5 }, (_, i) =>
        '0x' + (i + 1).toString().padStart(64, '0'),
      );

      fetchMock.mockImplementation(async (_url: string, opts: { body: string }) => {
        const payload = JSON.parse(opts.body);
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () =>
            payload.map((req: { id: number }) => ({
              jsonrpc: '2.0',
              id: req.id,
              result: makeMockReceipt({ transactionHash: hashes[0] }),
            })),
        };
      });

      const client = new FlareRpcClient(TEST_CONFIG);
      // Use batchSize=2: 5 items -> 3 sub-batches (2, 2, 1)
      await client.getTransactionReceiptsBatch(hashes, 2);

      expect(fetchMock).toHaveBeenCalledTimes(3);

      // Verify first batch has 2 items
      const batch1 = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(batch1).toHaveLength(2);

      // Verify second batch has 2 items
      const batch2 = JSON.parse(fetchMock.mock.calls[1][1].body);
      expect(batch2).toHaveLength(2);

      // Verify third batch has 1 item
      const batch3 = JSON.parse(fetchMock.mock.calls[2][1].body);
      expect(batch3).toHaveLength(1);
    });

    it('should return null for items when HTTP error occurs on sub-batch', async () => {
      fetchMock.mockResolvedValueOnce(httpError(503, 'Service Unavailable'));
      const client = new FlareRpcClient(TEST_CONFIG);

      const result = await client.getTransactionReceiptsBatch([
        '0x1111000000000000000000000000000000000000000000000000000000000001',
        '0x2222000000000000000000000000000000000000000000000000000000000002',
      ]);

      expect(result).toHaveLength(2);
      // HTTP error -> all items in sub-batch are null (Error -> null)
      expect(result[0]).toBeNull();
      expect(result[1]).toBeNull();
    });
  });

  // ---- getBlocksBatch ----

  describe('getBlocksBatch()', () => {
    it('should return empty array for empty input', async () => {
      const client = new FlareRpcClient(TEST_CONFIG);
      const result = await client.getBlocksBatch([]);
      expect(result).toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('should batch fetch blocks and populate timestamp cache', async () => {
      const block1 = makeMockBlock({ number: '0x64', timestamp: '0x65d8a200' });
      const block2 = makeMockBlock({ number: '0xc8', timestamp: '0x65d8a300' });

      fetchMock.mockImplementationOnce(async (_url: string, opts: { body: string }) => {
        const payload = JSON.parse(opts.body);
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => [
            { jsonrpc: '2.0', id: payload[0].id, result: block1 },
            { jsonrpc: '2.0', id: payload[1].id, result: block2 },
          ],
        };
      });

      const client = new FlareRpcClient(TEST_CONFIG);
      const result = await client.getBlocksBatch([100, 200]);

      expect(result).toHaveLength(2);
      expect(result[0]!.number).toBe('0x64');
      expect(result[1]!.number).toBe('0xc8');
    });

    it('should return null for failed block fetches', async () => {
      fetchMock.mockImplementationOnce(async (_url: string, opts: { body: string }) => {
        const payload = JSON.parse(opts.body);
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => [
            { jsonrpc: '2.0', id: payload[0].id, result: makeMockBlock() },
            {
              jsonrpc: '2.0',
              id: payload[1].id,
              error: { code: -32000, message: 'block not found' },
            },
          ],
        };
      });

      const client = new FlareRpcClient(TEST_CONFIG);
      const result = await client.getBlocksBatch([100, 200]);

      expect(result).toHaveLength(2);
      expect(result[0]).not.toBeNull();
      expect(result[1]).toBeNull();
    });
  });

  // ---- getWalletTransactions ----

  describe('getWalletTransactions()', () => {
    it('should combine sender and receiver logs, deduplicate, and fetch receipts', async () => {
      const walletAddress = '0xabcdef1234567890abcdef1234567890abcdef12';
      const txHash = '0xaaaa111122223333444455556666777788889999aaaabbbbccccddddeeeeffff';

      const senderLog = makeMockLog({ transactionHash: txHash });
      const receiverLog = makeMockLog({ transactionHash: txHash }); // Same TX

      const receipt = makeMockReceipt({
        transactionHash: txHash,
        blockNumber: '0x64',
      });
      const block = makeMockBlock({ number: '0x64', timestamp: '0x65d8a200' });

      // Call 1 & 2: getLogs (sender + receiver)
      fetchMock
        .mockResolvedValueOnce(rpcSuccess([senderLog]))   // sender logs
        .mockResolvedValueOnce(rpcSuccess([receiverLog]))  // receiver logs
        // Call 3: batch receipt fetch
        .mockImplementationOnce(async (_url: string, opts: { body: string }) => {
          const payload = JSON.parse(opts.body);
          return {
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () =>
              payload.map((req: { id: number }) => ({
                jsonrpc: '2.0',
                id: req.id,
                result: receipt,
              })),
          };
        })
        // Call 4: batch block fetch (for timestamps)
        .mockImplementationOnce(async (_url: string, opts: { body: string }) => {
          const payload = JSON.parse(opts.body);
          return {
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () =>
              payload.map((req: { id: number }) => ({
                jsonrpc: '2.0',
                id: req.id,
                result: block,
              })),
          };
        });

      const client = new FlareRpcClient(TEST_CONFIG);
      const result = await client.getWalletTransactions(walletAddress, 0, 200);

      // Should deduplicate to 1 TX
      expect(result).toHaveLength(1);
      expect(result[0].txHash).toBe(txHash);
      expect(result[0].blockNumber).toBe(100); // 0x64 = 100
      expect(result[0].blockTimestamp).toBe(parseInt('0x65d8a200', 16));
      expect(result[0].status).toBe('success');
    });

    it('should use cache for block timestamps (no redundant fetch)', async () => {
      const walletAddress = '0xabcdef1234567890abcdef1234567890abcdef12';
      const txHash1 = '0x1111111111111111111111111111111111111111111111111111111111111111';
      const txHash2 = '0x2222222222222222222222222222222222222222222222222222222222222222';

      const log1 = makeMockLog({ transactionHash: txHash1, blockNumber: '0x64' });
      const log2 = makeMockLog({ transactionHash: txHash2, blockNumber: '0x64' }); // Same block

      const receipt1 = makeMockReceipt({ transactionHash: txHash1, blockNumber: '0x64' });
      const receipt2 = makeMockReceipt({ transactionHash: txHash2, blockNumber: '0x64' });
      const block = makeMockBlock({ number: '0x64', timestamp: '0x65d8a200' });

      fetchMock
        .mockResolvedValueOnce(rpcSuccess([log1, log2]))  // sender logs (both TXs)
        .mockResolvedValueOnce(rpcSuccess([]))              // receiver logs (empty)
        // Batch receipt fetch
        .mockImplementationOnce(async (_url: string, opts: { body: string }) => {
          const payload = JSON.parse(opts.body);
          return {
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => [
              { jsonrpc: '2.0', id: payload[0].id, result: receipt1 },
              { jsonrpc: '2.0', id: payload[1].id, result: receipt2 },
            ],
          };
        })
        // Batch block fetch -- should only have 1 unique block
        .mockImplementationOnce(async (_url: string, opts: { body: string }) => {
          const payload = JSON.parse(opts.body);
          // Should only request block 100 ONCE
          expect(payload).toHaveLength(1);
          return {
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => [
              { jsonrpc: '2.0', id: payload[0].id, result: block },
            ],
          };
        });

      const client = new FlareRpcClient(TEST_CONFIG);
      const result = await client.getWalletTransactions(walletAddress, 0, 200);

      expect(result).toHaveLength(2);
      // Both transactions should have the same timestamp from the cached block
      expect(result[0].blockTimestamp).toBe(parseInt('0x65d8a200', 16));
      expect(result[1].blockTimestamp).toBe(parseInt('0x65d8a200', 16));
    });

    it('should handle reverted transaction status', async () => {
      const walletAddress = '0xabcdef1234567890abcdef1234567890abcdef12';
      const txHash = '0xaaaa111122223333444455556666777788889999aaaabbbbccccddddeeeeffff';

      fetchMock
        .mockResolvedValueOnce(rpcSuccess([makeMockLog({ transactionHash: txHash })]))
        .mockResolvedValueOnce(rpcSuccess([]))
        .mockImplementationOnce(async (_url: string, opts: { body: string }) => {
          const payload = JSON.parse(opts.body);
          return {
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () =>
              payload.map((req: { id: number }) => ({
                jsonrpc: '2.0',
                id: req.id,
                result: makeMockReceipt({ status: '0x0', blockNumber: '0x64' }),
              })),
          };
        })
        .mockImplementationOnce(async (_url: string, opts: { body: string }) => {
          const payload = JSON.parse(opts.body);
          return {
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () =>
              payload.map((req: { id: number }) => ({
                jsonrpc: '2.0',
                id: req.id,
                result: makeMockBlock({ number: '0x64' }),
              })),
          };
        });

      const client = new FlareRpcClient(TEST_CONFIG);
      const result = await client.getWalletTransactions(walletAddress, 0, 200);

      expect(result[0].status).toBe('reverted');
    });

    it('should sort transactions by block number', async () => {
      const walletAddress = '0xabcdef1234567890abcdef1234567890abcdef12';
      const txHash1 = '0x1111111111111111111111111111111111111111111111111111111111111111';
      const txHash2 = '0x2222222222222222222222222222222222222222222222222222222222222222';

      fetchMock
        .mockResolvedValueOnce(
          rpcSuccess([
            makeMockLog({ transactionHash: txHash2, blockNumber: '0xc8' }), // block 200
            makeMockLog({ transactionHash: txHash1, blockNumber: '0x64' }), // block 100
          ]),
        )
        .mockResolvedValueOnce(rpcSuccess([]))
        .mockImplementationOnce(async (_url: string, opts: { body: string }) => {
          const payload = JSON.parse(opts.body);
          return {
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () =>
              payload.map((req: { id: number; params: string[] }) => ({
                jsonrpc: '2.0',
                id: req.id,
                result:
                  req.params[0] === txHash1
                    ? makeMockReceipt({ transactionHash: txHash1, blockNumber: '0x64' })
                    : makeMockReceipt({ transactionHash: txHash2, blockNumber: '0xc8' }),
              })),
          };
        })
        .mockImplementationOnce(async (_url: string, opts: { body: string }) => {
          const payload = JSON.parse(opts.body);
          return {
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () =>
              payload.map((req: { id: number; params: unknown[] }) => {
                const blockHex = req.params[0] as string;
                return {
                  jsonrpc: '2.0',
                  id: req.id,
                  result: makeMockBlock({
                    number: blockHex,
                    timestamp: blockHex === '0x64' ? '0x1000' : '0x2000',
                  }),
                };
              }),
          };
        });

      const client = new FlareRpcClient(TEST_CONFIG);
      const result = await client.getWalletTransactions(walletAddress, 0, 300);

      expect(result).toHaveLength(2);
      expect(result[0].blockNumber).toBe(100);
      expect(result[1].blockNumber).toBe(200);
    });

    it('should return empty array when no logs are found', async () => {
      fetchMock
        .mockResolvedValueOnce(rpcSuccess([]))   // sender logs empty
        .mockResolvedValueOnce(rpcSuccess([]));   // receiver logs empty

      const client = new FlareRpcClient(TEST_CONFIG);
      const result = await client.getWalletTransactions(
        '0xabcdef1234567890abcdef1234567890abcdef12',
        0,
        100,
      );

      expect(result).toEqual([]);
      // Should not have called batch receipts or blocks (no TX hashes)
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('should lowercase wallet address for topic padding', async () => {
      const mixedCaseAddress = '0xAbCdEf1234567890AbCdEf1234567890AbCdEf12';
      const expectedPadded =
        '0x000000000000000000000000abcdef1234567890abcdef1234567890abcdef12';

      fetchMock
        .mockResolvedValueOnce(rpcSuccess([]))
        .mockResolvedValueOnce(rpcSuccess([]));

      const client = new FlareRpcClient(TEST_CONFIG);
      await client.getWalletTransactions(mixedCaseAddress, 0, 100);

      // Verify the padded address was used in topics
      const call1Body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(call1Body.params[0].topics[1]).toBe(expectedPadded);

      const call2Body = JSON.parse(fetchMock.mock.calls[1][1].body);
      expect(call2Body.params[0].topics[2]).toBe(expectedPadded);
    });
  });

  // ---- verifyConnection ----

  describe('verifyConnection()', () => {
    it('should return connected=true with chain ID and block number on success', async () => {
      fetchMock
        .mockResolvedValueOnce(rpcSuccess('0xe'))       // chainId = 14
        .mockResolvedValueOnce(rpcSuccess('0x1c9c380')); // blockNumber = 30_000_000

      const client = new FlareRpcClient(TEST_CONFIG);
      const result = await client.verifyConnection();

      expect(result.connected).toBe(true);
      expect(result.chainId).toBe(14);
      expect(result.blockNumber).toBe(30_000_000);
    });

    it('should return connected=false on RPC failure', async () => {
      vi.useFakeTimers();
      fetchMock.mockRejectedValue(new Error('Network error'));

      const client = new FlareRpcClient(TEST_CONFIG);
      const promise = client.verifyConnection();

      // Advance through retry delays for both getChainId and getBlockNumber (parallel)
      // Each retries up to 3 times with delays: 1s, 2s, 4s
      for (let i = 0; i < 10; i++) {
        await vi.advanceTimersByTimeAsync(5_000);
      }

      const result = await promise;
      expect(result.connected).toBe(false);
      expect(result.chainId).toBe(0);
      expect(result.blockNumber).toBe(0);
    });

    it('should return connected=false on JSON-RPC error', async () => {
      vi.useFakeTimers();
      fetchMock.mockResolvedValue(
        rpcError(-32601, 'Method not found'),
      );

      const client = new FlareRpcClient(TEST_CONFIG);
      const promise = client.verifyConnection();

      for (let i = 0; i < 10; i++) {
        await vi.advanceTimersByTimeAsync(5_000);
      }

      const result = await promise;
      expect(result.connected).toBe(false);
      expect(result.chainId).toBe(0);
      expect(result.blockNumber).toBe(0);
    });
  });

  // ---- Retry Behavior ----

  describe('retry behavior', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it('should retry on failure and eventually succeed', async () => {
      // Fail twice, succeed on third attempt
      fetchMock
        .mockRejectedValueOnce(new Error('Connection refused'))
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockResolvedValueOnce(rpcSuccess('0x100'));

      const client = new FlareRpcClient(TEST_CONFIG);
      const promise = client.getBlockNumber();

      // Advance through retry delays: 1s after first fail, 2s after second fail
      await vi.advanceTimersByTimeAsync(1_000);
      await vi.advanceTimersByTimeAsync(2_000);

      const result = await promise;
      expect(result).toBe(256);
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('should throw after exhausting all retries', async () => {
      fetchMock.mockImplementation(async () => {
        throw new Error('Persistent failure');
      });

      const client = new FlareRpcClient(TEST_CONFIG);
      let caughtError: Error | null = null;

      const promise = client.getBlockNumber().catch((err: Error) => {
        caughtError = err;
      });

      // Advance through all retry delays: 1s + 2s + 4s
      await vi.advanceTimersByTimeAsync(1_000);
      await vi.advanceTimersByTimeAsync(2_000);
      await vi.advanceTimersByTimeAsync(4_000);
      await promise;

      // 1 initial + 3 retries = 4 total attempts
      expect(fetchMock).toHaveBeenCalledTimes(4);
      expect(caughtError).not.toBeNull();
      expect(caughtError!.message).toBe('Persistent failure');
    });

    it('should throw on HTTP error after retries', async () => {
      fetchMock.mockImplementation(async () => httpError(502, 'Bad Gateway'));

      const client = new FlareRpcClient(TEST_CONFIG);
      let caughtError: Error | null = null;

      const promise = client.getBlockNumber().catch((err: Error) => {
        caughtError = err;
      });

      // Advance through all retry delays
      await vi.advanceTimersByTimeAsync(1_000);
      await vi.advanceTimersByTimeAsync(2_000);
      await vi.advanceTimersByTimeAsync(4_000);
      await promise;

      expect(fetchMock).toHaveBeenCalledTimes(4);
      expect(caughtError).not.toBeNull();
      expect(caughtError!.message).toBe('RPC HTTP error: 502 Bad Gateway');
    });
  });

  // ---- Block Timestamp Cache ----

  describe('block timestamp cache', () => {
    it('should skip block fetch for already-cached timestamps', async () => {
      const walletAddress = '0xabcdef1234567890abcdef1234567890abcdef12';
      const txHash = '0xaaaa111122223333444455556666777788889999aaaabbbbccccddddeeeeffff';
      // First call: populate cache
      fetchMock
        .mockResolvedValueOnce(rpcSuccess([makeMockLog({ transactionHash: txHash, blockNumber: '0x64' })]))
        .mockResolvedValueOnce(rpcSuccess([]))
        .mockImplementationOnce(async (_url: string, opts: { body: string }) => {
          const payload = JSON.parse(opts.body);
          return {
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () =>
              payload.map((req: { id: number }) => ({
                jsonrpc: '2.0',
                id: req.id,
                result: makeMockReceipt({ transactionHash: txHash, blockNumber: '0x64' }),
              })),
          };
        })
        .mockImplementationOnce(async (_url: string, opts: { body: string }) => {
          const payload = JSON.parse(opts.body);
          return {
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () =>
              payload.map((req: { id: number }) => ({
                jsonrpc: '2.0',
                id: req.id,
                result: makeMockBlock({ number: '0x64', timestamp: '0x65d8a200' }),
              })),
          };
        });

      const client = new FlareRpcClient(TEST_CONFIG);
      await client.getWalletTransactions(walletAddress, 0, 200);

      const firstCallCount = fetchMock.mock.calls.length;

      // Second call: same block should be cached
      fetchMock
        .mockResolvedValueOnce(rpcSuccess([makeMockLog({ transactionHash: txHash, blockNumber: '0x64' })]))
        .mockResolvedValueOnce(rpcSuccess([]))
        .mockImplementationOnce(async (_url: string, opts: { body: string }) => {
          const payload = JSON.parse(opts.body);
          return {
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () =>
              payload.map((req: { id: number }) => ({
                jsonrpc: '2.0',
                id: req.id,
                result: makeMockReceipt({ transactionHash: txHash, blockNumber: '0x64' }),
              })),
          };
        });
      // No block fetch should happen (cached!)

      const result = await client.getWalletTransactions(walletAddress, 0, 200);

      // Should only have made 3 additional calls (2x getLogs + 1x batch receipts), NO block fetch
      const secondCallCount = fetchMock.mock.calls.length - firstCallCount;
      expect(secondCallCount).toBe(3); // getLogs x2 + getTransactionReceiptsBatch x1

      expect(result[0].blockTimestamp).toBe(parseInt('0x65d8a200', 16));
    });
  });

  // ---- getChainId ----

  describe('getChainId()', () => {
    it('should return parsed chain ID', async () => {
      fetchMock.mockResolvedValueOnce(rpcSuccess('0xe'));
      const client = new FlareRpcClient(TEST_CONFIG);

      const chainId = await client.getChainId();
      expect(chainId).toBe(14);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.method).toBe('eth_chainId');
    });
  });
});
