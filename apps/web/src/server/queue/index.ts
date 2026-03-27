// ---------------------------------------------------------------------------
// Central queue module — re-exports queue instances, workers, and helpers
// ---------------------------------------------------------------------------

// Queue connection singletons
export {
  getWalletSyncQueue,
  getExportQueue,
  getPriceFetchQueue,
  getEmailQueue,
} from "./connection";

// Workers are NOT re-exported here to avoid eager Redis connections at import
// time. Start workers via a dedicated entry point (e.g. worker process) by
// importing directly from ./workers/*.worker.ts.

// Re-export shared types and constants for convenience
export {
  WALLET_SYNC_QUEUE,
  EXPORT_QUEUE,
  PRICE_FETCH_QUEUE,
  EMAIL_QUEUE,
  type WalletSyncJobData,
  type ExportJobData,
  type PriceFetchJobData,
  type EmailJobData,
} from "@defi-tracker/shared/queue";

// ---------------------------------------------------------------------------
// Helper functions — called from tRPC routers to enqueue jobs
// ---------------------------------------------------------------------------

import { getWalletSyncQueue, getExportQueue, getPriceFetchQueue, getEmailQueue } from "./connection";
import type {
  WalletSyncJobData,
  ExportJobData,
  PriceFetchJobData,
  EmailJobData,
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

/**
 * Enqueue an email notification job.
 * Called from tRPC routers or other workers when an email needs to be sent.
 */
export async function addEmailJob(
  to: string,
  subject: string,
  html: string,
  userId: string,
  notificationType: EmailJobData["notificationType"],
): Promise<string> {
  const queue = getEmailQueue();
  const job = await queue.add(
    "send-email",
    { to, subject, html, userId, notificationType } satisfies EmailJobData,
    {
      jobId: `email-${notificationType}-${userId}-${Date.now()}`,
    },
  );
  return job.id ?? "";
}
