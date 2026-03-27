import { describe, it, expect } from 'vitest';
import {
  generateCoinTrackingCsv,
  generateCoinTrackingCsvBuffer,
  formatDecimalDE,
  formatDateCT,
  validateCoinTrackingRow,
} from '../cointracking-csv';
import type { CoinTrackingRow } from '../cointracking-csv';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TX_HASH_BASE = '0xabc00e2edef234567890abcdef1234567890abcdef1234567890abcdef123450';

/** Generates a deterministic TX hash per index */
function txHash(index: number): string {
  return `${TX_HASH_BASE}${String(index).padStart(2, '0')}`;
}

/** Unix timestamp for 2026-03-12T09:14:33Z */
const TS_BASE = Math.floor(new Date('2026-03-12T09:14:33Z').getTime() / 1000);

function makeTradeRow(overrides: Partial<CoinTrackingRow> = {}): CoinTrackingRow {
  return {
    type: 'Trade',
    buyAmount: formatDecimalDE('1523.456789'),
    buyCurrency: 'FLR',
    sellAmount: formatDecimalDE('50.25'),
    sellCurrency: 'USDT',
    fee: formatDecimalDE('0.02'),
    feeCurrency: 'FLR',
    exchange: 'SparkDEX',
    tradeGroup: 'DeFi-Flare',
    comment: 'Swap wFLR->USDT',
    date: formatDateCT(TS_BASE),
    liquidityPool: null,
    txId: txHash(1),
    buyValueInAccountCurrency: formatDecimalDE('2.64'),
    sellValueInAccountCurrency: formatDecimalDE('50.00'),
    ...overrides,
  };
}

function makeStakingRow(): CoinTrackingRow {
  return {
    type: 'Staking',
    buyAmount: formatDecimalDE('750.000000000000000000'),
    buyCurrency: 'FLR',
    sellAmount: null,
    sellCurrency: null,
    fee: null,
    feeCurrency: null,
    exchange: 'FTSO',
    tradeGroup: 'Staking',
    comment: 'FTSO delegation reward',
    date: formatDateCT(TS_BASE + 1000),
    liquidityPool: null,
    txId: txHash(2),
    buyValueInAccountCurrency: formatDecimalDE('15.375'),
    sellValueInAccountCurrency: null,
  };
}

function makeLpRewardsRow(): CoinTrackingRow {
  return {
    type: 'LP Rewards',
    buyAmount: formatDecimalDE('42.123456789012345678'),
    buyCurrency: 'SPRK',
    sellAmount: null,
    sellCurrency: null,
    fee: null,
    feeCurrency: null,
    exchange: 'SparkDEX',
    tradeGroup: 'Farming',
    comment: 'SparkDEX LP farming reward',
    date: formatDateCT(TS_BASE + 2000),
    liquidityPool: 'wFLR/USDT V3',
    txId: txHash(3),
    buyValueInAccountCurrency: formatDecimalDE('8.50'),
    sellValueInAccountCurrency: null,
  };
}

function makeLendingEinnahmeRow(): CoinTrackingRow {
  return {
    type: 'Lending Einnahme',
    buyAmount: formatDecimalDE('12.345678'),
    buyCurrency: 'kUSDT',
    sellAmount: null,
    sellCurrency: null,
    fee: null,
    feeCurrency: null,
    exchange: 'Kinetic Market',
    tradeGroup: 'Lending',
    comment: 'Kinetic lending interest',
    date: formatDateCT(TS_BASE + 3000),
    liquidityPool: null,
    txId: txHash(4),
    buyValueInAccountCurrency: formatDecimalDE('11.73'),
    sellValueInAccountCurrency: null,
  };
}

function makeAirdropRow(): CoinTrackingRow {
  return {
    type: 'Airdrop',
    buyAmount: formatDecimalDE('2500.000000000000000000'),
    buyCurrency: 'WFLR',
    sellAmount: null,
    sellCurrency: null,
    fee: formatDecimalDE('0.0015'),
    feeCurrency: 'FLR',
    exchange: 'FlareDrops',
    tradeGroup: 'DeFi-Flare',
    comment: 'FlareDrop distribution month 24',
    date: formatDateCT(TS_BASE + 4000),
    liquidityPool: null,
    txId: txHash(5),
    buyValueInAccountCurrency: formatDecimalDE('51.25'),
    sellValueInAccountCurrency: null,
  };
}

// ---------------------------------------------------------------------------
// CSV parsing helpers for round-trip verification
// ---------------------------------------------------------------------------

/**
 * Parses a CoinTracking CSV string back into header + data rows.
 * Handles quoted fields with escaped double-quotes.
 */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        // Check for escaped quote
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i += 2;
        } else {
          // End of quoted field
          inQuotes = false;
          i++;
        }
      } else {
        current += ch;
        i++;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
      } else if (ch === ',') {
        fields.push(current);
        current = '';
        i++;
      } else {
        current += ch;
        i++;
      }
    }
  }
  fields.push(current);
  return fields;
}

function parseCsv(csvString: string): { headers: string[]; rows: string[][] } {
  // Strip BOM
  const stripped = csvString.replace(/^\uFEFF/, '');
  // Split on CRLF, remove trailing empty line
  const lines = stripped.split('\r\n').filter((l) => l.length > 0);
  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map(parseCsvLine);
  return { headers, rows };
}

// ---------------------------------------------------------------------------
// End-to-end pipeline tests
// ---------------------------------------------------------------------------

describe('CoinTracking CSV E2E Pipeline', () => {
  const allRows: CoinTrackingRow[] = [
    makeTradeRow(),
    makeStakingRow(),
    makeLpRewardsRow(),
    makeLendingEinnahmeRow(),
    makeAirdropRow(),
  ];

  // -----------------------------------------------------------------------
  // 1. Full pipeline: generate CSV from all CoinTracking types
  // -----------------------------------------------------------------------
  it('should generate CSV from all TX types and validate every row', () => {
    const csv = generateCoinTrackingCsv(allRows);
    const { headers, rows: parsedRows } = parseCsv(csv);

    expect(headers).toHaveLength(15);
    expect(parsedRows).toHaveLength(allRows.length);

    // Validate each original row passes validation
    for (const row of allRows) {
      const result = validateCoinTrackingRow(row);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    }

    // Verify types roundtrip correctly
    const parsedTypes = parsedRows.map((r) => r[0]);
    expect(parsedTypes).toEqual([
      'Trade',
      'Staking',
      'LP Rewards',
      'Lending Einnahme',
      'Airdrop',
    ]);
  });

  // -----------------------------------------------------------------------
  // 2. Parse resulting CSV and validate each row with validateCoinTrackingRow
  // -----------------------------------------------------------------------
  it('should produce parseable CSV rows that reconstruct valid CoinTrackingRow objects', () => {
    const csv = generateCoinTrackingCsv(allRows);
    const { headers, rows: parsedRows } = parseCsv(csv);

    // Reconstruct CoinTrackingRow from parsed CSV and validate
    for (let i = 0; i < parsedRows.length; i++) {
      const fields = parsedRows[i];
      expect(fields).toHaveLength(15);

      const reconstructed: CoinTrackingRow = {
        type: fields[0],
        buyAmount: fields[1] || null,
        buyCurrency: fields[2] || null,
        sellAmount: fields[3] || null,
        sellCurrency: fields[4] || null,
        fee: fields[5] || null,
        feeCurrency: fields[6] || null,
        exchange: fields[7],
        tradeGroup: fields[8],
        comment: fields[9],
        date: fields[10],
        liquidityPool: fields[11] || null,
        txId: fields[12],
        buyValueInAccountCurrency: fields[13] || null,
        sellValueInAccountCurrency: fields[14] || null,
      };

      const result = validateCoinTrackingRow(reconstructed);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    }
  });

  // -----------------------------------------------------------------------
  // 3. UTF-8 BOM bytes (EF BB BF)
  // -----------------------------------------------------------------------
  it('should have UTF-8 BOM bytes EF BB BF at the start of the buffer', () => {
    const buffer = generateCoinTrackingCsvBuffer(allRows);

    expect(buffer[0]).toBe(0xef);
    expect(buffer[1]).toBe(0xbb);
    expect(buffer[2]).toBe(0xbf);

    // Also verify the string representation
    const csvString = generateCoinTrackingCsv(allRows);
    expect(csvString.charCodeAt(0)).toBe(0xfeff);
  });

  // -----------------------------------------------------------------------
  // 4. CRLF line endings
  // -----------------------------------------------------------------------
  it('should use CRLF line endings throughout the entire CSV', () => {
    const csv = generateCoinTrackingCsv(allRows);
    // Strip BOM for analysis
    const content = csv.replace(/^\uFEFF/, '');

    // Every line-break should be \r\n
    expect(content).toContain('\r\n');

    // There should be no bare \n without preceding \r
    const bareNewlines = content.replace(/\r\n/g, '').match(/\n/g);
    expect(bareNewlines).toBeNull();

    // Count CRLF occurrences: header + N data rows = N+1 line endings
    const crlfCount = (content.match(/\r\n/g) || []).length;
    expect(crlfCount).toBe(allRows.length + 1);
  });

  // -----------------------------------------------------------------------
  // 5. DE number formatting: comma decimal separator
  // -----------------------------------------------------------------------
  it('should use comma as decimal separator in all numeric fields', () => {
    const csv = generateCoinTrackingCsv(allRows);
    const { rows: parsedRows } = parseCsv(csv);

    // Trade row (index 0): buyAmount should have comma
    expect(parsedRows[0][1]).toBe('1523,456789');
    expect(parsedRows[0][3]).toBe('50,25');
    expect(parsedRows[0][5]).toBe('0,02');

    // Staking row (index 1): buyAmount with many decimals
    expect(parsedRows[1][1]).toBe('750,000000000000000000');

    // All numeric fields with decimal values must use commas, not dots
    for (const row of parsedRows) {
      // Columns 1,3,5,13,14 are numeric amounts
      const numericIndices = [1, 3, 5, 13, 14];
      for (const idx of numericIndices) {
        const val = row[idx];
        if (val && val !== '') {
          expect(val).not.toContain('.');
        }
      }
    }
  });

  // -----------------------------------------------------------------------
  // 6. Date format: DD.MM.YYYY HH:MM:SS
  // -----------------------------------------------------------------------
  it('should format all dates as DD.MM.YYYY HH:MM:SS', () => {
    const csv = generateCoinTrackingCsv(allRows);
    const { rows: parsedRows } = parseCsv(csv);
    const dateRegex = /^\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}:\d{2}$/;

    for (let i = 0; i < parsedRows.length; i++) {
      const dateField = parsedRows[i][10]; // Col 11 = index 10
      expect(dateField).toMatch(dateRegex);
    }

    // Verify specific known date
    expect(parsedRows[0][10]).toBe('12.03.2026 09:14:33');
  });

  // -----------------------------------------------------------------------
  // 7. Exactly 15 columns per row (header and data)
  // -----------------------------------------------------------------------
  it('should have exactly 15 columns in header and every data row', () => {
    const csv = generateCoinTrackingCsv(allRows);
    const { headers, rows: parsedRows } = parseCsv(csv);

    expect(headers).toHaveLength(15);
    for (let i = 0; i < parsedRows.length; i++) {
      expect(parsedRows[i]).toHaveLength(15);
    }
  });

  // -----------------------------------------------------------------------
  // 8. Graubereich dual-scenario: MODEL_A and MODEL_B produce different ctType
  // -----------------------------------------------------------------------
  it('should support Graubereich dual-scenario with MODEL_A and MODEL_B producing different ctType values', () => {
    // LP providing is a Graubereich scenario:
    // Model A: Trade (LP token is a taxable exchange)
    // Model B: Add Liquidity (non-taxable deposit)
    const modelARow: CoinTrackingRow = {
      type: 'Trade',
      buyAmount: formatDecimalDE('1414.213562373095048802'),
      buyCurrency: 'SPARK-LP',
      sellAmount: formatDecimalDE('10000.000000000000000000'),
      sellCurrency: 'WFLR',
      fee: formatDecimalDE('0.005'),
      feeCurrency: 'WFLR',
      exchange: 'SparkDEX',
      tradeGroup: 'DeFi-Flare',
      comment: 'Graubereich MODEL_A: LP Provide as Trade',
      date: formatDateCT(TS_BASE + 5000),
      liquidityPool: 'wFLR/USDT V3',
      txId: txHash(6),
      buyValueInAccountCurrency: formatDecimalDE('395.00'),
      sellValueInAccountCurrency: formatDecimalDE('205.00'),
    };

    const modelBRow: CoinTrackingRow = {
      type: 'Add Liquidity',
      buyAmount: formatDecimalDE('1414.213562373095048802'),
      buyCurrency: 'SPARK-LP',
      sellAmount: formatDecimalDE('10000.000000000000000000'),
      sellCurrency: 'WFLR',
      fee: formatDecimalDE('0.005'),
      feeCurrency: 'WFLR',
      exchange: 'SparkDEX',
      tradeGroup: 'DeFi-Flare',
      comment: 'Graubereich MODEL_B: LP Provide as Add Liquidity',
      date: formatDateCT(TS_BASE + 5000),
      liquidityPool: 'wFLR/USDT V3',
      txId: txHash(6),
      buyValueInAccountCurrency: formatDecimalDE('395.00'),
      sellValueInAccountCurrency: formatDecimalDE('205.00'),
    };

    // Types must differ between models
    expect(modelARow.type).not.toBe(modelBRow.type);
    expect(modelARow.type).toBe('Trade');
    expect(modelBRow.type).toBe('Add Liquidity');

    // Both must be valid CoinTracking rows
    expect(validateCoinTrackingRow(modelARow).valid).toBe(true);
    expect(validateCoinTrackingRow(modelBRow).valid).toBe(true);

    // Comments should indicate the model
    expect(modelARow.comment).toContain('MODEL_A');
    expect(modelBRow.comment).toContain('MODEL_B');

    // Generate CSV with both scenarios and verify they produce distinct rows
    const csv = generateCoinTrackingCsv([modelARow, modelBRow]);
    const { rows: parsedRows } = parseCsv(csv);

    expect(parsedRows).toHaveLength(2);
    expect(parsedRows[0][0]).toBe('Trade');
    expect(parsedRows[1][0]).toBe('Add Liquidity');
    expect(parsedRows[0][9]).toContain('MODEL_A');
    expect(parsedRows[1][9]).toContain('MODEL_B');
  });

  // -----------------------------------------------------------------------
  // 9. Manual classification: isManual flag propagates to comment
  // -----------------------------------------------------------------------
  it('should propagate manual classification flag into the comment field', () => {
    const manualRow = makeTradeRow({
      comment: '[MANUAL] User reclassified: Trade (was: Unknown)',
    });

    expect(validateCoinTrackingRow(manualRow).valid).toBe(true);

    const csv = generateCoinTrackingCsv([manualRow]);
    const { rows: parsedRows } = parseCsv(csv);

    expect(parsedRows[0][9]).toContain('[MANUAL]');
    expect(parsedRows[0][9]).toContain('User reclassified');
  });

  // -----------------------------------------------------------------------
  // 10. Fee handling: fee row present when non-zero, correct currency
  // -----------------------------------------------------------------------
  it('should correctly handle fee fields: present when non-zero, absent when null', () => {
    const rowWithFee = makeTradeRow({
      fee: formatDecimalDE('0.003'),
      feeCurrency: 'FLR',
    });

    const rowWithoutFee = makeStakingRow(); // staking has null fee

    const csv = generateCoinTrackingCsv([rowWithFee, rowWithoutFee]);
    const { rows: parsedRows } = parseCsv(csv);

    // Row with fee: columns 5+6 populated
    expect(parsedRows[0][5]).toBe('0,003');
    expect(parsedRows[0][6]).toBe('FLR');

    // Row without fee: columns 5+6 empty
    expect(parsedRows[1][5]).toBe('');
    expect(parsedRows[1][6]).toBe('');

    // Both rows valid
    expect(validateCoinTrackingRow(rowWithFee).valid).toBe(true);
    expect(validateCoinTrackingRow(rowWithoutFee).valid).toBe(true);

    // Fee with currency but no amount should fail validation
    const badFeeRow = makeTradeRow({
      fee: formatDecimalDE('0.01'),
      feeCurrency: null,
    });
    const result = validateCoinTrackingRow(badFeeRow);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('feeCurrency'))).toBe(true);
  });

  // -----------------------------------------------------------------------
  // 11. Large amounts (18 decimal places) survive DE formatting
  // -----------------------------------------------------------------------
  it('should preserve full 18-decimal-place precision through DE formatting', () => {
    const largeAmount = '123456789012345678.123456789012345678';
    const formatted = formatDecimalDE(largeAmount);

    // Must use commas instead of dots
    expect(formatted).toBe('123456789012345678,123456789012345678');
    expect(formatted).not.toContain('.');

    // Use this in a full pipeline
    const row = makeTradeRow({
      buyAmount: formatted,
      sellAmount: formatDecimalDE('0.000000000000000001'),
    });

    expect(validateCoinTrackingRow(row).valid).toBe(true);

    const csv = generateCoinTrackingCsv([row]);
    const { rows: parsedRows } = parseCsv(csv);

    expect(parsedRows[0][1]).toBe('123456789012345678,123456789012345678');
    expect(parsedRows[0][3]).toBe('0,000000000000000001');
  });

  // -----------------------------------------------------------------------
  // 12. Empty rows array produces header-only CSV
  // -----------------------------------------------------------------------
  it('should produce header-only CSV when rows array is empty', () => {
    const csv = generateCoinTrackingCsv([]);
    const content = csv.replace(/^\uFEFF/, '');
    const lines = content.split('\r\n').filter((l) => l.length > 0);

    // Only the header line
    expect(lines).toHaveLength(1);

    // Header has 15 columns
    const headers = parseCsvLine(lines[0]);
    expect(headers).toHaveLength(15);

    // Verify specific header names
    expect(headers[0]).toBe('Type');
    expect(headers[1]).toBe('Buy Amount');
    expect(headers[10]).toBe('Date');
    expect(headers[12]).toBe('Tx-ID');
    expect(headers[14]).toBe('Sell Value in Account Currency');

    // Buffer also contains BOM + header only
    const buffer = generateCoinTrackingCsvBuffer([]);
    expect(buffer[0]).toBe(0xef);
    expect(buffer[1]).toBe(0xbb);
    expect(buffer[2]).toBe(0xbf);
    // Buffer length should be BOM (3 bytes) + header line + CRLF
    const headerStr = lines[0];
    expect(buffer.length).toBe(3 + Buffer.byteLength(headerStr, 'utf-8') + 2); // +2 for \r\n
  });
});
