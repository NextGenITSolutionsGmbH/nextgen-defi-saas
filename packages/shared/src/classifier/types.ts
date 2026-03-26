// ---------------------------------------------------------------------------
// Classification Engine — Type definitions
// ---------------------------------------------------------------------------
// These types power the Transaction Classification Engine and its Ampel
// (traffic-light) system for BMF-2025-compliant German tax classification.
// ---------------------------------------------------------------------------

/**
 * Ampel (traffic-light) status for a classified transaction.
 *
 * - GREEN  — Automatically classified with high confidence.
 * - YELLOW — Graubereich (grey area): dual-scenario treatment, user must choose.
 * - RED    — Unknown or high-risk event requiring manual classification.
 * - GRAY   — Tax-irrelevant event (approvals, internal transfers, etc.).
 */
export type AmpelStatus = 'GREEN' | 'YELLOW' | 'RED' | 'GRAY';

/**
 * Dual-scenario model choice for Graubereich transactions.
 *
 * - MODEL_A — Conservative interpretation (e.g., CDP mint = Trade / Tausch).
 * - MODEL_B — Progressive interpretation (e.g., CDP mint = Darlehen / Loan).
 * - null    — Not applicable (non-Graubereich transactions).
 */
export type ModelChoice = 'MODEL_A' | 'MODEL_B' | null;

/**
 * Price oracle source used to determine EUR value.
 */
export type PriceSource = 'FTSO' | 'COINGECKO' | 'CMC' | 'MANUAL';

/**
 * A decoded on-chain event ready for classification.
 * Produced by the event decoder layer (ABI parsing + protocol detection).
 */
export interface DecodedEvent {
  /** Transaction hash */
  txHash: string;
  /** Block number the event was emitted in */
  blockNumber: number;
  /** Unix timestamp of the block */
  blockTimestamp: number;
  /** Log index within the transaction receipt */
  logIndex: number;
  /** Address of the contract that emitted the event */
  contractAddress: string;
  /** Decoded event name (e.g., 'Swap', 'Mint', 'Transfer') */
  eventName: string;
  /** Decoded event arguments */
  args: Record<string, unknown>;
  /** Detected protocol name, or null if unknown */
  protocol: string | null;
}

/**
 * Result of classifying a single decoded event for CoinTracking CSV export
 * with BMF-2025 tax compliance metadata.
 */
export interface ClassificationResult {
  /** CoinTracking type (Trade, Staking, LP Rewards, etc.) */
  ctType: string;
  /** Amount received (decimal string for BigInt precision) */
  buyAmount: string | null;
  /** Currency/token received */
  buyCurrency: string | null;
  /** Amount sent (decimal string for BigInt precision) */
  sellAmount: string | null;
  /** Currency/token sent */
  sellCurrency: string | null;
  /** Transaction fee amount (decimal string) */
  fee: string | null;
  /** Transaction fee currency */
  feeCurrency: string | null;
  /** Exchange/protocol name for CoinTracking (SparkDEX, Enosys, Kinetic Market, Flare Network) */
  exchange: string;
  /** Trade group for CoinTracking (DeFi-Flare, Staking, Farming, Lending) */
  tradeGroup: string;
  /** Ampel (traffic-light) status */
  ampelStatus: AmpelStatus;
  /** Whether this event falls into a Graubereich (grey area) under German tax law */
  isGraubereich: boolean;
  /** Selected dual-scenario model, or null if not applicable */
  modelChoice: ModelChoice;
  /** Human-readable comment with tax law references */
  comment: string;
}
