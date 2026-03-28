// ---------------------------------------------------------------------------
// FTSO On-Chain Price Oracle — Flare Time Series Oracle
// Primary price source for Flare ecosystem tokens (Tier 1)
//
// @spec FR-05-01, EP-05 — FTSO on-chain price oracle (primary source)
// ---------------------------------------------------------------------------

import type { PriceResult } from '../types';

// ---------------------------------------------------------------------------
// FTSO Registry & Price Feed ABI fragments (minimal for eth_call)
// ---------------------------------------------------------------------------

/**
 * FTSO Registry contract address on Flare mainnet.
 * This is the entry point to discover individual FTSO price feed contracts.
 */
const FTSO_REGISTRY_ADDRESS = '0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019';

/**
 * Function selector for `getCurrentPriceWithDecimalsAndTimestamp(string)`
 * Keccak-256 of "getCurrentPriceWithDecimalsAndTimestamp(string)" → first 4 bytes
 */
const GET_PRICE_WITH_TIMESTAMP_SELECTOR = '0xd9ce22a5';

/**
 * Maximum age (in seconds) for an FTSO price to be considered fresh.
 * Prices older than this are considered stale and will trigger fallback.
 */
const MAX_PRICE_AGE_SECONDS = 300; // 5 minutes

/**
 * Mapping of token symbols to their FTSO feed symbols.
 * FTSO uses specific naming conventions for its price feeds.
 */
const TOKEN_TO_FTSO_SYMBOL: Record<string, string> = {
  FLR: 'FLR',
  WFLR: 'FLR',
  SGB: 'SGB',
  WSGB: 'SGB',
  XRP: 'XRP',
  FXRP: 'XRP',
  BTC: 'BTC',
  WBTC: 'BTC',
  ETH: 'ETH',
  WETH: 'ETH',
  USDT: 'USDT',
  USDC: 'USDC',
  LTC: 'LTC',
  DOGE: 'DOGE',
  ADA: 'ADA',
  SOL: 'SOL',
  AVAX: 'AVAX',
  MATIC: 'MATIC',
  DOT: 'DOT',
  FIL: 'FIL',
  ARB: 'ARB',
};

/**
 * Tokens supported by the FTSO oracle. Used for quick lookup before
 * attempting an on-chain call.
 */
const SUPPORTED_FTSO_TOKENS = new Set(Object.keys(TOKEN_TO_FTSO_SYMBOL));

// ---------------------------------------------------------------------------
// ABI Encoding helpers (pure TS, no ethers dependency)
// ---------------------------------------------------------------------------

/**
 * ABI-encode a string parameter for an eth_call.
 * Layout: offset (32 bytes) + length (32 bytes) + data (padded to 32-byte boundary)
 */
function encodeStringParam(value: string): string {
  const hex = Buffer.from(value, 'utf8').toString('hex');
  const byteLength = value.length;

  // Offset to the start of the dynamic data (always 0x20 = 32 for single param)
  const offset = '0000000000000000000000000000000000000000000000000000000000000020';

  // Length of the string in bytes
  const length = byteLength.toString(16).padStart(64, '0');

  // String data, right-padded to 32-byte boundary
  const paddedData = hex.padEnd(Math.ceil(hex.length / 64) * 64, '0');

  return offset + length + paddedData;
}

/**
 * Decode a uint256 from a hex string (no 0x prefix) at the given 32-byte slot.
 */
function decodeUint256(hexData: string, slotIndex: number): bigint {
  const start = slotIndex * 64;
  const slice = hexData.slice(start, start + 64);
  if (slice.length < 64) {
    throw new Error(`Insufficient data to decode uint256 at slot ${slotIndex}`);
  }
  return BigInt('0x' + slice);
}

// ---------------------------------------------------------------------------
// JSON-RPC helper
// ---------------------------------------------------------------------------

interface JsonRpcResponse {
  jsonrpc: string;
  id: number;
  result?: string;
  error?: { code: number; message: string };
}

/**
 * Execute a raw JSON-RPC eth_call against the Flare RPC endpoint.
 */
async function ethCall(
  rpcUrl: string,
  to: string,
  data: string,
  blockTag: string = 'latest',
): Promise<string> {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_call',
      params: [{ to, data }, blockTag],
    }),
  });

  if (!response.ok) {
    throw new Error(`FTSO RPC request failed: HTTP ${response.status}`);
  }

  const json = (await response.json()) as JsonRpcResponse;

  if (json.error) {
    throw new Error(`FTSO RPC error: ${json.error.message} (code ${json.error.code})`);
  }

  if (!json.result || json.result === '0x') {
    throw new Error('FTSO RPC returned empty result');
  }

  return json.result;
}

/**
 * Fetch the latest block number from the RPC endpoint.
 */
async function getBlockNumber(rpcUrl: string): Promise<number> {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_blockNumber',
      params: [],
    }),
  });

  if (!response.ok) {
    throw new Error(`RPC eth_blockNumber failed: HTTP ${response.status}`);
  }

  const json = (await response.json()) as JsonRpcResponse;

  if (json.error) {
    throw new Error(`RPC eth_blockNumber error: ${json.error.message}`);
  }

  return Number(json.result);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Query the Flare FTSO on-chain oracle for the EUR-denominated price of a
 * token at (or near) the given block timestamp.
 *
 * The FTSO provides USD prices on-chain. We convert to EUR using the FTSO's
 * own EUR/USD feed when available, otherwise return null to fall through to
 * the next tier.
 *
 * @param tokenSymbol  Uppercase token symbol (e.g. "FLR", "XRP", "BTC")
 * @param blockTimestamp  Unix timestamp (seconds) of the transaction
 * @param rpcUrl  JSON-RPC URL for the Flare network
 * @returns PriceResult or null if unavailable / stale / unsupported
 */
export async function getFtsoPrice(
  tokenSymbol: string,
  blockTimestamp: number,
  rpcUrl: string,
): Promise<PriceResult | null> {
  const normalised = tokenSymbol.toUpperCase();

  // Quick check: is this token supported by FTSO?
  if (!SUPPORTED_FTSO_TOKENS.has(normalised)) {
    console.log(`[FTSO] Token ${normalised} not supported by FTSO oracle`);
    return null;
  }

  const ftsoSymbol = TOKEN_TO_FTSO_SYMBOL[normalised];
  if (!ftsoSymbol) {
    return null;
  }

  try {
    // -----------------------------------------------------------------------
    // Step 1: Get the USD price + timestamp from FTSO
    // -----------------------------------------------------------------------
    const callData =
      GET_PRICE_WITH_TIMESTAMP_SELECTOR + encodeStringParam(ftsoSymbol);

    const rawResult = await ethCall(rpcUrl, FTSO_REGISTRY_ADDRESS, callData);

    // Strip 0x prefix for decoding
    const hex = rawResult.startsWith('0x') ? rawResult.slice(2) : rawResult;

    // Response: (uint256 price, uint256 decimals, uint256 timestamp)
    const rawPrice = decodeUint256(hex, 0);
    const decimals = decodeUint256(hex, 1);
    const feedTimestamp = Number(decodeUint256(hex, 2));

    // Staleness check: price feed must be within MAX_PRICE_AGE_SECONDS of the
    // requested block timestamp
    const age = Math.abs(blockTimestamp - feedTimestamp);
    if (age > MAX_PRICE_AGE_SECONDS) {
      console.log(
        `[FTSO] Price feed for ${ftsoSymbol} is stale: ` +
          `feed=${feedTimestamp}, requested=${blockTimestamp}, age=${age}s`,
      );
      return null;
    }

    // Convert raw price to a floating-point USD price
    const divisor = 10 ** Number(decimals);
    const usdPrice = Number(rawPrice) / divisor;

    if (usdPrice <= 0) {
      console.log(`[FTSO] Zero or negative price for ${ftsoSymbol}: ${usdPrice}`);
      return null;
    }

    // -----------------------------------------------------------------------
    // Step 2: Get USD/EUR conversion rate from FTSO (EUR feed)
    // FTSO does not provide direct EUR pairs — it provides USD prices.
    // We attempt to get the EUR/USD rate to convert. If the EUR feed is
    // unavailable, we fall back to a reasonable fixed rate as last resort.
    // -----------------------------------------------------------------------
    let eurUsdRate: number;
    try {
      const eurCallData =
        GET_PRICE_WITH_TIMESTAMP_SELECTOR + encodeStringParam('EUR');

      const eurRawResult = await ethCall(rpcUrl, FTSO_REGISTRY_ADDRESS, eurCallData);
      const eurHex = eurRawResult.startsWith('0x')
        ? eurRawResult.slice(2)
        : eurRawResult;

      const eurRawPrice = decodeUint256(eurHex, 0);
      const eurDecimals = decodeUint256(eurHex, 1);
      const eurDivisor = 10 ** Number(eurDecimals);
      eurUsdRate = Number(eurRawPrice) / eurDivisor;

      if (eurUsdRate <= 0) {
        console.log('[FTSO] EUR/USD rate invalid, falling back');
        return null;
      }
    } catch {
      // EUR feed may not exist on FTSO — this means we cannot reliably
      // convert to EUR on-chain. Fall through to CoinGecko which provides
      // direct EUR pricing.
      console.log('[FTSO] EUR/USD feed not available on FTSO, falling back to next tier');
      return null;
    }

    // EUR price = USD price / EUR-USD rate
    // (eurUsdRate is "EUR price in USD", so 1 EUR = eurUsdRate USD)
    const eurPrice = usdPrice / eurUsdRate;

    // -----------------------------------------------------------------------
    // Step 3: Get current block number for the source URL
    // -----------------------------------------------------------------------
    let blockNumber: number;
    try {
      blockNumber = await getBlockNumber(rpcUrl);
    } catch {
      blockNumber = 0;
    }

    const sourceUrl =
      blockNumber > 0
        ? `https://flarescan.com/block/${blockNumber}`
        : 'https://flarescan.com';

    console.log(
      `[FTSO] ${normalised}: USD=${usdPrice.toFixed(6)}, ` +
        `EUR/USD=${eurUsdRate.toFixed(4)}, EUR=${eurPrice.toFixed(6)}`,
    );

    return {
      tokenSymbol: normalised,
      eurPrice,
      source: 'FTSO',
      timestamp: feedTimestamp,
      sourceUrl,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`[FTSO] Error fetching price for ${normalised}: ${message}`);
    return null;
  }
}

/**
 * Check whether a given token symbol is supported by the FTSO oracle.
 */
export function isFtsoSupported(tokenSymbol: string): boolean {
  return SUPPORTED_FTSO_TOKENS.has(tokenSymbol.toUpperCase());
}
