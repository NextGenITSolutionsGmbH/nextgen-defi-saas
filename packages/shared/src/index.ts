// ---------------------------------------------------------------------------
// @defi-tracker/shared — Barrel re-export
// ---------------------------------------------------------------------------

// Types
export type {
  FlareChainConfig,
  WalletSyncJob,
  DecodedTxEvent,
  TxClassificationResult,
  PriceResult,
  TaxLotEntry,
  TaxGainLoss,
  FreigrenzeStatus,
  CoinTrackingRow,
  AuditLogEntry,
  ExportJobPayload,
  DualScenario,
  PriceSourceType,
  AmpelColor,
  TaxLotMethod,
  ExportFormat,
} from './types';

// Constants
export {
  FLARE_MAINNET,
  FLARE_TESTNET,
  FLARE_TOKENS,
  PROTOCOL_ADDRESSES,
  COINTRACKING_TYPES,
  TAX_CONSTANTS,
  PRICE_SOURCE_PRIORITY,
} from './constants';

export type { FlareTokenInfo, ProtocolAddressEntry, CoinTrackingType } from './constants';

// ABIs
export {
  SPARKDEX_V3_EVENTS,
  SPARKDEX_V4_EVENTS,
  ENOSYS_DEX_EVENTS,
  ENOSYS_CDP_EVENTS,
  KINETIC_EVENTS,
  FLARE_STAKING_EVENTS,
  ERC20_EVENTS,
} from './abis';

// Queue definitions
export {
  createRedisConnection,
  WALLET_SYNC_QUEUE,
  EXPORT_QUEUE,
  PRICE_FETCH_QUEUE,
} from './queue';

export type {
  WalletSyncJobData,
  ExportJobData,
  PriceFetchJobData,
} from './queue';

// Pricing engine (4-tier fallback: FTSO → CoinGecko → CMC → Manual)
export {
  getFtsoPrice,
  isFtsoSupported,
  getCoinGeckoPrice,
  isCoinGeckoSupported,
  getRateLimitStatus,
  getCmcPrice,
  isCmcSupported,
  PriceEngine,
  ManualPriceRequiredError,
  createPriceAuditEntry,
} from './pricing';

export type { PriceAuditLog } from './pricing';

// Tax Calculation Engine
export {
  LotMatcher,
  TaxEngine,
  calculateFreigrenze,
  calculateHaltefrist,
  getUpcomingTaxFreeAssets,
} from './tax';

export type {
  TaxMethod,
  TaxEventType,
  TaxLot,
  Disposal,
  TaxGainLossResult,
  TaxFreigrenzeStatus,
  HaltefristEntry,
} from './tax';

// Export engine (CoinTracking CSV, XLSX, PDF report, GoBD audit log)
export {
  formatDecimalDE,
  formatDateCT,
  rowToCsvLine,
  generateCoinTrackingCsv,
  generateCoinTrackingCsvBuffer,
  generateCoinTrackingXlsxBuffer,
  validateCoinTrackingRow,
  generateTaxReportHtml,
  computeAuditHash,
  createAuditLogEntry,
  verifyAuditChain,
  createExportAuditEntry,
  computeFileHash,
} from './export';

export type {
  CoinTrackingRow as CoinTrackingCsvRow,
  AuditLogEntry as GoBDAuditLogEntry,
  TaxReportData,
} from './export';

// Classification Engine (Ampel system, BMF-2025 tax classification)
export { ClassificationEngine } from './classifier';
export { classifySparkDex } from './classifier';
export { classifyEnosys } from './classifier';
export { classifyKinetic } from './classifier';
export { classifyFlareNative } from './classifier';

export type {
  AmpelStatus,
  ModelChoice,
  PriceSource,
  DecodedEvent,
  ClassificationResult,
} from './classifier';

// Blockchain Indexer (Flare RPC, Event Decoder, Wallet Sync)
export {
  FlareRpcClient,
  FLARE_MAINNET_CONFIG,
  FLARE_TESTNET_CONFIG,
} from './indexer';
export {
  decodeLog,
  decodeTransactionLogs,
  EVENT_TOPICS,
} from './indexer';
export {
  WalletSyncService,
  createFlareSyncService,
} from './indexer';

export type {
  FlareRpcConfig,
  RpcBlock,
  RpcTransactionReceipt,
  RpcLog,
  DecodedTransaction,
  AbiInput,
  AbiEventFragment,
  SyncProgress,
  SyncResult,
  ProcessedTransaction,
} from './indexer';
