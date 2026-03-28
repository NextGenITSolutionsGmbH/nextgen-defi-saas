import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getCoinGeckoPrice, isCoinGeckoSupported, getRateLimitStatus } from '../coingecko';

/**
 * @spec FR-05-01..FR-05-06, EP-05 — CoinGecko historical price API (Tier 2 fallback)
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeOkResponse(eurPrice: number): Response {
  return new Response(
    JSON.stringify({
      id: 'flare-networks',
      symbol: 'flr',
      name: 'Flare',
      market_data: {
        current_price: {
          eur: eurPrice,
          usd: eurPrice * 1.08,
        },
      },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

/** Unix timestamp for 2025-03-15T12:00:00Z */
const SAMPLE_TIMESTAMP = Math.floor(new Date('2025-03-15T12:00:00Z').getTime() / 1000);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('getCoinGeckoPrice', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return null for an unmapped token symbol', async () => {
    const result = await getCoinGeckoPrice('UNKNOWNTOKEN', SAMPLE_TIMESTAMP);

    expect(result).toBeNull();
    // fetch should never be called for unmapped tokens
    expect(fetch).not.toHaveBeenCalled();
  });

  it('should return a valid PriceResult with EUR price for a mapped token', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(makeOkResponse(0.0234));

    const result = await getCoinGeckoPrice('FLR', SAMPLE_TIMESTAMP);

    expect(result).not.toBeNull();
    expect(result!.tokenSymbol).toBe('FLR');
    expect(result!.eurPrice).toBe(0.0234);
    expect(result!.source).toBe('COINGECKO');
    expect(result!.timestamp).toBe(SAMPLE_TIMESTAMP);
    expect(result!.sourceUrl).toContain('coingecko.com');
  });

  it('should normalise the token symbol to uppercase', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(makeOkResponse(0.05));

    const result = await getCoinGeckoPrice('flr', SAMPLE_TIMESTAMP);

    expect(result).not.toBeNull();
    expect(result!.tokenSymbol).toBe('FLR');
  });

  it('should format the date as DD-MM-YYYY for the CoinGecko API', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(makeOkResponse(0.05));

    await getCoinGeckoPrice('FLR', SAMPLE_TIMESTAMP);

    const calledUrl = vi.mocked(fetch).mock.calls[0]![0] as string;
    // 2025-03-15 → 15-03-2025
    expect(calledUrl).toContain('date=15-03-2025');
  });

  it('should return null on a 429 rate limit response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('Too Many Requests', { status: 429 }),
    );

    const result = await getCoinGeckoPrice('FLR', SAMPLE_TIMESTAMP);

    expect(result).toBeNull();
  });

  it('should return null on a non-200 HTTP response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('Server Error', { status: 500 }),
    );

    const result = await getCoinGeckoPrice('FLR', SAMPLE_TIMESTAMP);

    expect(result).toBeNull();
  });

  it('should return null when the EUR price is missing from the response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: 'flare-networks',
          symbol: 'flr',
          name: 'Flare',
          market_data: {
            current_price: {
              usd: 0.05,
              // eur intentionally omitted
            },
          },
        }),
        { status: 200 },
      ),
    );

    const result = await getCoinGeckoPrice('FLR', SAMPLE_TIMESTAMP);

    expect(result).toBeNull();
  });

  it('should return null when the EUR price is zero', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(makeOkResponse(0));

    const result = await getCoinGeckoPrice('FLR', SAMPLE_TIMESTAMP);

    expect(result).toBeNull();
  });

  it('should return null when the internal rate limiter rejects (>30 requests/min)', async () => {
    vi.useFakeTimers();
    // Use a far-future date so any real-time timestamps from prior tests are
    // older than the 60 s window and get purged by acquireRateLimit()
    vi.setSystemTime(new Date('2030-01-01T00:00:00Z'));

    // Make 30 successful requests to exhaust the rate limiter
    for (let i = 0; i < 30; i++) {
      vi.mocked(fetch).mockResolvedValueOnce(makeOkResponse(0.05));
      await getCoinGeckoPrice('FLR', SAMPLE_TIMESTAMP);
    }

    // The 31st request within the same minute window should be rate-limited
    const result = await getCoinGeckoPrice('FLR', SAMPLE_TIMESTAMP);

    expect(result).toBeNull();
    // fetch should have been called exactly 30 times (not 31)
    expect(fetch).toHaveBeenCalledTimes(30);
  });
});

describe('isCoinGeckoSupported', () => {
  it('should return true for a mapped token', () => {
    expect(isCoinGeckoSupported('FLR')).toBe(true);
    expect(isCoinGeckoSupported('ETH')).toBe(true);
    expect(isCoinGeckoSupported('BTC')).toBe(true);
  });

  it('should return false for an unmapped token', () => {
    expect(isCoinGeckoSupported('UNKNOWNTOKEN')).toBe(false);
    expect(isCoinGeckoSupported('SPRK')).toBe(false);
  });
});

describe('getRateLimitStatus', () => {
  it('should return correct used and remaining counts', async () => {
    vi.useFakeTimers();
    // Use a far-future date so any real-time timestamps from prior tests are
    // older than the 60 s window and get purged
    vi.setSystemTime(new Date('2031-01-01T00:00:00Z'));

    vi.stubGlobal('fetch', vi.fn());

    // Make 3 requests
    for (let i = 0; i < 3; i++) {
      vi.mocked(fetch).mockResolvedValueOnce(makeOkResponse(0.05));
      await getCoinGeckoPrice('FLR', SAMPLE_TIMESTAMP);
    }

    const status = getRateLimitStatus();

    expect(status.used).toBe(3);
    expect(status.remaining).toBe(27);
    expect(status.windowMs).toBe(60_000);

    vi.useRealTimers();
  });
});
