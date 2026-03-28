import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PriceEngine, ManualPriceRequiredError, createPriceAuditEntry } from '../price-engine';
import type { PriceResult } from '../../types';

/**
 * @spec FR-05-01..FR-05-06, EP-05 — 4-tier EUR price engine (FTSO -> CoinGecko -> CMC -> Manual)
 */

// ---------------------------------------------------------------------------
// Mock the three sub-modules
// ---------------------------------------------------------------------------

vi.mock('../ftso', () => ({
  getFtsoPrice: vi.fn(),
}));

vi.mock('../coingecko', () => ({
  getCoinGeckoPrice: vi.fn(),
}));

vi.mock('../coinmarketcap', () => ({
  getCmcPrice: vi.fn(),
}));

import { getFtsoPrice } from '../ftso';
import { getCoinGeckoPrice } from '../coingecko';
import { getCmcPrice } from '../coinmarketcap';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FLARE_RPC = 'https://flare-api.flare.network/ext/C/rpc';
const CMC_API_KEY = 'test-cmc-key';
const SAMPLE_TIMESTAMP = Math.floor(new Date('2025-03-15T12:00:00Z').getTime() / 1000);
const FLARE_CHAIN_ID = 14;
const ETH_CHAIN_ID = 1;
const TOKEN_ADDRESS = '0x0000000000000000000000000000000000000000';

function makePriceResult(
  source: PriceResult['source'],
  eurPrice: number = 0.05,
  tokenSymbol: string = 'FLR',
): PriceResult {
  return {
    tokenSymbol,
    eurPrice,
    source,
    timestamp: SAMPLE_TIMESTAMP,
    sourceUrl: `https://example.com/${source.toLowerCase()}`,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PriceEngine.getEurPrice — tier orchestration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Tier 1: FTSO
  // -------------------------------------------------------------------------

  it('should return the FTSO result when FTSO succeeds on Flare chain (chainId=14)', async () => {
    const ftsoResult = makePriceResult('FTSO', 0.023);
    vi.mocked(getFtsoPrice).mockResolvedValueOnce(ftsoResult);

    const engine = new PriceEngine(FLARE_RPC, CMC_API_KEY);
    const result = await engine.getEurPrice('FLR', TOKEN_ADDRESS, FLARE_CHAIN_ID, SAMPLE_TIMESTAMP);

    expect(result).toEqual(ftsoResult);
    expect(getFtsoPrice).toHaveBeenCalledWith('FLR', SAMPLE_TIMESTAMP, FLARE_RPC);
    // CoinGecko and CMC should NOT be called
    expect(getCoinGeckoPrice).not.toHaveBeenCalled();
    expect(getCmcPrice).not.toHaveBeenCalled();
  });

  it('should skip FTSO and try CoinGecko for non-Flare chains (chainId=1)', async () => {
    const cgResult = makePriceResult('COINGECKO', 2500.0, 'ETH');
    vi.mocked(getCoinGeckoPrice).mockResolvedValueOnce(cgResult);

    const engine = new PriceEngine(FLARE_RPC, CMC_API_KEY);
    const result = await engine.getEurPrice('ETH', TOKEN_ADDRESS, ETH_CHAIN_ID, SAMPLE_TIMESTAMP);

    expect(result).toEqual(cgResult);
    expect(getFtsoPrice).not.toHaveBeenCalled();
    expect(getCoinGeckoPrice).toHaveBeenCalledWith('ETH', SAMPLE_TIMESTAMP);
  });

  // -------------------------------------------------------------------------
  // Tier 2: CoinGecko fallback
  // -------------------------------------------------------------------------

  it('should fall back to CoinGecko when FTSO returns null', async () => {
    vi.mocked(getFtsoPrice).mockResolvedValueOnce(null);
    const cgResult = makePriceResult('COINGECKO', 0.024);
    vi.mocked(getCoinGeckoPrice).mockResolvedValueOnce(cgResult);

    const engine = new PriceEngine(FLARE_RPC, CMC_API_KEY);
    const result = await engine.getEurPrice('FLR', TOKEN_ADDRESS, FLARE_CHAIN_ID, SAMPLE_TIMESTAMP);

    expect(result).toEqual(cgResult);
    expect(getFtsoPrice).toHaveBeenCalled();
    expect(getCoinGeckoPrice).toHaveBeenCalled();
  });

  it('should fall back to CoinGecko when FTSO throws an error', async () => {
    vi.mocked(getFtsoPrice).mockRejectedValueOnce(new Error('RPC timeout'));
    const cgResult = makePriceResult('COINGECKO', 0.024);
    vi.mocked(getCoinGeckoPrice).mockResolvedValueOnce(cgResult);

    const engine = new PriceEngine(FLARE_RPC, CMC_API_KEY);
    const result = await engine.getEurPrice('FLR', TOKEN_ADDRESS, FLARE_CHAIN_ID, SAMPLE_TIMESTAMP);

    expect(result).toEqual(cgResult);
  });

  // -------------------------------------------------------------------------
  // Tier 3: CMC fallback
  // -------------------------------------------------------------------------

  it('should fall back to CMC when FTSO and CoinGecko both fail', async () => {
    vi.mocked(getFtsoPrice).mockResolvedValueOnce(null);
    vi.mocked(getCoinGeckoPrice).mockResolvedValueOnce(null);
    const cmcResult = makePriceResult('CMC', 0.025);
    vi.mocked(getCmcPrice).mockResolvedValueOnce(cmcResult);

    const engine = new PriceEngine(FLARE_RPC, CMC_API_KEY);
    const result = await engine.getEurPrice('FLR', TOKEN_ADDRESS, FLARE_CHAIN_ID, SAMPLE_TIMESTAMP);

    expect(result).toEqual(cmcResult);
    expect(getCmcPrice).toHaveBeenCalledWith('FLR', SAMPLE_TIMESTAMP, CMC_API_KEY);
  });

  it('should skip the CMC tier when no API key is configured', async () => {
    vi.mocked(getFtsoPrice).mockResolvedValueOnce(null);
    vi.mocked(getCoinGeckoPrice).mockResolvedValueOnce(null);

    const engine = new PriceEngine(FLARE_RPC); // No CMC key
    await expect(
      engine.getEurPrice('FLR', TOKEN_ADDRESS, FLARE_CHAIN_ID, SAMPLE_TIMESTAMP),
    ).rejects.toThrow(ManualPriceRequiredError);

    expect(getCmcPrice).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Tier 4: All fail — ManualPriceRequiredError
  // -------------------------------------------------------------------------

  it('should throw ManualPriceRequiredError when all tiers fail', async () => {
    vi.mocked(getFtsoPrice).mockResolvedValueOnce(null);
    vi.mocked(getCoinGeckoPrice).mockResolvedValueOnce(null);
    vi.mocked(getCmcPrice).mockResolvedValueOnce(null);

    const engine = new PriceEngine(FLARE_RPC, CMC_API_KEY);

    try {
      await engine.getEurPrice('FLR', TOKEN_ADDRESS, FLARE_CHAIN_ID, SAMPLE_TIMESTAMP);
      // Should not reach here
      expect.unreachable('Expected ManualPriceRequiredError to be thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ManualPriceRequiredError);
      const manualError = error as ManualPriceRequiredError;
      expect(manualError.tokenSymbol).toBe('FLR');
      expect(manualError.timestampUnix).toBe(SAMPLE_TIMESTAMP);
      expect(manualError.attemptedSources).toContain('FTSO');
      expect(manualError.attemptedSources).toContain('COINGECKO');
      expect(manualError.attemptedSources).toContain('CMC');
      expect(manualError.failureReasons.length).toBeGreaterThan(0);
    }
  });
});

describe('PriceEngine.getEurPrice — audit log', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should record a successful FTSO lookup in the audit log', async () => {
    const ftsoResult = makePriceResult('FTSO', 0.023);
    vi.mocked(getFtsoPrice).mockResolvedValueOnce(ftsoResult);

    const engine = new PriceEngine(FLARE_RPC, CMC_API_KEY);
    await engine.getEurPrice('FLR', TOKEN_ADDRESS, FLARE_CHAIN_ID, SAMPLE_TIMESTAMP);

    const auditLog = engine.getAuditLog();
    expect(auditLog).toHaveLength(1);
    expect(auditLog[0]!.attemptedSource).toBe('FTSO');
    expect(auditLog[0]!.resultSource).toBe('FTSO');
    expect(auditLog[0]!.eurPrice).toBe(0.023);
    expect(auditLog[0]!.fallbackReason).toBeNull();
  });

  it('should record a fallback from FTSO to CoinGecko with a reason', async () => {
    vi.mocked(getFtsoPrice).mockResolvedValueOnce(null);
    const cgResult = makePriceResult('COINGECKO', 0.024);
    vi.mocked(getCoinGeckoPrice).mockResolvedValueOnce(cgResult);

    const engine = new PriceEngine(FLARE_RPC, CMC_API_KEY);
    await engine.getEurPrice('FLR', TOKEN_ADDRESS, FLARE_CHAIN_ID, SAMPLE_TIMESTAMP);

    const auditLog = engine.getAuditLog();
    expect(auditLog).toHaveLength(1);
    expect(auditLog[0]!.attemptedSource).toBe('FTSO');
    expect(auditLog[0]!.resultSource).toBe('COINGECKO');
    expect(auditLog[0]!.eurPrice).toBe(0.024);
    expect(auditLog[0]!.fallbackReason).toBeTruthy();
    expect(auditLog[0]!.fallbackReason).toContain('FTSO');
  });

  it('should record a failure entry when all sources fail', async () => {
    vi.mocked(getFtsoPrice).mockResolvedValueOnce(null);
    vi.mocked(getCoinGeckoPrice).mockResolvedValueOnce(null);
    vi.mocked(getCmcPrice).mockResolvedValueOnce(null);

    const engine = new PriceEngine(FLARE_RPC, CMC_API_KEY);

    try {
      await engine.getEurPrice('FLR', TOKEN_ADDRESS, FLARE_CHAIN_ID, SAMPLE_TIMESTAMP);
    } catch {
      // Expected ManualPriceRequiredError
    }

    const auditLog = engine.getAuditLog();
    expect(auditLog).toHaveLength(1);
    expect(auditLog[0]!.resultSource).toBe('MANUAL');
    expect(auditLog[0]!.eurPrice).toBe(0);
    expect(auditLog[0]!.fallbackReason).toBeTruthy();
  });
});

describe('PriceEngine — auxiliary methods', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should return recent audit entries via getRecentAuditEntries()', async () => {
    vi.mocked(getFtsoPrice).mockResolvedValue(makePriceResult('FTSO', 0.023));

    const engine = new PriceEngine(FLARE_RPC, CMC_API_KEY);

    // Perform 3 lookups
    await engine.getEurPrice('FLR', TOKEN_ADDRESS, FLARE_CHAIN_ID, SAMPLE_TIMESTAMP);
    await engine.getEurPrice('FLR', TOKEN_ADDRESS, FLARE_CHAIN_ID, SAMPLE_TIMESTAMP + 1);
    await engine.getEurPrice('FLR', TOKEN_ADDRESS, FLARE_CHAIN_ID, SAMPLE_TIMESTAMP + 2);

    const recent = engine.getRecentAuditEntries(2);
    expect(recent).toHaveLength(2);
  });

  it('should clear the audit log via clearAuditLog()', async () => {
    vi.mocked(getFtsoPrice).mockResolvedValueOnce(makePriceResult('FTSO', 0.023));

    const engine = new PriceEngine(FLARE_RPC, CMC_API_KEY);
    await engine.getEurPrice('FLR', TOKEN_ADDRESS, FLARE_CHAIN_ID, SAMPLE_TIMESTAMP);

    expect(engine.getAuditLog()).toHaveLength(1);

    engine.clearAuditLog();

    expect(engine.getAuditLog()).toHaveLength(0);
  });

  it('should return anomaly stats via getAnomalyStats()', async () => {
    vi.mocked(getFtsoPrice).mockResolvedValue(makePriceResult('FTSO', 0.023));

    const engine = new PriceEngine(FLARE_RPC, CMC_API_KEY);
    await engine.getEurPrice('FLR', TOKEN_ADDRESS, FLARE_CHAIN_ID, SAMPLE_TIMESTAMP);

    const stats = engine.getAnomalyStats('FLR');
    expect(stats.dataPoints).toBeGreaterThanOrEqual(1);
    expect(stats.mean).not.toBeNull();
  });

  it('should return empty anomaly stats for unknown tokens', () => {
    const engine = new PriceEngine(FLARE_RPC, CMC_API_KEY);

    const stats = engine.getAnomalyStats('NODATA');
    expect(stats.dataPoints).toBe(0);
    expect(stats.mean).toBeNull();
    expect(stats.stdDev).toBeNull();
  });
});

describe('PriceEngine — Coston2 testnet support', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should attempt FTSO on Coston2 testnet (chainId=114)', async () => {
    const ftsoResult = makePriceResult('FTSO', 0.023);
    vi.mocked(getFtsoPrice).mockResolvedValueOnce(ftsoResult);

    const engine = new PriceEngine(FLARE_RPC, CMC_API_KEY);
    const result = await engine.getEurPrice('FLR', TOKEN_ADDRESS, 114, SAMPLE_TIMESTAMP);

    expect(result).toEqual(ftsoResult);
    expect(getFtsoPrice).toHaveBeenCalled();
  });
});

describe('ManualPriceRequiredError', () => {
  it('should contain token symbol, timestamp, attempted sources, and reasons', () => {
    const error = new ManualPriceRequiredError(
      'FLR',
      SAMPLE_TIMESTAMP,
      ['FTSO', 'COINGECKO', 'CMC'],
      ['FTSO: stale feed', 'CoinGecko: rate limited', 'CMC: no data'],
    );

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ManualPriceRequiredError');
    expect(error.tokenSymbol).toBe('FLR');
    expect(error.timestampUnix).toBe(SAMPLE_TIMESTAMP);
    expect(error.attemptedSources).toEqual(['FTSO', 'COINGECKO', 'CMC']);
    expect(error.failureReasons).toHaveLength(3);
    expect(error.message).toContain('MANUAL_REQUIRED');
    expect(error.message).toContain('FLR');
  });
});

describe('createPriceAuditEntry', () => {
  it('should create a well-formed audit entry', () => {
    const entry = createPriceAuditEntry('flr', SAMPLE_TIMESTAMP, 'FTSO', 'FTSO', 0.023);

    expect(entry.tokenSymbol).toBe('FLR');
    expect(entry.timestampUnix).toBe(SAMPLE_TIMESTAMP);
    expect(entry.timestampIso).toBe(new Date(SAMPLE_TIMESTAMP * 1000).toISOString());
    expect(entry.attemptedSource).toBe('FTSO');
    expect(entry.resultSource).toBe('FTSO');
    expect(entry.eurPrice).toBe(0.023);
    expect(entry.fallbackReason).toBeNull();
    expect(entry.createdAt).toBeTruthy();
    expect(typeof entry.isAnomaly).toBe('boolean');
  });

  it('should include a fallback reason when provided', () => {
    const entry = createPriceAuditEntry(
      'FLR',
      SAMPLE_TIMESTAMP,
      'FTSO',
      'COINGECKO',
      0.024,
      'FTSO feed was stale',
    );

    expect(entry.fallbackReason).toBe('FTSO feed was stale');
    expect(entry.resultSource).toBe('COINGECKO');
  });
});
