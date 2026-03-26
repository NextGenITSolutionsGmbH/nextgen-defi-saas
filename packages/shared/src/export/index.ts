// ---------------------------------------------------------------------------
// @defi-tracker/shared — Export module barrel re-export
// ---------------------------------------------------------------------------

// CoinTracking CSV Generator
export {
  formatDecimalDE,
  formatDateCT,
  rowToCsvLine,
  generateCoinTrackingCsv,
  generateCoinTrackingCsvBuffer,
  validateCoinTrackingRow,
} from './cointracking-csv';

export type { CoinTrackingRow } from './cointracking-csv';

// PDF Tax Report Generator
export { generateTaxReportHtml } from './pdf-report';

export type { TaxReportData } from './pdf-report';

// GoBD Audit Log Service
export {
  computeAuditHash,
  createAuditLogEntry,
  verifyAuditChain,
  createExportAuditEntry,
  computeFileHash,
} from './audit-log';

export type { AuditLogEntry } from './audit-log';
