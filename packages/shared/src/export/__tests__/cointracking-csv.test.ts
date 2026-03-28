import { describe, it, expect } from 'vitest';
import {
  generateCoinTrackingCsv,
  generateCoinTrackingCsvBuffer,
  formatDecimalDE,
  formatDateCT,
  rowToCsvLine,
  validateCoinTrackingRow,
} from '../cointracking-csv';
import type { CoinTrackingRow } from '../cointracking-csv';

/**
 * @spec US-004, EP-07 — CoinTracking 15-column CSV format, German decimal/date formatting
 * @spec NFR-P05 — Export generation < 10s for 10,000 TX
 */

describe('formatDecimalDE [US-004, EP-07, NFR-P05]', () => {
  it('should replace dots with commas for German decimal format', () => {
    expect(formatDecimalDE('1234.56')).toBe('1234,56');
  });

  it('should handle integer strings', () => {
    expect(formatDecimalDE('100')).toBe('100');
  });

  it('should handle numbers', () => {
    expect(formatDecimalDE(1234.56)).toBe('1234,56');
  });

  it('should handle zero', () => {
    expect(formatDecimalDE('0')).toBe('0');
    expect(formatDecimalDE(0)).toBe('0');
  });

  it('should handle null', () => {
    expect(formatDecimalDE(null)).toBe('');
  });

  it('should handle empty string', () => {
    expect(formatDecimalDE('')).toBe('');
  });

  it('should handle small decimals', () => {
    expect(formatDecimalDE('0.001')).toBe('0,001');
  });
});

describe('formatDateCT', () => {
  it('should format Unix timestamp as DD.MM.YYYY HH:MM:SS', () => {
    // 2026-03-12T09:14:33Z as Unix timestamp in seconds
    const timestamp = Math.floor(new Date('2026-03-12T09:14:33Z').getTime() / 1000);
    expect(formatDateCT(timestamp)).toBe('12.03.2026 09:14:33');
  });

  it('should pad single-digit values with zeros', () => {
    const timestamp = Math.floor(new Date('2026-01-05T03:07:09Z').getTime() / 1000);
    expect(formatDateCT(timestamp)).toBe('05.01.2026 03:07:09');
  });

  it('should handle midnight', () => {
    const timestamp = Math.floor(new Date('2026-01-01T00:00:00Z').getTime() / 1000);
    expect(formatDateCT(timestamp)).toBe('01.01.2026 00:00:00');
  });

  it('should handle end of day', () => {
    const timestamp = Math.floor(new Date('2026-12-31T23:59:59Z').getTime() / 1000);
    expect(formatDateCT(timestamp)).toBe('31.12.2026 23:59:59');
  });
});

describe('rowToCsvLine', () => {
  function makeRow(overrides: Partial<CoinTrackingRow> = {}): CoinTrackingRow {
    return {
      type: 'Trade',
      buyAmount: '1,523',
      buyCurrency: 'FLR',
      sellAmount: '50',
      sellCurrency: 'USDT',
      fee: '0,02',
      feeCurrency: 'FLR',
      exchange: 'SparkDEX',
      tradeGroup: 'DeFi-Flare',
      comment: 'Swap wFLR->USDT',
      date: '12.03.2026 09:14:33',
      liquidityPool: null,
      txId: '0xabc123def456',
      buyValueInAccountCurrency: '2,64',
      sellValueInAccountCurrency: '50,00',
      ...overrides,
    };
  }

  it('should wrap all field values in double quotes', () => {
    const line = rowToCsvLine(makeRow());
    expect(line).toContain('"Trade"');
    expect(line).toContain('"SparkDEX"');
  });

  it('should escape internal double quotes by doubling them', () => {
    const line = rowToCsvLine(makeRow({ comment: 'He said "hello"' }));
    expect(line).toContain('"He said ""hello"""');
  });

  it('should handle null values as empty quoted strings', () => {
    const line = rowToCsvLine(makeRow({ liquidityPool: null }));
    // null fields should become ""
    expect(line).toContain('""');
  });

  it('should produce exactly 15 comma-separated fields', () => {
    const line = rowToCsvLine(makeRow());
    const fields = line.match(/"(?:[^"]|"")*"/g);
    expect(fields).toHaveLength(15);
  });
});

describe('validateCoinTrackingRow', () => {
  function makeRow(overrides: Partial<CoinTrackingRow> = {}): CoinTrackingRow {
    return {
      type: 'Trade',
      buyAmount: '1,523',
      buyCurrency: 'FLR',
      sellAmount: '50',
      sellCurrency: 'USDT',
      fee: '0,02',
      feeCurrency: 'FLR',
      exchange: 'SparkDEX',
      tradeGroup: 'DeFi-Flare',
      comment: 'Swap wFLR->USDT',
      date: '12.03.2026 09:14:33',
      liquidityPool: null,
      txId: '0xabc123def456',
      buyValueInAccountCurrency: '2,64',
      sellValueInAccountCurrency: '50,00',
      ...overrides,
    };
  }

  it('should validate a correct row with no errors', () => {
    const result = validateCoinTrackingRow(makeRow());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject invalid type', () => {
    const result = validateCoinTrackingRow(makeRow({ type: 'InvalidType' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Invalid type'))).toBe(true);
  });

  it('should reject invalid date format', () => {
    const result = validateCoinTrackingRow(makeRow({ date: '2026-03-12' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('date format'))).toBe(true);
  });

  it('should require at least one of buy or sell', () => {
    const result = validateCoinTrackingRow(
      makeRow({
        buyAmount: null,
        buyCurrency: null,
        sellAmount: null,
        sellCurrency: null,
      }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('buy-side or sell-side'))).toBe(true);
  });

  it('should accept buy-only rows (staking rewards)', () => {
    const result = validateCoinTrackingRow(
      makeRow({
        sellAmount: null,
        sellCurrency: null,
      }),
    );
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should accept sell-only rows', () => {
    const result = validateCoinTrackingRow(
      makeRow({
        buyAmount: null,
        buyCurrency: null,
      }),
    );
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should require buyCurrency when buyAmount is set', () => {
    const result = validateCoinTrackingRow(
      makeRow({
        buyAmount: '100',
        buyCurrency: null,
      }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('buyCurrency'))).toBe(true);
  });

  it('should require feeCurrency when fee is set', () => {
    const result = validateCoinTrackingRow(
      makeRow({
        fee: '0.01',
        feeCurrency: null,
      }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('feeCurrency'))).toBe(true);
  });

  it('should require exchange to be non-empty', () => {
    const result = validateCoinTrackingRow(makeRow({ exchange: '' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('exchange'))).toBe(true);
  });

  it('should require txId to be non-empty', () => {
    const result = validateCoinTrackingRow(makeRow({ txId: '' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('txId'))).toBe(true);
  });

  it('should return multiple errors at once', () => {
    const result = validateCoinTrackingRow(
      makeRow({
        type: 'InvalidType',
        date: 'bad-date',
        exchange: '',
        txId: '',
      }),
    );
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });
});

describe('generateCoinTrackingCsv', () => {
  function makeRow(overrides: Partial<CoinTrackingRow> = {}): CoinTrackingRow {
    return {
      type: 'Trade',
      buyAmount: '1,523',
      buyCurrency: 'FLR',
      sellAmount: '50',
      sellCurrency: 'USDT',
      fee: '0,02',
      feeCurrency: 'FLR',
      exchange: 'SparkDEX',
      tradeGroup: 'DeFi-Flare',
      comment: 'Swap wFLR->USDT',
      date: '12.03.2026 09:14:33',
      liquidityPool: null,
      txId: '0xabc123def456',
      buyValueInAccountCurrency: '2,64',
      sellValueInAccountCurrency: '50,00',
      ...overrides,
    };
  }

  it('should generate CSV with UTF-8 BOM prefix', () => {
    const csv = generateCoinTrackingCsv([]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.startsWith('\uFEFF')).toBe(true);
  });

  it('should include header row with 15 quoted columns', () => {
    const csv = generateCoinTrackingCsv([]);
    const content = csv.replace('\uFEFF', '');
    const lines = content.split('\r\n');
    const headerLine = lines[0];

    // Count quoted values in the header
    const headers = headerLine.match(/"[^"]*"/g);
    expect(headers).toHaveLength(15);
  });

  it('should include data rows after header', () => {
    const row = makeRow();
    const csv = generateCoinTrackingCsv([row]);
    const content = csv.replace('\uFEFF', '');
    const lines = content.split('\r\n').filter((l) => l.length > 0);

    expect(lines).toHaveLength(2); // header + 1 data row
    expect(lines[1]).toContain('"Trade"');
    expect(lines[1]).toContain('"FLR"');
  });

  it('should handle multiple rows', () => {
    const rows = [
      makeRow({ type: 'Trade' }),
      makeRow({ type: 'Staking', sellAmount: null, sellCurrency: null }),
    ];
    const csv = generateCoinTrackingCsv(rows);
    const content = csv.replace('\uFEFF', '');
    const lines = content.split('\r\n').filter((l) => l.length > 0);

    expect(lines).toHaveLength(3); // header + 2 data rows
    expect(lines[1]).toContain('"Trade"');
    expect(lines[2]).toContain('"Staking"');
  });

  it('should properly escape quotes in data', () => {
    const row = makeRow({ comment: 'TX with "special" chars' });
    const csv = generateCoinTrackingCsv([row]);

    expect(csv).toContain('"TX with ""special"" chars"');
  });

  it('should use CRLF line endings', () => {
    const csv = generateCoinTrackingCsv([makeRow()]);
    // Should contain \r\n
    expect(csv).toContain('\r\n');
  });

  it('should handle empty rows array (header only)', () => {
    const csv = generateCoinTrackingCsv([]);
    const content = csv.replace('\uFEFF', '');
    const lines = content.split('\r\n').filter((l) => l.length > 0);

    expect(lines).toHaveLength(1); // just header
  });

  it('should produce rows with exactly 15 values each', () => {
    const row = makeRow();
    const csv = generateCoinTrackingCsv([row]);
    const content = csv.replace('\uFEFF', '');
    const lines = content.split('\r\n').filter((l) => l.length > 0);

    // Parse the data row -- count fields by matching quoted values
    const dataLine = lines[1];
    const fields = dataLine.match(/"(?:[^"]|"")*"/g);
    expect(fields).toHaveLength(15);
  });
});

describe('generateCoinTrackingCsvBuffer', () => {
  it('should return a Buffer', () => {
    const buffer = generateCoinTrackingCsvBuffer([]);
    expect(Buffer.isBuffer(buffer)).toBe(true);
  });

  it('should contain UTF-8 BOM at the start', () => {
    const buffer = generateCoinTrackingCsvBuffer([]);
    // UTF-8 BOM is EF BB BF
    expect(buffer[0]).toBe(0xef);
    expect(buffer[1]).toBe(0xbb);
    expect(buffer[2]).toBe(0xbf);
  });
});
