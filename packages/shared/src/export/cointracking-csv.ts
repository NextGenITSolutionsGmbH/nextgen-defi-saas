// ---------------------------------------------------------------------------
// CoinTracking CSV Export — 15-column standard format
// Compliant with CoinTracking.info import specification
// Date format: DD.MM.YYYY HH:MM:SS (UTC)
// Decimal separator: comma (German format)
// Encoding: UTF-8 with BOM
//
// @spec US-004, EP-07 — CoinTracking 15-column CSV export
// ---------------------------------------------------------------------------

import { COINTRACKING_TYPES } from '../constants';

/**
 * Represents a single row in a CoinTracking CSV export.
 * All 15 standard columns are represented.
 * Nullable fields allow omission of buy-side or sell-side for one-sided transactions.
 */
export interface CoinTrackingRow {
  /** Col 1: Trade, Staking, LP Rewards, etc. */
  type: string;
  /** Col 2: Decimal with comma separator */
  buyAmount: string | null;
  /** Col 3: Token symbol (FLR, FXRP, etc.) */
  buyCurrency: string | null;
  /** Col 4: Decimal with comma separator */
  sellAmount: string | null;
  /** Col 5: Token symbol */
  sellCurrency: string | null;
  /** Col 6: Fee amount */
  fee: string | null;
  /** Col 7: Fee token */
  feeCurrency: string | null;
  /** Col 8: SparkDEX, Enosys, Kinetic Market, etc. */
  exchange: string;
  /** Col 9: DeFi-Flare, Staking, Farming, Lending */
  tradeGroup: string;
  /** Col 10: TX details, Graubereich model, price source */
  comment: string;
  /** Col 11: DD.MM.YYYY HH:MM:SS (UTC) */
  date: string;
  /** Col 12: LP pair name (wFLR/USDT V3) */
  liquidityPool: string | null;
  /** Col 13: Full TX hash (0x...) */
  txId: string;
  /** Col 14: EUR value */
  buyValueInAccountCurrency: string | null;
  /** Col 15: EUR value */
  sellValueInAccountCurrency: string | null;
}

/** CSV header row (exact CoinTracking format) */
const CSV_HEADERS: readonly string[] = [
  '"Type"',
  '"Buy Amount"',
  '"Buy Currency"',
  '"Sell Amount"',
  '"Sell Currency"',
  '"Fee"',
  '"Fee Currency"',
  '"Exchange"',
  '"Trade-Group"',
  '"Comment"',
  '"Date"',
  '"Liquidity pool"',
  '"Tx-ID"',
  '"Buy Value in Account Currency"',
  '"Sell Value in Account Currency"',
];

/** UTF-8 BOM character */
const UTF8_BOM = '\uFEFF';

/**
 * Converts a numeric value to German decimal format (comma as decimal separator).
 * Examples:
 *   1234.56  -> "1234,56"
 *   "0.001"  -> "0,001"
 *   null     -> ""
 *   ""       -> ""
 */
export function formatDecimalDE(value: string | number | null): string {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  const str = typeof value === 'number' ? value.toString() : value;

  // Replace all dots with commas for German decimal format
  return str.replace(/\./g, ',');
}

/**
 * Converts a Unix timestamp (seconds) to CoinTracking date format.
 * Output: DD.MM.YYYY HH:MM:SS (UTC)
 */
export function formatDateCT(timestamp: number): string {
  const d = new Date(timestamp * 1000);

  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const year = d.getUTCFullYear();
  const hours = String(d.getUTCHours()).padStart(2, '0');
  const minutes = String(d.getUTCMinutes()).padStart(2, '0');
  const seconds = String(d.getUTCSeconds()).padStart(2, '0');

  return `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`;
}

/**
 * Escapes a field value for CSV output.
 * - Wraps in double quotes
 * - Escapes internal double quotes by doubling them
 */
function escapeCsvField(value: string | null): string {
  if (value === null || value === undefined) {
    return '""';
  }

  // Escape double quotes by doubling them
  const escaped = value.replace(/"/g, '""');
  return `"${escaped}"`;
}

/**
 * Converts a CoinTrackingRow to a single CSV line with proper quoting and escaping.
 * Fields are comma-separated and individually quoted.
 */
export function rowToCsvLine(row: CoinTrackingRow): string {
  const fields: (string | null)[] = [
    row.type,
    row.buyAmount,
    row.buyCurrency,
    row.sellAmount,
    row.sellCurrency,
    row.fee,
    row.feeCurrency,
    row.exchange,
    row.tradeGroup,
    row.comment,
    row.date,
    row.liquidityPool,
    row.txId,
    row.buyValueInAccountCurrency,
    row.sellValueInAccountCurrency,
  ];

  return fields.map(escapeCsvField).join(',');
}

/**
 * Generates the full CoinTracking CSV string.
 * Includes UTF-8 BOM, header row, and all data rows.
 * Line endings are CRLF (\r\n) for maximum compatibility.
 */
export function generateCoinTrackingCsv(rows: CoinTrackingRow[]): string {
  const headerLine = CSV_HEADERS.join(',');
  const dataLines = rows.map(rowToCsvLine);
  const allLines = [headerLine, ...dataLines];

  return UTF8_BOM + allLines.join('\r\n') + '\r\n';
}

/**
 * Generates the CoinTracking CSV as a Buffer for file writing.
 * The Buffer is UTF-8 encoded and includes the BOM.
 */
export function generateCoinTrackingCsvBuffer(rows: CoinTrackingRow[]): Buffer {
  const csvString = generateCoinTrackingCsv(rows);
  return Buffer.from(csvString, 'utf-8');
}

/** Date format regex: DD.MM.YYYY HH:MM:SS */
const CT_DATE_REGEX = /^\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}:\d{2}$/;

/**
 * Validates a CoinTrackingRow against CoinTracking import requirements.
 *
 * Checks:
 * - type must be a valid CoinTracking transaction type
 * - date must match DD.MM.YYYY HH:MM:SS format
 * - At least buy-side or sell-side must be populated
 * - If buyAmount is set, buyCurrency must also be set (and vice versa)
 * - If sellAmount is set, sellCurrency must also be set (and vice versa)
 * - If fee is set, feeCurrency must also be set
 * - exchange must not be empty
 * - txId must not be empty
 */
export function validateCoinTrackingRow(
  row: CoinTrackingRow,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate type against known CoinTracking types
  const validTypes: readonly string[] = COINTRACKING_TYPES;
  if (!validTypes.includes(row.type)) {
    errors.push(
      `Invalid type "${row.type}". Must be one of: ${validTypes.join(', ')}`,
    );
  }

  // Validate date format
  if (!CT_DATE_REGEX.test(row.date)) {
    errors.push(
      `Invalid date format "${row.date}". Expected DD.MM.YYYY HH:MM:SS`,
    );
  }

  // At least buy or sell side must be populated
  const hasBuy = row.buyAmount !== null && row.buyAmount !== '';
  const hasSell = row.sellAmount !== null && row.sellAmount !== '';

  if (!hasBuy && !hasSell) {
    errors.push('At least buy-side or sell-side must be populated');
  }

  // Buy-side consistency
  if (hasBuy && (!row.buyCurrency || row.buyCurrency === '')) {
    errors.push('buyCurrency is required when buyAmount is set');
  }
  if (
    row.buyCurrency &&
    row.buyCurrency !== '' &&
    !hasBuy
  ) {
    errors.push('buyAmount is required when buyCurrency is set');
  }

  // Sell-side consistency
  if (hasSell && (!row.sellCurrency || row.sellCurrency === '')) {
    errors.push('sellCurrency is required when sellAmount is set');
  }
  if (
    row.sellCurrency &&
    row.sellCurrency !== '' &&
    !hasSell
  ) {
    errors.push('sellAmount is required when sellCurrency is set');
  }

  // Fee consistency
  const hasFee = row.fee !== null && row.fee !== '';
  if (hasFee && (!row.feeCurrency || row.feeCurrency === '')) {
    errors.push('feeCurrency is required when fee is set');
  }

  // Exchange must not be empty
  if (!row.exchange || row.exchange.trim() === '') {
    errors.push('exchange must not be empty');
  }

  // txId must not be empty
  if (!row.txId || row.txId.trim() === '') {
    errors.push('txId must not be empty');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
