// ---------------------------------------------------------------------------
// Server-side BullMQ Queue instances (lazy-initialised singletons)
// ---------------------------------------------------------------------------
import { Queue } from "bullmq";
import {
  createRedisConnection,
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
// Lazy singleton holders
// ---------------------------------------------------------------------------

let _walletSyncQueue: Queue<WalletSyncJobData> | null = null;
let _exportQueue: Queue<ExportJobData> | null = null;
let _priceFetchQueue: Queue<PriceFetchJobData> | null = null;
let _emailQueue: Queue<EmailJobData> | null = null;

// ---------------------------------------------------------------------------
// Accessor functions — create the queue on first access
// ---------------------------------------------------------------------------

/** Returns the singleton wallet-sync BullMQ Queue instance. */
export function getWalletSyncQueue(): Queue<WalletSyncJobData> {
  if (!_walletSyncQueue) {
    _walletSyncQueue = new Queue<WalletSyncJobData>(WALLET_SYNC_QUEUE, {
      connection: createRedisConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5_000 },
        removeOnComplete: { count: 1_000 },
        removeOnFail: { count: 5_000 },
      },
    });
  }
  return _walletSyncQueue;
}

/** Returns the singleton export-gen BullMQ Queue instance. */
export function getExportQueue(): Queue<ExportJobData> {
  if (!_exportQueue) {
    _exportQueue = new Queue<ExportJobData>(EXPORT_QUEUE, {
      connection: createRedisConnection(),
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: "exponential", delay: 10_000 },
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 2_000 },
      },
    });
  }
  return _exportQueue;
}

/** Returns the singleton price-fetch BullMQ Queue instance. */
export function getPriceFetchQueue(): Queue<PriceFetchJobData> {
  if (!_priceFetchQueue) {
    _priceFetchQueue = new Queue<PriceFetchJobData>(PRICE_FETCH_QUEUE, {
      connection: createRedisConnection(),
      defaultJobOptions: {
        attempts: 4,
        backoff: { type: "exponential", delay: 3_000 },
        removeOnComplete: { count: 5_000 },
        removeOnFail: { count: 10_000 },
      },
    });
  }
  return _priceFetchQueue;
}

/** Returns the singleton email-send BullMQ Queue instance. */
export function getEmailQueue(): Queue<EmailJobData> {
  if (!_emailQueue) {
    _emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE, {
      connection: createRedisConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5_000 },
        removeOnComplete: { count: 1_000 },
        removeOnFail: { count: 2_000 },
      },
    });
  }
  return _emailQueue;
}
