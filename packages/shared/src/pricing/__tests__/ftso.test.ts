import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getFtsoPrice, isFtsoSupported } from '../ftso';

/**
 * @spec FR-05-01, EP-05 — FTSO on-chain price oracle (primary source)
 *
 * Unit tests for the Flare FTSO on-chain price oracle module.
 * All fetch calls are mocked — no network access required.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FLARE_RPC_URL = 'https://flare-api.flare.network/ext/C/rpc';

/** Current Unix timestamp in seconds, used as the "now" reference point. */
const NOW_SECONDS = Math.floor(Date.now() / 1000);

/**
 * ABI-encode a tuple (uint256 price, uint256 decimals, uint256 timestamp)
 * into a `0x`-prefixed hex string, matching the FTSO
 * `getCurrentPriceWithDecimalsAndTimestamp` return format.
 */
function encodePriceResponse(
  price: bigint,
  decimals: bigint,
  timestamp: bigint,
): string {
  const p = price.toString(16).padStart(64, '0');
  const d = decimals.toString(16).padStart(64, '0');
  const t = timestamp.toString(16).padStart(64, '0');
  return '0x' + p + d + t;
}

/** Build a successful JSON-RPC fetch Response for an eth_call. */
function rpcSuccess(result: string) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => ({ jsonrpc: '2.0', id: 1, result }),
  } as unknown as Response;
}

/** Build a JSON-RPC response that contains an error object. */
function rpcError(code: number, message: string) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => ({ jsonrpc: '2.0', id: 1, error: { code, message } }),
  } as unknown as Response;
}

/** Build an HTTP-level error response (non-200). */
function httpError(status: number) {
  return {
    ok: false,
    status,
    statusText: 'Internal Server Error',
    json: async () => ({}),
  } as unknown as Response;
}

/** Build a JSON-RPC success response for eth_blockNumber. */
function blockNumberResponse(blockNum: number) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => ({
      jsonrpc: '2.0',
      id: 1,
      result: '0x' + blockNum.toString(16),
    }),
  } as unknown as Response;
}

/**
 * Configure fetch mock to return a valid token price + EUR rate + block number.
 *
 * Call order:
 *  1. eth_call for token USD price
 *  2. eth_call for EUR/USD rate
 *  3. eth_blockNumber
 */
function mockSuccessfulFtsoFetch(
  fetchMock: ReturnType<typeof vi.fn>,
  opts: {
    tokenPriceUsd?: bigint;
    tokenDecimals?: bigint;
    tokenTimestamp?: bigint;
    eurPriceUsd?: bigint;
    eurDecimals?: bigint;
    blockNumber?: number;
  } = {},
) {
  const {
    tokenPriceUsd = 2500n,   // 0.025 USD with 5 decimals
    tokenDecimals = 5n,
    tokenTimestamp = BigInt(NOW_SECONDS),
    eurPriceUsd = 108000n,    // 1.08 USD with 5 decimals
    eurDecimals = 5n,
    blockNumber = 12345678,
  } = opts;

  const tokenResponse = encodePriceResponse(tokenPriceUsd, tokenDecimals, tokenTimestamp);
  const eurResponse = encodePriceResponse(eurPriceUsd, eurDecimals, tokenTimestamp);

  fetchMock
    .mockResolvedValueOnce(rpcSuccess(tokenResponse))   // token USD price
    .mockResolvedValueOnce(rpcSuccess(eurResponse))       // EUR/USD rate
    .mockResolvedValueOnce(blockNumberResponse(blockNumber)); // eth_blockNumber
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FTSO Price Oracle [FR-05-01, EP-05]', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock;
    // Suppress console.log noise in test output
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // 1. Unsupported token
  // -------------------------------------------------------------------------
  it('returns null for unsupported token', async () => {
    const result = await getFtsoPrice('UNKNOWN', NOW_SECONDS, FLARE_RPC_URL);

    expect(result).toBeNull();
    // Should not make any fetch calls for an unsupported token
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // 2. Valid PriceResult for supported token
  // -------------------------------------------------------------------------
  it('returns valid PriceResult with EUR price for supported token (FLR)', async () => {
    // Token: 2500 raw, 5 decimals = 0.025 USD
    // EUR rate: 108000 raw, 5 decimals = 1.08 USD per EUR
    // EUR price = 0.025 / 1.08 ~ 0.023148
    mockSuccessfulFtsoFetch(fetchMock);

    const result = await getFtsoPrice('FLR', NOW_SECONDS, FLARE_RPC_URL);

    expect(result).not.toBeNull();
    expect(result!.tokenSymbol).toBe('FLR');
    expect(result!.source).toBe('FTSO');
    expect(result!.eurPrice).toBeCloseTo(0.025 / 1.08, 5);
    expect(result!.timestamp).toBe(NOW_SECONDS);
    expect(result!.sourceUrl).toContain('flarescan.com');
  });

  // -------------------------------------------------------------------------
  // 3. Wrapped token mapping
  // -------------------------------------------------------------------------
  it('correctly maps wrapped tokens (WFLR -> FLR)', async () => {
    mockSuccessfulFtsoFetch(fetchMock);

    const result = await getFtsoPrice('WFLR', NOW_SECONDS, FLARE_RPC_URL);

    expect(result).not.toBeNull();
    // The result should normalize to the uppercase symbol
    expect(result!.tokenSymbol).toBe('WFLR');
    expect(result!.source).toBe('FTSO');
    // Verify the fetch was called (meaning the FTSO symbol mapping worked)
    expect(fetchMock).toHaveBeenCalled();
  });

  it('correctly maps WETH -> ETH', async () => {
    mockSuccessfulFtsoFetch(fetchMock);

    const result = await getFtsoPrice('WETH', NOW_SECONDS, FLARE_RPC_URL);

    expect(result).not.toBeNull();
    expect(result!.tokenSymbol).toBe('WETH');
    expect(result!.source).toBe('FTSO');
  });

  // -------------------------------------------------------------------------
  // 4. Normalizes token symbol to uppercase
  // -------------------------------------------------------------------------
  it('normalizes token symbol to uppercase', async () => {
    mockSuccessfulFtsoFetch(fetchMock);

    const result = await getFtsoPrice('flr', NOW_SECONDS, FLARE_RPC_URL);

    expect(result).not.toBeNull();
    expect(result!.tokenSymbol).toBe('FLR');
  });

  // -------------------------------------------------------------------------
  // 5. Stale price feed
  // -------------------------------------------------------------------------
  it('returns null when FTSO feed is stale (age > threshold)', async () => {
    // Set the feed timestamp 600 seconds (10 min) behind the requested timestamp
    // Threshold is 300s (5 min), so this should be stale
    const staleTimestamp = BigInt(NOW_SECONDS - 600);
    const tokenResponse = encodePriceResponse(2500n, 5n, staleTimestamp);

    fetchMock.mockResolvedValueOnce(rpcSuccess(tokenResponse));

    const result = await getFtsoPrice('FLR', NOW_SECONDS, FLARE_RPC_URL);

    expect(result).toBeNull();
  });

  // -------------------------------------------------------------------------
  // 6. Zero or negative USD price
  // -------------------------------------------------------------------------
  it('returns null when raw USD price is zero', async () => {
    const tokenResponse = encodePriceResponse(0n, 5n, BigInt(NOW_SECONDS));

    fetchMock.mockResolvedValueOnce(rpcSuccess(tokenResponse));

    const result = await getFtsoPrice('FLR', NOW_SECONDS, FLARE_RPC_URL);

    expect(result).toBeNull();
  });

  // -------------------------------------------------------------------------
  // 7. EUR/USD feed call fails
  // -------------------------------------------------------------------------
  it('returns null when EUR/USD feed call fails', async () => {
    const tokenResponse = encodePriceResponse(2500n, 5n, BigInt(NOW_SECONDS));

    fetchMock
      .mockResolvedValueOnce(rpcSuccess(tokenResponse))   // token price OK
      .mockRejectedValueOnce(new Error('EUR feed error')); // EUR/USD call fails

    const result = await getFtsoPrice('FLR', NOW_SECONDS, FLARE_RPC_URL);

    expect(result).toBeNull();
  });

  // -------------------------------------------------------------------------
  // 8. EUR/USD rate is zero or negative
  // -------------------------------------------------------------------------
  it('returns null when EUR/USD rate is zero', async () => {
    const tokenResponse = encodePriceResponse(2500n, 5n, BigInt(NOW_SECONDS));
    const eurResponse = encodePriceResponse(0n, 5n, BigInt(NOW_SECONDS));

    fetchMock
      .mockResolvedValueOnce(rpcSuccess(tokenResponse))
      .mockResolvedValueOnce(rpcSuccess(eurResponse));

    const result = await getFtsoPrice('FLR', NOW_SECONDS, FLARE_RPC_URL);

    expect(result).toBeNull();
  });

  // -------------------------------------------------------------------------
  // 9. RPC HTTP error (non-200 response)
  // -------------------------------------------------------------------------
  it('returns null when RPC returns HTTP error (non-200)', async () => {
    fetchMock.mockResolvedValueOnce(httpError(500));

    const result = await getFtsoPrice('FLR', NOW_SECONDS, FLARE_RPC_URL);

    expect(result).toBeNull();
  });

  // -------------------------------------------------------------------------
  // 10. RPC JSON-RPC error response
  // -------------------------------------------------------------------------
  it('returns null when RPC returns JSON-RPC error response', async () => {
    fetchMock.mockResolvedValueOnce(rpcError(-32000, 'execution reverted'));

    const result = await getFtsoPrice('FLR', NOW_SECONDS, FLARE_RPC_URL);

    expect(result).toBeNull();
  });

  // -------------------------------------------------------------------------
  // 11. RPC empty result ("0x")
  // -------------------------------------------------------------------------
  it('returns null when RPC returns empty result "0x"', async () => {
    fetchMock.mockResolvedValueOnce(rpcSuccess('0x'));

    // ethCall throws on "0x" result, which getFtsoPrice catches and returns null
    const result = await getFtsoPrice('FLR', NOW_SECONDS, FLARE_RPC_URL);

    // The rpcSuccess helper returns a Response with result '0x', but the
    // ethCall function treats '0x' as empty and throws. Since we pass it
    // through rpcSuccess (ok: true, status: 200), ethCall will parse it
    // and throw "FTSO RPC returned empty result".
    expect(result).toBeNull();
  });

  // -------------------------------------------------------------------------
  // 12. sourceUrl includes flarescan block link
  // -------------------------------------------------------------------------
  it('includes correct sourceUrl with block number', async () => {
    const blockNumber = 9999999;
    mockSuccessfulFtsoFetch(fetchMock, { blockNumber });

    const result = await getFtsoPrice('FLR', NOW_SECONDS, FLARE_RPC_URL);

    expect(result).not.toBeNull();
    expect(result!.sourceUrl).toBe(`https://flarescan.com/block/${blockNumber}`);
  });

  it('falls back to base flarescan URL when block number fetch fails', async () => {
    const tokenResponse = encodePriceResponse(2500n, 5n, BigInt(NOW_SECONDS));
    const eurResponse = encodePriceResponse(108000n, 5n, BigInt(NOW_SECONDS));

    fetchMock
      .mockResolvedValueOnce(rpcSuccess(tokenResponse))
      .mockResolvedValueOnce(rpcSuccess(eurResponse))
      .mockRejectedValueOnce(new Error('block number fetch failed'));

    const result = await getFtsoPrice('FLR', NOW_SECONDS, FLARE_RPC_URL);

    expect(result).not.toBeNull();
    expect(result!.sourceUrl).toBe('https://flarescan.com');
  });
});

// ---------------------------------------------------------------------------
// isFtsoSupported
// ---------------------------------------------------------------------------

describe('isFtsoSupported [FR-05-01]', () => {
  it('returns true for supported tokens', () => {
    const supportedTokens = [
      'FLR', 'WFLR', 'SGB', 'WSGB', 'XRP', 'FXRP', 'BTC', 'WBTC',
      'ETH', 'WETH', 'USDT', 'USDC', 'LTC', 'DOGE', 'ADA', 'SOL',
      'AVAX', 'MATIC', 'DOT', 'FIL', 'ARB',
    ];

    for (const token of supportedTokens) {
      expect(isFtsoSupported(token)).toBe(true);
    }
  });

  it('returns false for unsupported tokens', () => {
    expect(isFtsoSupported('UNKNOWN')).toBe(false);
    expect(isFtsoSupported('SPRK')).toBe(false);
    expect(isFtsoSupported('kFLR')).toBe(false);
    expect(isFtsoSupported('')).toBe(false);
  });

  it('normalizes to uppercase before checking support', () => {
    expect(isFtsoSupported('flr')).toBe(true);
    expect(isFtsoSupported('Wflr')).toBe(true);
    expect(isFtsoSupported('eth')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Chain ID behavior (only Flare mainnet chainId 14 RPC should work)
// ---------------------------------------------------------------------------

describe('FTSO chain ID behavior [FR-05-01]', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock;
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('works correctly with the Flare mainnet RPC URL (chain 14)', async () => {
    mockSuccessfulFtsoFetch(fetchMock);

    const result = await getFtsoPrice(
      'FLR',
      NOW_SECONDS,
      'https://flare-api.flare.network/ext/C/rpc',
    );

    expect(result).not.toBeNull();
    expect(result!.source).toBe('FTSO');
  });

  it('sends requests to the provided RPC URL (different chain returns data from that chain)', async () => {
    // When pointed at a non-Flare RPC, the FTSO registry contract
    // at the hardcoded address may not exist, causing an RPC error or empty result.
    fetchMock.mockResolvedValueOnce(rpcError(-32000, 'execution reverted: contract not found'));

    const result = await getFtsoPrice(
      'FLR',
      NOW_SECONDS,
      'https://some-other-chain-rpc.example.com',
    );

    expect(result).toBeNull();

    // Verify it sent the request to the provided URL
    expect(fetchMock).toHaveBeenCalledWith(
      'https://some-other-chain-rpc.example.com',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
