/**
 * Wallet Synchronization Service
 * Fetches all transactions for a wallet from the Flare blockchain
 * and stores them in the database with decoded event data
 */

import { FlareRpcClient, type FlareRpcConfig, type DecodedTransaction } from './flare-rpc';
import { decodeTransactionLogs, type DecodedEvent } from './event-decoder';

export interface SyncProgress {
  walletAddress: string;
  currentBlock: number;
  targetBlock: number;
  processedTxCount: number;
  percentage: number;
  estimatedSecondsRemaining: number;
}

export interface SyncResult {
  walletAddress: string;
  fromBlock: number;
  toBlock: number;
  transactionsFound: number;
  eventsDecoded: number;
  errors: string[];
  durationMs: number;
}

export interface ProcessedTransaction {
  txHash: string;
  blockNumber: number;
  blockTimestamp: number;
  protocol: string | null;
  events: DecodedEvent[];
  rawData: {
    from: string;
    to: string | null;
    status: string;
    logCount: number;
  };
}

/**
 * Synchronize a wallet's transaction history from the Flare blockchain
 */
export class WalletSyncService {
  private rpc: FlareRpcClient;
  private onProgress?: (progress: SyncProgress) => void;

  constructor(config?: FlareRpcConfig, onProgress?: (progress: SyncProgress) => void) {
    this.rpc = new FlareRpcClient(config);
    this.onProgress = onProgress;
  }

  /**
   * Full sync: fetch all transactions from fromBlock to latest block
   */
  async syncWallet(
    walletAddress: string,
    fromBlock: number = 0,
    toBlock?: number,
  ): Promise<SyncResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let totalTxFound = 0;
    let totalEventsDecoded = 0;

    const latestBlock = toBlock ?? (await this.rpc.getBlockNumber());
    const address = walletAddress.toLowerCase();

    console.log(
      `[WalletSync] Starting sync for ${address} from block ${fromBlock} to ${latestBlock}`,
    );

    // Process in chunks to manage memory and provide progress
    const CHUNK_SIZE = 10_000;
    let currentFrom = fromBlock;
    const allTransactions: ProcessedTransaction[] = [];

    while (currentFrom <= latestBlock) {
      const currentTo = Math.min(currentFrom + CHUNK_SIZE - 1, latestBlock);

      try {
        const transactions = await this.rpc.getWalletTransactions(
          address,
          currentFrom,
          currentTo,
        );

        for (const tx of transactions) {
          const processed = this.processTransaction(tx);
          allTransactions.push(processed);
          totalTxFound++;
          totalEventsDecoded += processed.events.length;
        }

        // Report progress
        if (this.onProgress) {
          const percentage = ((currentTo - fromBlock) / (latestBlock - fromBlock)) * 100;
          const elapsedMs = Date.now() - startTime;
          const remainingBlocks = latestBlock - currentTo;
          const blocksPerMs = (currentTo - fromBlock) / Math.max(elapsedMs, 1);
          const estimatedSecondsRemaining = remainingBlocks / blocksPerMs / 1000;

          this.onProgress({
            walletAddress: address,
            currentBlock: currentTo,
            targetBlock: latestBlock,
            processedTxCount: totalTxFound,
            percentage: Math.min(percentage, 100),
            estimatedSecondsRemaining: Math.max(estimatedSecondsRemaining, 0),
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`Block range ${currentFrom}-${currentTo}: ${message}`);
        console.error(`[WalletSync] Error in block range ${currentFrom}-${currentTo}: ${message}`);
      }

      currentFrom = currentTo + 1;
    }

    const durationMs = Date.now() - startTime;

    console.log(
      `[WalletSync] Completed sync for ${address}: ${totalTxFound} TX, ${totalEventsDecoded} events in ${durationMs}ms`,
    );

    return {
      walletAddress: address,
      fromBlock,
      toBlock: latestBlock,
      transactionsFound: totalTxFound,
      eventsDecoded: totalEventsDecoded,
      errors,
      durationMs,
    };
  }

  /**
   * Delta sync: only fetch transactions since the last sync block
   */
  async deltaSyncWallet(
    walletAddress: string,
    lastSyncBlock: number,
  ): Promise<SyncResult> {
    // Start from the next block after last sync
    return this.syncWallet(walletAddress, lastSyncBlock + 1);
  }

  /**
   * Process a single decoded transaction into our internal format
   */
  private processTransaction(tx: DecodedTransaction): ProcessedTransaction {
    const events = decodeTransactionLogs(tx.logs, tx.blockTimestamp);

    // Determine protocol from events
    let protocol: string | null = null;
    for (const event of events) {
      if (event.protocol) {
        protocol = event.protocol;
        break;
      }
    }

    return {
      txHash: tx.txHash,
      blockNumber: tx.blockNumber,
      blockTimestamp: tx.blockTimestamp,
      protocol,
      events,
      rawData: {
        from: tx.from,
        to: tx.to,
        status: tx.status,
        logCount: tx.logs.length,
      },
    };
  }

  /**
   * Verify the RPC connection is healthy
   */
  async healthCheck(): Promise<{ healthy: boolean; chainId: number; latestBlock: number }> {
    const result = await this.rpc.verifyConnection();
    return {
      healthy: result.connected,
      chainId: result.chainId,
      latestBlock: result.blockNumber,
    };
  }
}

/**
 * Create a configured WalletSyncService for Flare mainnet
 */
export function createFlareSyncService(
  onProgress?: (progress: SyncProgress) => void,
): WalletSyncService {
  return new WalletSyncService(undefined, onProgress);
}
