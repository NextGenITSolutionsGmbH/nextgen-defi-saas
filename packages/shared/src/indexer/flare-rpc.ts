/**
 * Flare Network RPC Client
 * Connects to Flare mainnet (chain ID 14) via JSON-RPC
 * Fetches transactions, event logs, and block data
 */

export interface FlareRpcConfig {
  rpcUrl: string;
  chainId: number;
  maxBlockRange: number;
  requestTimeoutMs: number;
}

export const FLARE_MAINNET_CONFIG: FlareRpcConfig = {
  rpcUrl: 'https://flare-api.flare.network/ext/C/rpc',
  chainId: 14,
  maxBlockRange: 2048,
  requestTimeoutMs: 30_000,
};

export const FLARE_TESTNET_CONFIG: FlareRpcConfig = {
  rpcUrl: 'https://coston2-api.flare.network/ext/C/rpc',
  chainId: 114,
  maxBlockRange: 2048,
  requestTimeoutMs: 30_000,
};

export interface RpcBlock {
  number: string;       // hex
  timestamp: string;    // hex
  hash: string;
  transactions: string[];
}

export interface RpcTransactionReceipt {
  transactionHash: string;
  blockNumber: string;
  blockHash: string;
  from: string;
  to: string | null;
  status: string;
  gasUsed: string;
  logs: RpcLog[];
}

export interface RpcLog {
  address: string;
  topics: string[];
  data: string;
  blockNumber: string;
  transactionHash: string;
  logIndex: string;
  blockHash: string;
  removed: boolean;
}

export interface DecodedTransaction {
  txHash: string;
  blockNumber: number;
  blockTimestamp: number;
  from: string;
  to: string | null;
  logs: RpcLog[];
  status: 'success' | 'reverted';
}

let rpcRequestId = 0;

/** Default batch size for JSON-RPC batch requests */
const DEFAULT_BATCH_SIZE = 20;

/** Retry configuration */
const RETRY_COUNT = 3;
const RETRY_BASE_DELAY_MS = 1_000;

async function rpcCall(
  rpcUrl: string,
  method: string,
  params: unknown[],
  timeoutMs: number = 30_000,
): Promise<unknown> {
  rpcRequestId += 1;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: rpcRequestId,
        method,
        params,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`RPC HTTP error: ${response.status} ${response.statusText}`);
    }

    const json = (await response.json()) as { result?: unknown; error?: { code: number; message: string } };

    if (json.error) {
      throw new Error(`RPC error: ${json.error.code} — ${json.error.message}`);
    }

    return json.result;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Retry wrapper for rpcCall with exponential backoff.
 * Retries up to RETRY_COUNT times with delays of 1s, 2s, 4s.
 */
async function rpcCallWithRetry(
  rpcUrl: string,
  method: string,
  params: unknown[],
  timeoutMs: number = 30_000,
): Promise<unknown> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= RETRY_COUNT; attempt++) {
    try {
      return await rpcCall(rpcUrl, method, params, timeoutMs);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < RETRY_COUNT) {
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Send a JSON-RPC batch request (multiple calls in a single HTTP POST).
 * Processes items in sub-batches of `batchSize` to respect RPC server limits.
 * Returns results in the same order as the input, with per-item error handling.
 */
async function rpcBatchCall(
  rpcUrl: string,
  calls: { method: string; params: unknown[] }[],
  timeoutMs: number = 30_000,
  batchSize: number = DEFAULT_BATCH_SIZE,
): Promise<(unknown | Error)[]> {
  if (calls.length === 0) return [];

  const allResults: (unknown | Error)[] = new Array(calls.length);

  // Process in sub-batches
  for (let offset = 0; offset < calls.length; offset += batchSize) {
    const batch = calls.slice(offset, offset + batchSize);
    const startId = rpcRequestId + 1;
    const batchPayload = batch.map((call, index) => {
      rpcRequestId += 1;
      return {
        jsonrpc: '2.0' as const,
        id: startId + index,
        method: call.method,
        params: call.params,
      };
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batchPayload),
        signal: controller.signal,
      });

      if (!response.ok) {
        // Mark all items in this sub-batch as errors
        const err = new Error(`RPC batch HTTP error: ${response.status} ${response.statusText}`);
        for (let i = 0; i < batch.length; i++) {
          allResults[offset + i] = err;
        }
        continue;
      }

      const jsonArray = (await response.json()) as Array<{
        id: number;
        result?: unknown;
        error?: { code: number; message: string };
      }>;

      // Build a map from id to response for order-safe assignment
      const responseMap = new Map<number, (typeof jsonArray)[0]>();
      for (const item of jsonArray) {
        responseMap.set(item.id, item);
      }

      for (let i = 0; i < batch.length; i++) {
        const expectedId = startId + i;
        const item = responseMap.get(expectedId);
        if (!item) {
          allResults[offset + i] = new Error(`Missing response for batch item id=${expectedId}`);
        } else if (item.error) {
          allResults[offset + i] = new Error(`RPC error: ${item.error.code} — ${item.error.message}`);
        } else {
          allResults[offset + i] = item.result ?? null;
        }
      }
    } catch (error) {
      // Network / abort error — mark all items in this sub-batch
      const err = error instanceof Error ? error : new Error(String(error));
      for (let i = 0; i < batch.length; i++) {
        allResults[offset + i] = err;
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  return allResults;
}

export class FlareRpcClient {
  private config: FlareRpcConfig;

  /** Cache of block number → Unix timestamp, shared across chunks */
  private blockTimestampCache = new Map<number, number>();

  constructor(config: FlareRpcConfig = FLARE_MAINNET_CONFIG) {
    this.config = config;
  }

  /** Get the latest block number */
  async getBlockNumber(): Promise<number> {
    const result = (await rpcCallWithRetry(
      this.config.rpcUrl,
      'eth_blockNumber',
      [],
      this.config.requestTimeoutMs,
    )) as string;
    return parseInt(result, 16);
  }

  /** Get block by number */
  async getBlock(blockNumber: number): Promise<RpcBlock> {
    const hex = '0x' + blockNumber.toString(16);
    const result = await rpcCallWithRetry(
      this.config.rpcUrl,
      'eth_getBlockByNumber',
      [hex, false],
      this.config.requestTimeoutMs,
    );
    return result as RpcBlock;
  }

  /** Get transaction receipt */
  async getTransactionReceipt(txHash: string): Promise<RpcTransactionReceipt | null> {
    const result = await rpcCallWithRetry(
      this.config.rpcUrl,
      'eth_getTransactionReceipt',
      [txHash],
      this.config.requestTimeoutMs,
    );
    return result as RpcTransactionReceipt | null;
  }

  /**
   * Batch-fetch transaction receipts using JSON-RPC batch requests.
   * Processes hashes in batches of `batchSize` (default 20).
   * Returns results in the same order as the input hashes.
   */
  async getTransactionReceiptsBatch(
    txHashes: string[],
    batchSize: number = DEFAULT_BATCH_SIZE,
  ): Promise<(RpcTransactionReceipt | null)[]> {
    if (txHashes.length === 0) return [];

    const calls = txHashes.map((hash) => ({
      method: 'eth_getTransactionReceipt',
      params: [hash] as unknown[],
    }));

    const results = await rpcBatchCall(
      this.config.rpcUrl,
      calls,
      this.config.requestTimeoutMs,
      batchSize,
    );

    return results.map((result, index) => {
      if (result instanceof Error) {
        console.warn(`[FlareRPC] Failed to fetch receipt for ${txHashes[index]}: ${result.message}`);
        return null;
      }
      return result as RpcTransactionReceipt | null;
    });
  }

  /**
   * Batch-fetch blocks by number using JSON-RPC batch requests.
   * Processes block numbers in batches of `batchSize` (default 20).
   * Populates the block timestamp cache with fetched results.
   */
  async getBlocksBatch(
    blockNumbers: number[],
    batchSize: number = DEFAULT_BATCH_SIZE,
  ): Promise<(RpcBlock | null)[]> {
    if (blockNumbers.length === 0) return [];

    const calls = blockNumbers.map((bn) => ({
      method: 'eth_getBlockByNumber',
      params: ['0x' + bn.toString(16), false] as unknown[],
    }));

    const results = await rpcBatchCall(
      this.config.rpcUrl,
      calls,
      this.config.requestTimeoutMs,
      batchSize,
    );

    return results.map((result, index) => {
      if (result instanceof Error) {
        console.warn(`[FlareRPC] Failed to fetch block ${blockNumbers[index]}: ${result.message}`);
        return null;
      }
      const block = result as RpcBlock | null;
      // Populate the timestamp cache
      if (block) {
        const bn = parseInt(block.number, 16);
        const ts = parseInt(block.timestamp, 16);
        this.blockTimestampCache.set(bn, ts);
      }
      return block;
    });
  }

  /**
   * Get event logs for an address within a block range
   * This is the primary method for indexing wallet transactions
   */
  async getLogs(params: {
    address?: string;
    fromBlock: number;
    toBlock: number;
    topics?: (string | string[] | null)[];
  }): Promise<RpcLog[]> {
    const { fromBlock, toBlock, address, topics } = params;

    // Chunk into max block range to avoid RPC limits
    const allLogs: RpcLog[] = [];
    let currentFrom = fromBlock;

    while (currentFrom <= toBlock) {
      const currentTo = Math.min(currentFrom + this.config.maxBlockRange - 1, toBlock);

      const filter: Record<string, unknown> = {
        fromBlock: '0x' + currentFrom.toString(16),
        toBlock: '0x' + currentTo.toString(16),
      };

      if (address) filter.address = address;
      if (topics) filter.topics = topics;

      const logs = (await rpcCallWithRetry(
        this.config.rpcUrl,
        'eth_getLogs',
        [filter],
        this.config.requestTimeoutMs,
      )) as RpcLog[];

      allLogs.push(...logs);
      currentFrom = currentTo + 1;
    }

    return allLogs;
  }

  /**
   * Fetch all transactions involving a wallet address in a block range.
   * Uses batched RPC calls and a block timestamp cache for performance.
   */
  async getWalletTransactions(
    walletAddress: string,
    fromBlock: number,
    toBlock: number,
  ): Promise<DecodedTransaction[]> {
    const address = walletAddress.toLowerCase();

    // Pad address to 32 bytes for topic filtering
    const paddedAddress = '0x' + address.slice(2).padStart(64, '0');

    // ERC20 Transfer topic: Transfer(address,address,uint256)
    const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

    // Fetch logs where wallet is sender (topic[1]) or receiver (topic[2])
    const [senderLogs, receiverLogs] = await Promise.all([
      this.getLogs({
        fromBlock,
        toBlock,
        topics: [transferTopic, paddedAddress, null],
      }),
      this.getLogs({
        fromBlock,
        toBlock,
        topics: [transferTopic, null, paddedAddress],
      }),
    ]);

    // Collect unique TX hashes
    const txHashSet = new Set<string>();
    for (const log of [...senderLogs, ...receiverLogs]) {
      txHashSet.add(log.transactionHash);
    }

    // Batch-fetch full receipts for each unique transaction
    const txHashes = Array.from(txHashSet);
    const receipts = await this.getTransactionReceiptsBatch(txHashes);

    // Collect block numbers that are NOT already cached
    const blockNumbers = new Set<number>();
    for (const receipt of receipts) {
      if (receipt) {
        const bn = parseInt(receipt.blockNumber, 16);
        if (!this.blockTimestampCache.has(bn)) {
          blockNumbers.add(bn);
        }
      }
    }

    // Batch-fetch only uncached block timestamps
    if (blockNumbers.size > 0) {
      await this.getBlocksBatch(Array.from(blockNumbers));
    }

    // Build decoded transactions using the cache
    const transactions: DecodedTransaction[] = [];
    for (const receipt of receipts) {
      if (!receipt) continue;

      const blockNum = parseInt(receipt.blockNumber, 16);
      const timestamp = this.blockTimestampCache.get(blockNum) ?? 0;

      transactions.push({
        txHash: receipt.transactionHash,
        blockNumber: blockNum,
        blockTimestamp: timestamp,
        from: receipt.from,
        to: receipt.to,
        logs: receipt.logs,
        status: receipt.status === '0x1' ? 'success' : 'reverted',
      });
    }

    // Sort by block number
    transactions.sort((a, b) => a.blockNumber - b.blockNumber);

    return transactions;
  }

  /**
   * Get the current chain ID to verify connection
   */
  async getChainId(): Promise<number> {
    const result = (await rpcCallWithRetry(
      this.config.rpcUrl,
      'eth_chainId',
      [],
      this.config.requestTimeoutMs,
    )) as string;
    return parseInt(result, 16);
  }

  /**
   * Verify the RPC connection is working and on the right chain
   */
  async verifyConnection(): Promise<{ connected: boolean; chainId: number; blockNumber: number }> {
    try {
      const [chainId, blockNumber] = await Promise.all([
        this.getChainId(),
        this.getBlockNumber(),
      ]);

      return {
        connected: true,
        chainId,
        blockNumber,
      };
    } catch {
      return {
        connected: false,
        chainId: 0,
        blockNumber: 0,
      };
    }
  }
}
