import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCmcPrice, isCmcSupported } from '../coinmarketcap';

/**
 * @spec FR-05-01..FR-05-06, EP-05 — CoinMarketCap historical price API (Tier 3 fallback)
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SAMPLE_API_KEY = 'test-cmc-api-key-abc123';

/** Unix timestamp for 2025-03-15T12:00:00Z */
const SAMPLE_TIMESTAMP = Math.floor(new Date('2025-03-15T12:00:00Z').getTime() / 1000);

function makeCmcResponse(
  eurPrice: number,
  quoteTimestamp: string = '2025-03-15T12:00:00.000Z',
  errorCode: number = 0,
  errorMessage: string | null = null,
): Response {
  return new Response(
    JSON.stringify({
      status: {
        error_code: errorCode,
        error_message: errorMessage,
      },
      data: {
        quotes: [
          {
            timestamp: quoteTimestamp,
            quote: {
              EUR: {
                price: eurPrice,
                timestamp: quoteTimestamp,
              },
            },
          },
        ],
      },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

function makeCmcMultiQuoteResponse(
  quotes: Array<{ eurPrice: number; timestamp: string }>,
): Response {
  return new Response(
    JSON.stringify({
      status: {
        error_code: 0,
        error_message: null,
      },
      data: {
        quotes: quotes.map((q) => ({
          timestamp: q.timestamp,
          quote: {
            EUR: {
              price: q.eurPrice,
              timestamp: q.timestamp,
            },
          },
        })),
      },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('getCmcPrice', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('should return null for an unmapped token symbol', async () => {
    const result = await getCmcPrice('UNKNOWNTOKEN', SAMPLE_TIMESTAMP, SAMPLE_API_KEY);

    expect(result).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('should return null when the API key is an empty string', async () => {
    const result = await getCmcPrice('FLR', SAMPLE_TIMESTAMP, '');

    expect(result).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('should return a valid PriceResult with EUR price', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(makeCmcResponse(0.0234));

    const result = await getCmcPrice('FLR', SAMPLE_TIMESTAMP, SAMPLE_API_KEY);

    expect(result).not.toBeNull();
    expect(result!.tokenSymbol).toBe('FLR');
    expect(result!.eurPrice).toBe(0.0234);
    expect(result!.source).toBe('CMC');
    expect(result!.sourceUrl).toContain('coinmarketcap.com');
  });

  it('should pass the correct X-CMC_PRO_API_KEY header', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(makeCmcResponse(0.05));

    await getCmcPrice('FLR', SAMPLE_TIMESTAMP, SAMPLE_API_KEY);

    expect(fetch).toHaveBeenCalledTimes(1);
    const callArgs = vi.mocked(fetch).mock.calls[0]!;
    const requestInit = callArgs[1] as RequestInit;
    const headers = requestInit.headers as Record<string, string>;
    expect(headers['X-CMC_PRO_API_KEY']).toBe(SAMPLE_API_KEY);
  });

  it('should pick the closest quote to the target timestamp from multiple quotes', async () => {
    // Target is 2025-03-15T12:00:00Z
    // Provide two quotes: one 2 hours before, one 30 minutes after
    const twoHoursBefore = '2025-03-15T10:00:00.000Z';
    const thirtyMinAfter = '2025-03-15T12:30:00.000Z';

    vi.mocked(fetch).mockResolvedValueOnce(
      makeCmcMultiQuoteResponse([
        { eurPrice: 0.04, timestamp: twoHoursBefore },
        { eurPrice: 0.05, timestamp: thirtyMinAfter },
      ]),
    );

    const result = await getCmcPrice('FLR', SAMPLE_TIMESTAMP, SAMPLE_API_KEY);

    expect(result).not.toBeNull();
    // 30 minutes after is closer than 2 hours before
    expect(result!.eurPrice).toBe(0.05);
  });

  it('should return null on a 401 authentication error', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('Unauthorized', { status: 401 }),
    );

    const result = await getCmcPrice('FLR', SAMPLE_TIMESTAMP, SAMPLE_API_KEY);

    expect(result).toBeNull();
  });

  it('should return null on a 403 authentication error', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('Forbidden', { status: 403 }),
    );

    const result = await getCmcPrice('FLR', SAMPLE_TIMESTAMP, SAMPLE_API_KEY);

    expect(result).toBeNull();
  });

  it('should return null on a 429 rate limit response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('Too Many Requests', { status: 429 }),
    );

    const result = await getCmcPrice('FLR', SAMPLE_TIMESTAMP, SAMPLE_API_KEY);

    expect(result).toBeNull();
  });

  it('should return null when the API returns a non-zero error_code', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      makeCmcResponse(0.05, '2025-03-15T12:00:00.000Z', 1001, 'Invalid API key'),
    );

    const result = await getCmcPrice('FLR', SAMPLE_TIMESTAMP, SAMPLE_API_KEY);

    expect(result).toBeNull();
  });

  it('should return null when no quotes are returned', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: { error_code: 0, error_message: null },
          data: { quotes: [] },
        }),
        { status: 200 },
      ),
    );

    const result = await getCmcPrice('FLR', SAMPLE_TIMESTAMP, SAMPLE_API_KEY);

    expect(result).toBeNull();
  });
});

describe('isCmcSupported', () => {
  it('should return true for a mapped token', () => {
    expect(isCmcSupported('FLR')).toBe(true);
    expect(isCmcSupported('ETH')).toBe(true);
    expect(isCmcSupported('BTC')).toBe(true);
    expect(isCmcSupported('USDT')).toBe(true);
  });

  it('should return false for an unmapped token', () => {
    expect(isCmcSupported('UNKNOWNTOKEN')).toBe(false);
    expect(isCmcSupported('SPRK')).toBe(false);
  });
});
