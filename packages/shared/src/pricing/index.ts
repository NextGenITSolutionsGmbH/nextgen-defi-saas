// ---------------------------------------------------------------------------
// @defi-tracker/shared — Pricing module barrel exports
// EUR Price Engine with 4-tier fallback: FTSO → CoinGecko → CMC → Manual
// ---------------------------------------------------------------------------

export { getFtsoPrice, isFtsoSupported } from './ftso';

export {
  getCoinGeckoPrice,
  isCoinGeckoSupported,
  getRateLimitStatus,
} from './coingecko';

export { getCmcPrice, isCmcSupported } from './coinmarketcap';

export {
  PriceEngine,
  ManualPriceRequiredError,
  createPriceAuditEntry,
} from './price-engine';

export type { PriceAuditLog } from './price-engine';
