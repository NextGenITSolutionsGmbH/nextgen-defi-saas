// ---------------------------------------------------------------------------
// @defi-tracker/shared — Queue definitions and Redis connection factory
// ---------------------------------------------------------------------------
import Redis from "ioredis";
import type { RedisOptions } from "ioredis";

// ---------------------------------------------------------------------------
// Redis Connection Factory
// ---------------------------------------------------------------------------

/** Default Redis URL used when REDIS_URL env var is not set */
const DEFAULT_REDIS_URL = "redis://localhost:6379";

/**
 * Creates a new ioredis connection from the REDIS_URL environment variable.
 * Falls back to redis://localhost:6379 when the variable is absent.
 *
 * Each BullMQ Queue / Worker should receive its own connection instance.
 */
export function createRedisConnection(overrideUrl?: string): Redis {
  const url = overrideUrl ?? process.env.REDIS_URL ?? DEFAULT_REDIS_URL;
  return new Redis(url, {
    maxRetriesPerRequest: null, // required by BullMQ
  } satisfies RedisOptions);
}

// ---------------------------------------------------------------------------
// Queue Name Constants
// ---------------------------------------------------------------------------

/** Queue for wallet synchronisation jobs (on-chain tx fetch) */
export const WALLET_SYNC_QUEUE = "wallet-sync" as const;

/** Queue for CSV / XLSX / PDF export generation jobs */
export const EXPORT_QUEUE = "export-gen" as const;

/** Queue for token price fetching jobs (FTSO / CoinGecko / CMC) */
export const PRICE_FETCH_QUEUE = "price-fetch" as const;

// ---------------------------------------------------------------------------
// Job Data Interfaces
// ---------------------------------------------------------------------------

/** Payload dispatched into the wallet-sync queue */
export interface WalletSyncJobData {
  walletId: string;
  chainId: number;
  fromBlock?: number;
}

/** Payload dispatched into the export-gen queue */
export interface ExportJobData {
  exportId: string;
  userId: string;
  taxYear: number;
  method: "FIFO" | "LIFO";
  format: "CSV" | "XLSX" | "PDF";
}

/** Payload dispatched into the price-fetch queue */
export interface PriceFetchJobData {
  tokenSymbol: string;
  tokenAddress: string;
  chainId: number;
  timestampUnix: number;
}
