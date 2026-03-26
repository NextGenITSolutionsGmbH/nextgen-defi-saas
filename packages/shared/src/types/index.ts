// ---------------------------------------------------------------------------
// @defi-tracker/shared — Core TypeScript type definitions
// ---------------------------------------------------------------------------

/** Chain configuration for Flare mainnet / testnet */
export interface FlareChainConfig {
  chainId: 14 | 114;
  rpcUrl: string;
  explorerUrl: string;
  name: string;
}

/** Payload for the wallet-sync BullMQ job */
export interface WalletSyncJob {
  walletId: string;
  chainId: number;
  fromBlock: number;
  toBlock: number;
}

/** Decoded on-chain transaction event */
export interface DecodedTxEvent {
  txHash: string;
  blockNumber: number;
  blockTimestamp: number;
  protocol: string;
  eventName: string;
  args: Record<string, unknown>;
  logIndex: number;
}

/** Result of classifying a decoded transaction for tax purposes */
export interface TxClassificationResult {
  /** CoinTracking transaction type string (e.g. 'Trade', 'Staking') */
  ctType: string;
  buyAmount: string;
  buyCurrency: string;
  sellAmount: string;
  sellCurrency: string;
  fee: string;
  feeCurrency: string;
  eurBuyValue: string;
  eurSellValue: string;
  priceSource: PriceSourceType;
  modelChoice: 'MODEL_A' | 'MODEL_B' | null;
  ampelStatus: AmpelColor;
  isGraubereich: boolean;
  comment: string;
}

/** Price oracle result */
export interface PriceResult {
  tokenSymbol: string;
  eurPrice: number;
  source: PriceSourceType;
  timestamp: number;
  sourceUrl: string | null;
}

/** Single tax lot entry for FIFO / LIFO tracking */
export interface TaxLotEntry {
  id: string;
  tokenSymbol: string;
  tokenAddress: string;
  /** Decimal amount stored as string to avoid floating-point issues */
  amount: string;
  /** Acquisition cost in EUR stored as string */
  acquisitionCostEur: string;
  acquisitionDate: Date;
  /** Remaining un-disposed amount stored as string */
  remainingAmount: string;
  method: TaxLotMethod;
}

/** Gain / loss computation result for a disposal event */
export interface TaxGainLoss {
  eventType: 'PARAGRAPH_23' | 'PARAGRAPH_22_NR3';
  /** Gain or loss in EUR stored as string */
  gainLossEur: string;
  holdingPeriodDays: number;
  taxYear: number;
  isTaxFree: boolean;
}

/** BMF Freigrenze (exemption threshold) status for the current tax year */
export interface FreigrenzeStatus {
  paragraph23: {
    used: number;
    limit: 1000;
    remaining: number;
    ampel: AmpelColor;
  };
  paragraph22Nr3: {
    used: number;
    limit: 256;
    remaining: number;
    ampel: AmpelColor;
  };
}

/**
 * Single row in a CoinTracking CSV export.
 * All 15 standard columns are represented.
 */
export interface CoinTrackingRow {
  type: string;
  buyAmount: string;
  buyCurrency: string;
  sellAmount: string;
  sellCurrency: string;
  fee: string;
  feeCurrency: string;
  exchange: string;
  tradeGroup: string;
  comment: string;
  /** Date formatted as DD.MM.YYYY HH:mm:ss */
  date: string;
  liquidityPool: string;
  txId: string;
  buyValueInAccountCurrency: string;
  sellValueInAccountCurrency: string;
}

/** Immutable audit-log entry with hash chain */
export interface AuditLogEntry {
  entityType: string;
  entityId: string;
  action: string;
  fieldChanged: string;
  oldValue: string | null;
  newValue: string | null;
  changedBy: string;
  /** SHA-256 hash of this entry's payload */
  sha256Hash: string;
  /** SHA-256 hash of the previous entry (hash-chain) */
  prevHash: string;
}

/** Payload for the CSV / XLSX / PDF export BullMQ job */
export interface ExportJobPayload {
  exportId: string;
  userId: string;
  taxYear: number;
  method: TaxLotMethod;
  format: ExportFormat;
}

/** Side-by-side comparison of Model A vs. Model B tax treatment */
export interface DualScenario {
  modelA: TaxGainLoss;
  modelB: TaxGainLoss;
  recommendation: string;
}

// ---------------------------------------------------------------------------
// Shared literal-union helpers
// ---------------------------------------------------------------------------

export type PriceSourceType = 'FTSO' | 'COINGECKO' | 'CMC' | 'MANUAL';
export type AmpelColor = 'GREEN' | 'YELLOW' | 'RED' | 'GRAY';
export type TaxLotMethod = 'FIFO' | 'LIFO';
export type ExportFormat = 'CSV' | 'XLSX' | 'PDF';
