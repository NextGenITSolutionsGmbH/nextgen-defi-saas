// ---------------------------------------------------------------------------
// EUR Price Engine — 4-Tier Fallback Orchestrator
// FTSO → CoinGecko → CMC → MANUAL_REQUIRED
//
// Core business module for BMF-2025 tax compliance. Every on-chain
// transaction requires an EUR price at the exact timestamp, with the
// price source logged for GoBD audit trail.
//
// @spec FR-05-01..FR-05-06, EP-05 — 4-tier EUR price engine (FTSO -> CoinGecko -> CMC -> Manual)
// ---------------------------------------------------------------------------

import type { PriceResult, PriceSourceType } from '../types';
import { getFtsoPrice } from './ftso';
import { getCoinGeckoPrice } from './coingecko';
import { getCmcPrice } from './coinmarketcap';

// ---------------------------------------------------------------------------
// Audit Log Types
// ---------------------------------------------------------------------------

/**
 * Structure for a price audit log entry — records every price lookup
 * attempt and its result for GoBD-compliant audit trail.
 */
export interface PriceAuditLog {
  /** Token that was priced */
  tokenSymbol: string;
  /** Requested timestamp (Unix seconds) */
  timestampUnix: number;
  /** ISO 8601 representation of the timestamp */
  timestampIso: string;
  /** The source that was attempted (the tier that was tried) */
  attemptedSource: PriceSourceType;
  /** The source that actually delivered the price */
  resultSource: PriceSourceType;
  /** The EUR price returned */
  eurPrice: number;
  /** Why a fallback was needed (null if primary source worked) */
  fallbackReason: string | null;
  /** When this audit entry was created */
  createdAt: string;
  /** Whether the price was flagged as anomalous */
  isAnomaly: boolean;
}

// ---------------------------------------------------------------------------
// Anomaly Detection — Z-Score based
// ---------------------------------------------------------------------------

/**
 * In-memory cache of recent prices per token for Z-Score anomaly detection.
 * Key: uppercase token symbol, Value: array of recent EUR prices.
 */
const recentPricesCache: Map<string, number[]> = new Map();

/**
 * Maximum number of recent prices to keep per token for Z-Score calculation.
 */
const MAX_RECENT_PRICES = 50;

/**
 * Z-Score threshold. Prices deviating more than 3 standard deviations
 * from the recent mean are flagged as anomalies.
 */
const Z_SCORE_THRESHOLD = 3;

/**
 * Record a price in the recent prices cache for anomaly detection.
 */
function recordPrice(tokenSymbol: string, eurPrice: number): void {
  const key = tokenSymbol.toUpperCase();
  let prices = recentPricesCache.get(key);

  if (!prices) {
    prices = [];
    recentPricesCache.set(key, prices);
  }

  prices.push(eurPrice);

  // Keep only the most recent prices
  if (prices.length > MAX_RECENT_PRICES) {
    prices.splice(0, prices.length - MAX_RECENT_PRICES);
  }
}

/**
 * Calculate the Z-Score of a price relative to recent prices of the same token.
 * Returns null if insufficient data for a meaningful calculation (< 5 data points).
 */
function calculateZScore(tokenSymbol: string, eurPrice: number): number | null {
  const key = tokenSymbol.toUpperCase();
  const prices = recentPricesCache.get(key);

  if (!prices || prices.length < 5) {
    return null;
  }

  const n = prices.length;
  const mean = prices.reduce((sum, p) => sum + p, 0) / n;
  const variance = prices.reduce((sum, p) => sum + (p - mean) ** 2, 0) / n;
  const stdDev = Math.sqrt(variance);

  // Avoid division by zero (all prices identical)
  if (stdDev === 0) {
    return eurPrice === mean ? 0 : Infinity;
  }

  return (eurPrice - mean) / stdDev;
}

/**
 * Check whether a price is anomalous based on Z-Score analysis.
 */
function isAnomalousPrice(tokenSymbol: string, eurPrice: number): boolean {
  const zScore = calculateZScore(tokenSymbol, eurPrice);

  if (zScore === null) {
    // Insufficient data — cannot determine anomaly
    return false;
  }

  return Math.abs(zScore) > Z_SCORE_THRESHOLD;
}

// ---------------------------------------------------------------------------
// Custom Error
// ---------------------------------------------------------------------------

/**
 * Error thrown when all automated price sources fail and manual entry
 * is required. The caller should catch this and present a manual price
 * input form to the user.
 */
export class ManualPriceRequiredError extends Error {
  public readonly tokenSymbol: string;
  public readonly timestampUnix: number;
  public readonly attemptedSources: PriceSourceType[];
  public readonly failureReasons: string[];

  constructor(
    tokenSymbol: string,
    timestampUnix: number,
    attemptedSources: PriceSourceType[],
    failureReasons: string[],
  ) {
    const dateStr = new Date(timestampUnix * 1000).toISOString();
    super(
      `MANUAL_REQUIRED: All price sources failed for ${tokenSymbol} at ${dateStr}. ` +
        `Attempted: [${attemptedSources.join(', ')}]. ` +
        `Reasons: [${failureReasons.join('; ')}]`,
    );
    this.name = 'ManualPriceRequiredError';
    this.tokenSymbol = tokenSymbol;
    this.timestampUnix = timestampUnix;
    this.attemptedSources = attemptedSources;
    this.failureReasons = failureReasons;
  }
}

// ---------------------------------------------------------------------------
// Audit Entry Factory
// ---------------------------------------------------------------------------

/**
 * Create a PriceAuditLog-shaped object for recording in the audit trail.
 * This function is pure — it does not persist the entry; that is the
 * caller's responsibility (typically the API layer writes to the DB).
 *
 * @param tokenSymbol  The token that was priced
 * @param timestampUnix  The requested timestamp
 * @param attemptedSource  Which tier was tried
 * @param resultSource  Which tier actually delivered the result
 * @param eurPrice  The EUR price returned
 * @param fallbackReason  Why the primary source failed (optional)
 * @returns A PriceAuditLog object
 */
export function createPriceAuditEntry(
  tokenSymbol: string,
  timestampUnix: number,
  attemptedSource: PriceSourceType,
  resultSource: PriceSourceType,
  eurPrice: number,
  fallbackReason?: string,
): PriceAuditLog {
  return {
    tokenSymbol: tokenSymbol.toUpperCase(),
    timestampUnix,
    timestampIso: new Date(timestampUnix * 1000).toISOString(),
    attemptedSource,
    resultSource,
    eurPrice,
    fallbackReason: fallbackReason ?? null,
    createdAt: new Date().toISOString(),
    isAnomaly: isAnomalousPrice(tokenSymbol, eurPrice),
  };
}

// ---------------------------------------------------------------------------
// Price Engine Class
// ---------------------------------------------------------------------------

/**
 * EUR Price Engine with 4-tier fallback chain:
 *
 * 1. **FTSO** — Flare Time Series Oracle (on-chain, primary for Flare tokens)
 * 2. **CoinGecko** — Free API with historical prices
 * 3. **CMC** — CoinMarketCap paid API (requires API key)
 * 4. **MANUAL** — Throws ManualPriceRequiredError if all automated sources fail
 *
 * Every lookup is logged for GoBD audit compliance.
 */
export class PriceEngine {
  private readonly rpcUrl: string;
  private readonly cmcApiKey: string | null;
  private readonly auditLog: PriceAuditLog[] = [];

  /**
   * @param rpcUrl  JSON-RPC URL for the Flare network (required for FTSO)
   * @param cmcApiKey  CoinMarketCap API key (optional — tier 3 is skipped without it)
   */
  constructor(rpcUrl: string, cmcApiKey?: string) {
    this.rpcUrl = rpcUrl;
    this.cmcApiKey = cmcApiKey ?? null;
  }

  /**
   * Get the EUR price for a token at a specific timestamp using the
   * 4-tier fallback chain.
   *
   * @param tokenSymbol  Uppercase token symbol (e.g. "FLR", "ETH")
   * @param _tokenAddress  Token contract address (reserved for future use)
   * @param chainId  Chain ID (14 = Flare mainnet, 114 = Coston2 testnet)
   * @param timestampUnix  Unix timestamp in seconds
   * @returns PriceResult with the EUR price and source
   * @throws ManualPriceRequiredError if all automated sources fail
   */
  async getEurPrice(
    tokenSymbol: string,
    _tokenAddress: string,
    chainId: number,
    timestampUnix: number,
  ): Promise<PriceResult> {
    const normalised = tokenSymbol.toUpperCase();
    const attemptedSources: PriceSourceType[] = [];
    const failureReasons: string[] = [];

    console.log(
      `[PriceEngine] Looking up EUR price for ${normalised} ` +
        `at ${new Date(timestampUnix * 1000).toISOString()} (chain=${chainId})`,
    );

    // -------------------------------------------------------------------
    // Tier 1: FTSO On-Chain Oracle
    // Only available on Flare (chainId 14) and Coston2 testnet (chainId 114)
    // -------------------------------------------------------------------
    if (chainId === 14 || chainId === 114) {
      attemptedSources.push('FTSO');
      try {
        console.log(`[PriceEngine] Tier 1: Trying FTSO for ${normalised}...`);
        const ftsoResult = await getFtsoPrice(normalised, timestampUnix, this.rpcUrl);

        if (ftsoResult) {
          const auditEntry = createPriceAuditEntry(
            normalised,
            timestampUnix,
            'FTSO',
            'FTSO',
            ftsoResult.eurPrice,
          );
          this.auditLog.push(auditEntry);
          recordPrice(normalised, ftsoResult.eurPrice);

          if (auditEntry.isAnomaly) {
            console.log(
              `[PriceEngine] ANOMALY DETECTED: ${normalised} EUR=${ftsoResult.eurPrice} ` +
                `from FTSO deviates >3σ from recent prices`,
            );
          }

          console.log(
            `[PriceEngine] Tier 1 SUCCESS: ${normalised} = EUR ${ftsoResult.eurPrice.toFixed(6)} (FTSO)`,
          );
          return ftsoResult;
        }

        failureReasons.push('FTSO: No price available or feed stale');
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        failureReasons.push(`FTSO: ${msg}`);
        console.log(`[PriceEngine] Tier 1 FAILED: ${msg}`);
      }
    } else {
      failureReasons.push(`FTSO: Skipped — chain ${chainId} is not Flare/Coston2`);
      console.log(`[PriceEngine] Tier 1: FTSO skipped for chain ${chainId}`);
    }

    // -------------------------------------------------------------------
    // Tier 2: CoinGecko (free tier, historical)
    // -------------------------------------------------------------------
    attemptedSources.push('COINGECKO');
    try {
      console.log(`[PriceEngine] Tier 2: Trying CoinGecko for ${normalised}...`);
      const cgResult = await getCoinGeckoPrice(normalised, timestampUnix);

      if (cgResult) {
        const auditEntry = createPriceAuditEntry(
          normalised,
          timestampUnix,
          'FTSO',
          'COINGECKO',
          cgResult.eurPrice,
          failureReasons.join('; '),
        );
        this.auditLog.push(auditEntry);
        recordPrice(normalised, cgResult.eurPrice);

        if (auditEntry.isAnomaly) {
          console.log(
            `[PriceEngine] ANOMALY DETECTED: ${normalised} EUR=${cgResult.eurPrice} ` +
              `from CoinGecko deviates >3σ from recent prices`,
          );
        }

        console.log(
          `[PriceEngine] Tier 2 SUCCESS: ${normalised} = EUR ${cgResult.eurPrice.toFixed(6)} (CoinGecko)`,
        );
        return cgResult;
      }

      failureReasons.push('CoinGecko: No price data or rate limited');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      failureReasons.push(`CoinGecko: ${msg}`);
      console.log(`[PriceEngine] Tier 2 FAILED: ${msg}`);
    }

    // -------------------------------------------------------------------
    // Tier 3: CoinMarketCap (paid API key required)
    // -------------------------------------------------------------------
    if (this.cmcApiKey) {
      attemptedSources.push('CMC');
      try {
        console.log(`[PriceEngine] Tier 3: Trying CMC for ${normalised}...`);
        const cmcResult = await getCmcPrice(normalised, timestampUnix, this.cmcApiKey);

        if (cmcResult) {
          const auditEntry = createPriceAuditEntry(
            normalised,
            timestampUnix,
            'FTSO',
            'CMC',
            cmcResult.eurPrice,
            failureReasons.join('; '),
          );
          this.auditLog.push(auditEntry);
          recordPrice(normalised, cmcResult.eurPrice);

          if (auditEntry.isAnomaly) {
            console.log(
              `[PriceEngine] ANOMALY DETECTED: ${normalised} EUR=${cmcResult.eurPrice} ` +
                `from CMC deviates >3σ from recent prices`,
            );
          }

          console.log(
            `[PriceEngine] Tier 3 SUCCESS: ${normalised} = EUR ${cmcResult.eurPrice.toFixed(6)} (CMC)`,
          );
          return cmcResult;
        }

        failureReasons.push('CMC: No price data returned');
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        failureReasons.push(`CMC: ${msg}`);
        console.log(`[PriceEngine] Tier 3 FAILED: ${msg}`);
      }
    } else {
      failureReasons.push('CMC: Skipped — no API key configured');
      console.log('[PriceEngine] Tier 3: CMC skipped — no API key');
    }

    // -------------------------------------------------------------------
    // Tier 4: All automated sources failed — manual entry required
    // -------------------------------------------------------------------
    console.log(
      `[PriceEngine] ALL TIERS FAILED for ${normalised}. ` +
        `Manual price entry required.`,
    );

    // Create audit entry for the failure
    this.auditLog.push({
      tokenSymbol: normalised,
      timestampUnix,
      timestampIso: new Date(timestampUnix * 1000).toISOString(),
      attemptedSource: attemptedSources[0] ?? 'FTSO',
      resultSource: 'MANUAL',
      eurPrice: 0,
      fallbackReason: failureReasons.join('; '),
      createdAt: new Date().toISOString(),
      isAnomaly: false,
    });

    throw new ManualPriceRequiredError(
      normalised,
      timestampUnix,
      attemptedSources,
      failureReasons,
    );
  }

  /**
   * Get the full audit log of all price lookups performed by this engine instance.
   * Used for GoBD-compliant audit trail persistence.
   */
  getAuditLog(): ReadonlyArray<PriceAuditLog> {
    return this.auditLog;
  }

  /**
   * Get the most recent audit entries (last N).
   */
  getRecentAuditEntries(count: number = 10): ReadonlyArray<PriceAuditLog> {
    return this.auditLog.slice(-count);
  }

  /**
   * Clear the in-memory audit log. Call this after persisting entries to the database.
   */
  clearAuditLog(): void {
    this.auditLog.length = 0;
  }

  /**
   * Get the Z-Score anomaly detection stats for a given token.
   * Useful for monitoring and debugging.
   */
  getAnomalyStats(tokenSymbol: string): {
    dataPoints: number;
    mean: number | null;
    stdDev: number | null;
  } {
    const key = tokenSymbol.toUpperCase();
    const prices = recentPricesCache.get(key);

    if (!prices || prices.length === 0) {
      return { dataPoints: 0, mean: null, stdDev: null };
    }

    const n = prices.length;
    const mean = prices.reduce((sum, p) => sum + p, 0) / n;
    const variance = prices.reduce((sum, p) => sum + (p - mean) ** 2, 0) / n;
    const stdDev = Math.sqrt(variance);

    return { dataPoints: n, mean, stdDev };
  }
}
