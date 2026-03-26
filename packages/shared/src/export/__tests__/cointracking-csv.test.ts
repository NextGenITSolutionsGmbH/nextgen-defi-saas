import { describe, it, expect } from 'vitest';
import {
  generateCoinTrackingCsv,
  formatDecimalDE,
  formatDateCT,
  escapeCsvValue,
  validateCoinTrackingRow,
  COINTRACKING_HEADERS,
} from '../cointracking-csv';
import type { CoinTrackingRow } from '../../types/export';

describe('formatDecimalDE', () => {
  it('should format numbers with comma as decimal separator', () => {
    expect(formatDecimalDE(1234.56)).toBe('1234,56');
  });

  it('should pad to 2 decimal places by default', () => {
    expect(formatDecimalDE(100)).toBe('100,00');
    expect(formatDecimalDE(0.1)).toBe('0,10');
  });

  it('should respect custom decimal places', () => {
    expect(formatDecimalDE(3.14159, 4)).toBe('3,1416');
    expect(formatDecimalDE(42, 0)).toBe('42');
  });

  it('should handle zero', () => {
    expect(formatDecimalDE(0)).toBe('0,00');
  });

  it('should handle negative numbers', () => {
    expect(formatDecimalDE(-1234.56)).toBe('-1234,56');
  });
});

describe('formatDateCT', () => {
  it('should format dates as DD.MM.YYYY HH:MM:SS', () => {
    const date = new Date('2026-03-12T09:14:33Z');
    expect(formatDateCT(date)).toBe('12.03.2026 09:14:33');
  });

  it('should accept ISO string input', () => {
    expect(formatDateCT('2026-03-12T09:14:33Z')).toBe('12.03.2026 09:14:33');
  });

  it('should pad single-digit values with zeros', () => {
    const date = new Date('2026-01-05T03:07:09Z');
    expect(formatDateCT(date)).toBe('05.01.2026 03:07:09');
  });

  it('should handle midnight', () => {
    expect(formatDateCT('2026-01-01T00:00:00Z')).toBe('01.01.2026 00:00:00');
  });

  it('should handle end of day', () => {
    expect(formatDateCT('2026-12-31T23:59:59Z')).toBe('31.12.2026 23:59:59');
  });
});

describe('escapeCsvValue', () => {
  it('should wrap values in double quotes', () => {
    expect(escapeCsvValue('Trade')).toBe('"Trade"');
  });

  it('should escape internal double quotes as ""', () => {
    expect(escapeCsvValue('He said "hello"')).toBe('"He said ""hello"""');
  });

  it('should handle empty strings', () => {
    expect(escapeCsvValue('')).toBe('""');
  });

  it('should handle values with commas', () => {
    expect(escapeCsvValue('1,234.56')).toBe('"1,234.56"');
  });

  it('should handle values with newlines', () => {
    expect(escapeCsvValue('line1\nline2')).toBe('"line1\nline2"');
  });
});

describe('validateCoinTrackingRow', () => {
  function makeRow(overrides: Partial<CoinTrackingRow> = {}): CoinTrackingRow {
    return {
      type: 'Trade',
      buyAmount: '1.523',
      buyCurrency: 'FLR',
      sellAmount: '50',
      sellCurrency: 'USDT',
      fee: '0.02',
      feeCurrency: 'FLR',
      exchange: 'SparkDEX',
      tradeGroup: 'DeFi-Flare',
      comment: 'Swap wFLR->USDT',
      date: '12.03.2026 09:14:33',
      liquidityPool: '',
      txId: '0xabc123def456',
      buyValueEur: '2.64',
      sellValueEur: '50.00',
      ...overrides,
    };
  }

  it('should validate a correct row with no errors', () => {
    const errors = validateCoinTrackingRow(makeRow());
    expect(errors).toHaveLength(0);
  });

  it('should require Type field', () => {
    const errors = validateCoinTrackingRow(makeRow({ type: '' }));
    expect(errors).toContain('Type is required');
  });

  it('should require Date field', () => {
    const errors = validateCoinTrackingRow(makeRow({ date: '' }));
    expect(errors).toContain('Date is required');
  });

  it('should validate Date format (DD.MM.YYYY HH:MM:SS)', () => {
    const errors = validateCoinTrackingRow(makeRow({ date: '2026-03-12' }));
    expect(errors).toContain('Date must be in DD.MM.YYYY HH:MM:SS format');
  });

  it('should require at least one of buy or sell', () => {
    const errors = validateCoinTrackingRow(
      makeRow({
        buyAmount: '',
        buyCurrency: '',
        sellAmount: '',
        sellCurrency: '',
      }),
    );
    expect(errors).toContain('At least one of buy or sell must be specified');
  });

  it('should accept buy-only rows (staking rewards)', () => {
    const errors = validateCoinTrackingRow(
      makeRow({
        sellAmount: '',
        sellCurrency: '',
      }),
    );
    expect(errors).toHaveLength(0);
  });

  it('should accept sell-only rows (provide liquidity)', () => {
    const errors = validateCoinTrackingRow(
      makeRow({
        buyAmount: '',
        buyCurrency: '',
      }),
    );
    expect(errors).toHaveLength(0);
  });

  it('should return multiple errors at once', () => {
    const errors = validateCoinTrackingRow(
      makeRow({
        type: '',
        date: '',
        buyAmount: '',
        buyCurrency: '',
        sellAmount: '',
        sellCurrency: '',
      }),
    );
    expect(errors.length).toBeGreaterThanOrEqual(3);
  });
});

describe('COINTRACKING_HEADERS', () => {
  it('should have exactly 15 columns', () => {
    expect(COINTRACKING_HEADERS).toHaveLength(15);
  });

  it('should start with Type', () => {
    expect(COINTRACKING_HEADERS[0]).toBe('Type');
  });

  it('should end with Sell Value in Account Currency (optional)', () => {
    expect(COINTRACKING_HEADERS[14]).toBe(
      'Sell Value in Account Currency (optional)',
    );
  });

  it('should contain all expected header names', () => {
    expect(COINTRACKING_HEADERS).toContain('Buy Amount');
    expect(COINTRACKING_HEADERS).toContain('Buy Currency');
    expect(COINTRACKING_HEADERS).toContain('Sell Amount');
    expect(COINTRACKING_HEADERS).toContain('Sell Currency');
    expect(COINTRACKING_HEADERS).toContain('Fee');
    expect(COINTRACKING_HEADERS).toContain('Fee Currency');
    expect(COINTRACKING_HEADERS).toContain('Exchange');
    expect(COINTRACKING_HEADERS).toContain('Trade-Group');
    expect(COINTRACKING_HEADERS).toContain('Comment');
    expect(COINTRACKING_HEADERS).toContain('Date');
    expect(COINTRACKING_HEADERS).toContain('Liquidity pool (optional)');
    expect(COINTRACKING_HEADERS).toContain('Tx-ID (optional)');
    expect(COINTRACKING_HEADERS).toContain(
      'Buy Value in Account Currency (optional)',
    );
  });
});

describe('generateCoinTrackingCsv', () => {
  function makeRow(overrides: Partial<CoinTrackingRow> = {}): CoinTrackingRow {
    return {
      type: 'Trade',
      buyAmount: '1.523',
      buyCurrency: 'FLR',
      sellAmount: '50',
      sellCurrency: 'USDT',
      fee: '0.02',
      feeCurrency: 'FLR',
      exchange: 'SparkDEX',
      tradeGroup: 'DeFi-Flare',
      comment: 'Swap wFLR->USDT',
      date: '12.03.2026 09:14:33',
      liquidityPool: '',
      txId: '0xabc123def456',
      buyValueEur: '2.64',
      sellValueEur: '50.00',
      ...overrides,
    };
  }

  it('should generate CSV with UTF-8 BOM prefix', () => {
    const csv = generateCoinTrackingCsv([]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.startsWith('\uFEFF')).toBe(true);
  });

  it('should include header row with 15 columns', () => {
    const csv = generateCoinTrackingCsv([]);
    const lines = csv.replace('\uFEFF', '').split('\n');
    const headerLine = lines[0];

    // Count quoted values
    const headers = headerLine.match(/"[^"]*"/g);
    expect(headers).toHaveLength(15);
  });

  it('should include data rows after header', () => {
    const row = makeRow();
    const csv = generateCoinTrackingCsv([row]);
    const lines = csv.replace('\uFEFF', '').split('\n');

    expect(lines).toHaveLength(2); // header + 1 data row
    expect(lines[1]).toContain('"Trade"');
    expect(lines[1]).toContain('"1.523"');
    expect(lines[1]).toContain('"FLR"');
  });

  it('should handle multiple rows', () => {
    const rows = [
      makeRow({ type: 'Trade' }),
      makeRow({ type: 'Staking', sellAmount: '', sellCurrency: '' }),
    ];
    const csv = generateCoinTrackingCsv(rows);
    const lines = csv.replace('\uFEFF', '').split('\n');

    expect(lines).toHaveLength(3); // header + 2 data rows
    expect(lines[1]).toContain('"Trade"');
    expect(lines[2]).toContain('"Staking"');
  });

  it('should properly escape quotes in data', () => {
    const row = makeRow({ comment: 'TX with "special" chars' });
    const csv = generateCoinTrackingCsv([row]);

    expect(csv).toContain('"TX with ""special"" chars"');
  });

  it('should handle empty rows array', () => {
    const csv = generateCoinTrackingCsv([]);
    const lines = csv.replace('\uFEFF', '').split('\n');

    expect(lines).toHaveLength(1); // just header
  });

  it('should produce rows with exactly 15 values each', () => {
    const row = makeRow();
    const csv = generateCoinTrackingCsv([row]);
    const lines = csv.replace('\uFEFF', '').split('\n');

    // Parse the data row — count fields by matching quoted values
    const dataLine = lines[1];
    const fields = dataLine.match(/"(?:[^"]|"")*"/g);
    expect(fields).toHaveLength(15);
  });

  it('should match the CoinTracking example format from PRD', () => {
    // Based on the example from the technical document
    const row: CoinTrackingRow = {
      type: 'Trade',
      buyAmount: '1.523',
      buyCurrency: 'FLR',
      sellAmount: '50',
      sellCurrency: 'USDT',
      fee: '0.02',
      feeCurrency: 'FLR',
      exchange: 'SparkDEX',
      tradeGroup: 'DeFi-Flare',
      comment: 'Swap wFLR->USDT',
      date: '12.03.2026 09:14:33',
      liquidityPool: '',
      txId: '0xabc123def456...',
      buyValueEur: '2.64',
      sellValueEur: '50.00',
    };

    const csv = generateCoinTrackingCsv([row]);
    const lines = csv.replace('\uFEFF', '').split('\n');
    const dataLine = lines[1];

    // Verify key fields are present and properly formatted
    expect(dataLine).toContain('"Trade"');
    expect(dataLine).toContain('"SparkDEX"');
    expect(dataLine).toContain('"12.03.2026 09:14:33"');
  });
});
