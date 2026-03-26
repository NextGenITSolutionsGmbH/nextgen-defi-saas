// ---------------------------------------------------------------------------
// Central queue module — re-exports queue instances, workers, and helpers
// ---------------------------------------------------------------------------

// Queue connection singletons
export {
  getWalletSyncQueue,
  getExportQueue,
  getPriceFetchQueue,
} from "./connection";

// Workers (import to start processing)
export { walletSyncWorker } from "./workers/wallet-sync.worker";
export { exportGenWorker } from "./workers/export-gen.worker";
export { priceFetchWorker } from "./workers/price-fetch.worker";

// Re-export shared types and constants for convenience
export {
  WALLET_SYNC_QUEUE,
  EXPORT_QUEUE,
  PRICE_FETCH_QUEUE,
  type WalletSyncJobData,
  type ExportJobData,
  type PriceFetchJobData,
} from "@defi-tracker/shared/queue";

// ---------------------------------------------------------------------------
// Helper functions — called from tRPC routers to enqueue jobs
// ---------------------------------------------------------------------------

import { getWalletSyncQueue, getExportQueue, getPriceFetchQueue } from "./connection";
import type {
  WalletSyncJobData,
  ExportJobData,
  PriceFetchJobData,
} from "@defi-tracker/shared/queue";

/**
 * Enqueue a wallet sync job.
 * Called from the wallet.sync tRPC mutation.
 */
export async function addWalletSyncJob(
  walletId: string,
  chainId: number,
  fromBlock?: number,
): Promise<string> {
  const queue = getWalletSyncQueue();
  const job = await queue.add(
    "sync-wallet",
    { walletId, chainId, fromBlock } satisfies WalletSyncJobData,
    {
      jobId: `wallet-sync-${walletId}-${Date.now()}`,
    },
  );
  return job.id ?? "";
}

/**
 * Enqueue an export generation job.
 * Called from the export.create tRPC mutation.
 */
export async function addExportJob(
  exportId: string,
  userId: string,
  taxYear: number,
  method: "FIFO" | "LIFO",
  format: "CSV" | "XLSX" | "PDF",
): Promise<string> {
  const queue = getExportQueue();
  const job = await queue.add(
    "generate-export",
    { exportId, userId, taxYear, method, format } satisfies ExportJobData,
    {
      jobId: `export-${exportId}`,
    },
  );
  return job.id ?? "";
}

/**
 * Enqueue a price fetch job.
 * Called when a transaction needs a EUR price for a specific token at a point in time.
 */
export async function addPriceFetchJob(
  tokenSymbol: string,
  tokenAddress: string,
  chainId: number,
  timestampUnix: number,
): Promise<string> {
  const queue = getPriceFetchQueue();
  const job = await queue.add(
    "fetch-price",
    { tokenSymbol, tokenAddress, chainId, timestampUnix } satisfies PriceFetchJobData,
    {
      jobId: `price-${tokenSymbol}-${chainId}-${timestampUnix}`,
    },
  );
  return job.id ?? "";
}
