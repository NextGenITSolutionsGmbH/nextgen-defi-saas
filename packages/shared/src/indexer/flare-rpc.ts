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

export class FlareRpcClient {
  private config: FlareRpcConfig;

  constructor(config: FlareRpcConfig = FLARE_MAINNET_CONFIG) {
    this.config = config;
  }

  /** Get the latest block number */
  async getBlockNumber(): Promise<number> {
    const result = (await rpcCall(
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
    const result = await rpcCall(
      this.config.rpcUrl,
      'eth_getBlockByNumber',
      [hex, false],
      this.config.requestTimeoutMs,
    );
    return result as RpcBlock;
  }

  /** Get transaction receipt */
  async getTransactionReceipt(txHash: string): Promise<RpcTransactionReceipt | null> {
    const result = await rpcCall(
      this.config.rpcUrl,
      'eth_getTransactionReceipt',
      [txHash],
      this.config.requestTimeoutMs,
    );
    return result as RpcTransactionReceipt | null;
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

      const logs = (await rpcCall(
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
   * Fetch all transactions involving a wallet address in a block range
   * Uses eth_getLogs to find Transfer events and other relevant events
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

    // Fetch full receipts for each unique transaction
    const txHashes = Array.from(txHashSet);
    const receipts = await Promise.all(
      txHashes.map((hash) => this.getTransactionReceipt(hash)),
    );

    // Fetch block timestamps
    const blockNumbers = new Set<number>();
    for (const receipt of receipts) {
      if (receipt) {
        blockNumbers.add(parseInt(receipt.blockNumber, 16));
      }
    }

    const blockTimestamps = new Map<number, number>();
    const blocks = await Promise.all(
      Array.from(blockNumbers).map((bn) => this.getBlock(bn)),
    );
    for (const block of blocks) {
      if (block) {
        blockTimestamps.set(parseInt(block.number, 16), parseInt(block.timestamp, 16));
      }
    }

    // Build decoded transactions
    const transactions: DecodedTransaction[] = [];
    for (const receipt of receipts) {
      if (!receipt) continue;

      const blockNum = parseInt(receipt.blockNumber, 16);
      const timestamp = blockTimestamps.get(blockNum) ?? 0;

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
    const result = (await rpcCall(
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
