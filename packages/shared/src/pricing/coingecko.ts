// ---------------------------------------------------------------------------
// CoinGecko Historical Price API — Free Tier (Tier 2 Fallback)
// ---------------------------------------------------------------------------

import type { PriceResult } from '../types';

// ---------------------------------------------------------------------------
// CoinGecko API configuration
// ---------------------------------------------------------------------------

const COINGECKO_BASE_URL = 'https://api.coingecko.com/api/v3';

/**
 * Rate limit: max 30 requests per minute on free tier.
 * We track request timestamps and enforce this limit.
 */
const MAX_REQUESTS_PER_MINUTE = 30;
const RATE_LIMIT_WINDOW_MS = 60_000;

/**
 * Mapping of token symbols (uppercase) to CoinGecko coin IDs.
 * Comprehensive for Flare ecosystem and common DeFi tokens.
 */
const TOKEN_TO_COINGECKO_ID: Record<string, string> = {
  // Flare ecosystem
  FLR: 'flare-networks',
  WFLR: 'flare-networks',
  SGB: 'songbird',
  WSGB: 'songbird',

  // XRP ecosystem (FAssets on Flare)
  XRP: 'ripple',
  FXRP: 'ripple',

  // Major L1 / blue chips
  BTC: 'bitcoin',
  WBTC: 'wrapped-bitcoin',
  ETH: 'ethereum',
  WETH: 'weth',

  // Stablecoins
  USDT: 'tether',
  USDC: 'usd-coin',
  DAI: 'dai',
  BUSD: 'binance-usd',
  FRAX: 'frax',
  LUSD: 'liquity-usd',
  TUSD: 'true-usd',

  // L1 / L2
  BNB: 'binancecoin',
  SOL: 'solana',
  ADA: 'cardano',
  AVAX: 'avalanche-2',
  MATIC: 'matic-network',
  DOT: 'polkadot',
  LINK: 'chainlink',
  ATOM: 'cosmos',
  NEAR: 'near',
  ARB: 'arbitrum',
  OP: 'optimism',
  FTM: 'fantom',
  FIL: 'filecoin',

  // DeFi tokens
  UNI: 'uniswap',
  AAVE: 'aave',
  MKR: 'maker',
  COMP: 'compound-governance-token',
  CRV: 'curve-dao-token',
  SUSHI: 'sushi',
  YFI: 'yearn-finance',
  SNX: 'havven',
  BAL: 'balancer',
  LDO: 'lido-dao',

  // Other
  LTC: 'litecoin',
  DOGE: 'dogecoin',
  SHIB: 'shiba-inu',
  PEPE: 'pepe',
};

// ---------------------------------------------------------------------------
// Rate limiter (simple in-memory timestamp tracking)
// ---------------------------------------------------------------------------

/** Timestamps of recent API requests */
const requestTimestamps: number[] = [];

/**
 * Check whether we can make a request without exceeding the rate limit.
 * If under the limit, records the current timestamp and returns true.
 */
function acquireRateLimit(): boolean {
  const now = Date.now();

  // Remove timestamps outside the rolling window
  while (requestTimestamps.length > 0 && requestTimestamps[0]! < now - RATE_LIMIT_WINDOW_MS) {
    requestTimestamps.shift();
  }

  if (requestTimestamps.length >= MAX_REQUESTS_PER_MINUTE) {
    return false;
  }

  requestTimestamps.push(now);
  return true;
}

// ---------------------------------------------------------------------------
// Date formatting helper
// ---------------------------------------------------------------------------

/**
 * Convert a Unix timestamp (seconds) to CoinGecko's required date format: DD-MM-YYYY
 */
function unixToCoingeckoDate(timestampUnix: number): string {
  const date = new Date(timestampUnix * 1000);
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = date.getUTCFullYear();
  return `${day}-${month}-${year}`;
}

// ---------------------------------------------------------------------------
// API response types
// ---------------------------------------------------------------------------

interface CoinGeckoHistoryResponse {
  id: string;
  symbol: string;
  name: string;
  market_data?: {
    current_price?: {
      eur?: number;
      usd?: number;
    };
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch the historical EUR price for a token from CoinGecko's free API.
 *
 * Uses the `/coins/{id}/history` endpoint which provides the price at
 * 00:00:00 UTC of the specified date. This is acceptable for daily tax
 * calculations per BMF guidelines.
 *
 * @param tokenSymbol  Uppercase token symbol (e.g. "FLR", "ETH")
 * @param timestampUnix  Unix timestamp in seconds
 * @returns PriceResult or null if unavailable / rate limited / not found
 */
export async function getCoinGeckoPrice(
  tokenSymbol: string,
  timestampUnix: number,
): Promise<PriceResult | null> {
  const normalised = tokenSymbol.toUpperCase();
  const coinId = TOKEN_TO_COINGECKO_ID[normalised];

  if (!coinId) {
    console.log(`[CoinGecko] No CoinGecko ID mapping for token: ${normalised}`);
    return null;
  }

  // Rate limit check
  if (!acquireRateLimit()) {
    console.log(
      `[CoinGecko] Rate limit reached (${MAX_REQUESTS_PER_MINUTE}/min). ` +
        `Skipping request for ${normalised}`,
    );
    return null;
  }

  const dateStr = unixToCoingeckoDate(timestampUnix);
  const url = `${COINGECKO_BASE_URL}/coins/${coinId}/history?date=${dateStr}&localization=false`;

  try {
    console.log(`[CoinGecko] Fetching ${normalised} (${coinId}) for date ${dateStr}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    // Handle rate limiting from CoinGecko's side (429 Too Many Requests)
    if (response.status === 429) {
      console.log('[CoinGecko] Received 429 Too Many Requests — backing off');
      return null;
    }

    if (!response.ok) {
      console.log(`[CoinGecko] API error: HTTP ${response.status} for ${normalised}`);
      return null;
    }

    const data = (await response.json()) as CoinGeckoHistoryResponse;

    // Extract EUR price from response
    const eurPrice = data.market_data?.current_price?.eur;

    if (eurPrice === undefined || eurPrice === null) {
      console.log(`[CoinGecko] No EUR price data for ${normalised} on ${dateStr}`);
      return null;
    }

    if (eurPrice <= 0) {
      console.log(`[CoinGecko] Zero or negative EUR price for ${normalised}: ${eurPrice}`);
      return null;
    }

    const sourceUrl = `https://www.coingecko.com/en/coins/${coinId}/historical_data/eur?start_date=${dateStr}&end_date=${dateStr}`;

    console.log(`[CoinGecko] ${normalised}: EUR=${eurPrice.toFixed(6)} on ${dateStr}`);

    return {
      tokenSymbol: normalised,
      eurPrice,
      source: 'COINGECKO',
      timestamp: timestampUnix,
      sourceUrl,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`[CoinGecko] Error fetching price for ${normalised}: ${message}`);
    return null;
  }
}

/**
 * Check whether a given token symbol has a CoinGecko mapping.
 */
export function isCoinGeckoSupported(tokenSymbol: string): boolean {
  return tokenSymbol.toUpperCase() in TOKEN_TO_COINGECKO_ID;
}

/**
 * Get the current rate limit status.
 * Useful for monitoring and deciding whether to attempt a CoinGecko call.
 */
export function getRateLimitStatus(): {
  used: number;
  remaining: number;
  windowMs: number;
} {
  const now = Date.now();

  // Purge expired timestamps
  while (requestTimestamps.length > 0 && requestTimestamps[0]! < now - RATE_LIMIT_WINDOW_MS) {
    requestTimestamps.shift();
  }

  return {
    used: requestTimestamps.length,
    remaining: MAX_REQUESTS_PER_MINUTE - requestTimestamps.length,
    windowMs: RATE_LIMIT_WINDOW_MS,
  };
}
