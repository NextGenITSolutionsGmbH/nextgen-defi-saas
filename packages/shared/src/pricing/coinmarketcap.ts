// ---------------------------------------------------------------------------
// CoinMarketCap Historical Price API — Paid Fallback (Tier 3)
// ---------------------------------------------------------------------------

import type { PriceResult } from '../types';

// ---------------------------------------------------------------------------
// CMC API configuration
// ---------------------------------------------------------------------------

const CMC_BASE_URL = 'https://pro-api.coinmarketcap.com/v2';

/**
 * Mapping of token symbols (uppercase) to CoinMarketCap numeric IDs.
 * CMC requires numeric IDs for the historical quotes endpoint.
 */
const TOKEN_TO_CMC_ID: Record<string, number> = {
  // Flare ecosystem
  FLR: 18631,
  WFLR: 18631,
  SGB: 12186,
  WSGB: 12186,

  // XRP ecosystem
  XRP: 52,
  FXRP: 52,

  // Major L1 / blue chips
  BTC: 1,
  WBTC: 3717,
  ETH: 1027,
  WETH: 2396,

  // Stablecoins
  USDT: 825,
  USDC: 3408,
  DAI: 4943,
  BUSD: 4687,
  FRAX: 6952,
  TUSD: 2563,

  // L1 / L2
  BNB: 1839,
  SOL: 5426,
  ADA: 2010,
  AVAX: 5805,
  MATIC: 3890,
  DOT: 6636,
  LINK: 1975,
  ATOM: 3794,
  NEAR: 6535,
  ARB: 11841,
  OP: 11840,
  FTM: 3513,
  FIL: 2280,

  // DeFi tokens
  UNI: 7083,
  AAVE: 7278,
  MKR: 1518,
  COMP: 5692,
  CRV: 6538,
  SUSHI: 6758,
  YFI: 5864,
  SNX: 2586,
  BAL: 5728,
  LDO: 8000,

  // Other
  LTC: 2,
  DOGE: 74,
  SHIB: 5994,
};

// ---------------------------------------------------------------------------
// API response types
// ---------------------------------------------------------------------------

interface CmcQuote {
  price: number;
  timestamp: string;
}

interface CmcHistoricalQuotesResponse {
  status: {
    error_code: number;
    error_message: string | null;
  };
  data: {
    quotes?: Array<{
      timestamp: string;
      quote: {
        EUR?: CmcQuote;
        USD?: CmcQuote;
      };
    }>;
  };
}

// ---------------------------------------------------------------------------
// Date formatting helpers
// ---------------------------------------------------------------------------

/**
 * Convert Unix timestamp (seconds) to ISO 8601 format required by CMC API.
 */
function unixToIso(timestampUnix: number): string {
  return new Date(timestampUnix * 1000).toISOString();
}

/**
 * Create a time window around the target timestamp for the historical query.
 * CMC requires a time_start and time_end range.
 * We use a 24-hour window centered on the target.
 */
function getTimeWindow(timestampUnix: number): { start: string; end: string } {
  const halfDay = 12 * 60 * 60; // 12 hours in seconds
  return {
    start: unixToIso(timestampUnix - halfDay),
    end: unixToIso(timestampUnix + halfDay),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch the historical EUR price for a token from CoinMarketCap's paid API.
 *
 * Uses the `/cryptocurrency/quotes/historical` endpoint which provides
 * OHLCV data at specified time intervals. We pick the quote closest to the
 * requested timestamp.
 *
 * Requires a CMC API key (Basic plan or higher for historical data).
 *
 * @param tokenSymbol  Uppercase token symbol (e.g. "FLR", "ETH")
 * @param timestampUnix  Unix timestamp in seconds
 * @param apiKey  CoinMarketCap API key
 * @returns PriceResult or null if unavailable / error
 */
export async function getCmcPrice(
  tokenSymbol: string,
  timestampUnix: number,
  apiKey: string,
): Promise<PriceResult | null> {
  const normalised = tokenSymbol.toUpperCase();
  const cmcId = TOKEN_TO_CMC_ID[normalised];

  if (cmcId === undefined) {
    console.log(`[CMC] No CMC ID mapping for token: ${normalised}`);
    return null;
  }

  if (!apiKey || apiKey.trim().length === 0) {
    console.log('[CMC] No API key provided — skipping CMC lookup');
    return null;
  }

  const timeWindow = getTimeWindow(timestampUnix);

  const params = new URLSearchParams({
    id: String(cmcId),
    time_start: timeWindow.start,
    time_end: timeWindow.end,
    count: '1',
    interval: 'daily',
    convert: 'EUR',
  });

  const url = `${CMC_BASE_URL}/cryptocurrency/quotes/historical?${params.toString()}`;

  try {
    console.log(
      `[CMC] Fetching ${normalised} (CMC ID: ${cmcId}) ` +
        `for ${unixToIso(timestampUnix)}`,
    );

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'X-CMC_PRO_API_KEY': apiKey,
      },
    });

    if (response.status === 401 || response.status === 403) {
      console.log(`[CMC] Authentication error: HTTP ${response.status}`);
      return null;
    }

    if (response.status === 429) {
      console.log('[CMC] Rate limit exceeded (HTTP 429)');
      return null;
    }

    if (!response.ok) {
      console.log(`[CMC] API error: HTTP ${response.status} for ${normalised}`);
      return null;
    }

    const data = (await response.json()) as CmcHistoricalQuotesResponse;

    // Check API-level errors
    if (data.status.error_code !== 0) {
      console.log(
        `[CMC] API returned error: ${data.status.error_message ?? 'Unknown error'}`,
      );
      return null;
    }

    const quotes = data.data.quotes;
    if (!quotes || quotes.length === 0) {
      console.log(`[CMC] No historical quotes returned for ${normalised}`);
      return null;
    }

    // Find the quote closest to our target timestamp
    let bestQuote: { eurPrice: number; quoteTimestamp: number } | null = null;
    let bestDelta = Infinity;

    for (const q of quotes) {
      const eurQuote = q.quote.EUR;
      if (!eurQuote || eurQuote.price <= 0) continue;

      const quoteTime = Math.floor(new Date(q.timestamp).getTime() / 1000);
      const delta = Math.abs(quoteTime - timestampUnix);

      if (delta < bestDelta) {
        bestDelta = delta;
        bestQuote = {
          eurPrice: eurQuote.price,
          quoteTimestamp: quoteTime,
        };
      }
    }

    if (!bestQuote) {
      console.log(`[CMC] No valid EUR quote found for ${normalised}`);
      return null;
    }

    const sourceUrl = `https://coinmarketcap.com/currencies/${normalised.toLowerCase()}/`;

    console.log(
      `[CMC] ${normalised}: EUR=${bestQuote.eurPrice.toFixed(6)} ` +
        `(delta=${bestDelta}s from target)`,
    );

    return {
      tokenSymbol: normalised,
      eurPrice: bestQuote.eurPrice,
      source: 'CMC',
      timestamp: bestQuote.quoteTimestamp,
      sourceUrl,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`[CMC] Error fetching price for ${normalised}: ${message}`);
    return null;
  }
}

/**
 * Check whether a given token symbol has a CMC mapping.
 */
export function isCmcSupported(tokenSymbol: string): boolean {
  return tokenSymbol.toUpperCase() in TOKEN_TO_CMC_ID;
}
