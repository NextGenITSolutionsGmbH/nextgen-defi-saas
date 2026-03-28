// ---------------------------------------------------------------------------
// CoinTracking XLSX Export — 15-column standard format using ExcelJS
// Uses the same headers, formatting, and structure as the CSV export.
//
// @spec EP-07 — CoinTracking XLSX export
// ---------------------------------------------------------------------------

import ExcelJS from "exceljs";
import type { CoinTrackingRow } from "./cointracking-csv";

/** Column headers without surrounding quotes (clean for XLSX cells) */
const XLSX_HEADERS: readonly string[] = [
  "Type",
  "Buy Amount",
  "Buy Currency",
  "Sell Amount",
  "Sell Currency",
  "Fee",
  "Fee Currency",
  "Exchange",
  "Trade-Group",
  "Comment",
  "Date",
  "Liquidity pool",
  "Tx-ID",
  "Buy Value in Account Currency",
  "Sell Value in Account Currency",
];

/**
 * Converts a CoinTrackingRow to an ordered array of cell values,
 * matching the 15-column header order.
 */
function rowToValues(row: CoinTrackingRow): (string | null)[] {
  return [
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
}

/**
 * Generates a CoinTracking-compatible XLSX file as a Buffer.
 *
 * Features:
 * - Worksheet named "CoinTracking"
 * - Exact same 15 column headers as the CSV export
 * - All values use DE formatting (comma decimal separator) — pre-formatted in the rows
 * - Bold header row
 * - Auto-width columns based on content length
 */
export async function generateCoinTrackingXlsxBuffer(
  rows: CoinTrackingRow[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("CoinTracking");

  // --- Header row ---
  const headerRow = worksheet.addRow([...XLSX_HEADERS]);
  headerRow.font = { bold: true };

  // --- Data rows ---
  for (const row of rows) {
    const values = rowToValues(row);
    // Replace null with empty string for clean XLSX output
    worksheet.addRow(values.map((v) => v ?? ""));
  }

  // --- Auto-width columns ---
  // Calculate optimal width based on header and data content
  for (let colIdx = 0; colIdx < XLSX_HEADERS.length; colIdx++) {
    const column = worksheet.getColumn(colIdx + 1); // ExcelJS columns are 1-indexed
    let maxLength = XLSX_HEADERS[colIdx]!.length;

    for (const row of rows) {
      const cellValue = rowToValues(row)[colIdx];
      if (cellValue && cellValue.length > maxLength) {
        maxLength = cellValue.length;
      }
    }

    // Add a small padding and cap at a reasonable max
    column.width = Math.min(maxLength + 2, 60);
  }

  // --- Write buffer ---
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
